#!/usr/bin/env python3
"""Dark theme for Workshop Navigator (10.21).
Reads every <style> block of a page, works out a dark counterpart for each colour (backgrounds go dark, dark text goes
light, light borders go dim, the navy brand and the green/yellow/red stock colours stay), and writes the result as
<style id="wn-dark"> … </style> right before </head>, every rule under html.dark so it only applies when Dark is on.
Run again after changing a page's CSS:   python3 ios/darkgen.py workshop.html index.html
"""
import re, sys, colorsys

VARS = {  # the shared design tokens, set by hand
    '--bg': '#0d0f12', '--card': '#1a1d22', '--pill': '#262a31', '--line': '#2e333b',
    '--ink': '#eceef2', '--ink2': '#a3a9b4', '--ink3': '#6f7681', '--accent': '#6aaef0', '--hit': '#6aaef0',
}
NAMED = {'white': '#ffffff', 'black': '#000000'}

def parse_color(t):
    t = t.strip().lower()
    t = NAMED.get(t, t)
    if t.startswith('#'):
        h = t[1:]
        if len(h) in (3, 4): h = ''.join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return r / 255, g / 255, b / 255, a
    m = re.match(r'rgba?\(([^)]*)\)', t)
    if m:
        p = [x.strip() for x in re.split(r'[,\s/]+', m.group(1)) if x.strip()]
        r, g, b = [float(x) / 255 for x in p[:3]]
        a = float(p[3]) if len(p) > 3 else 1.0
        return r, g, b, a
    return None

def fmt(r, g, b, a):
    r, g, b = [max(0, min(255, round(x * 255))) for x in (r, g, b)]
    return f'#{r:02x}{g:02x}{b:02x}' if a >= 0.999 else f'rgba({r},{g},{b},{round(a, 3)})'

def hls(c):
    r, g, b, a = c; h, l, s = colorsys.rgb_to_hls(r, g, b); return h, l, s, a

def from_hls(h, l, s, a):
    r, g, b = colorsys.hls_to_rgb(h, max(0, min(1, l)), max(0, min(1, s))); return fmt(r, g, b, a)

def dark_bg(c):
    h, l, s, a = hls(c)
    if a < 0.35: return None                      # light overlays (on the navy bars) stay
    if l >= 0.995: return from_hls(h, 0.11, s * .5, a)            # white cards / sheets
    if l >= 0.94: return from_hls(h, 0.075 if s < .25 else 0.14, s * .45, a)   # page grey / very light tints
    if l >= 0.80: return from_hls(h, 0.17 + (1 - l) * 0.4, s * .5, a)          # chips, pills, light tints
    if l >= 0.55 and s < 0.35: return from_hls(h, 1 - l, s, a)      # mid greys
    return None                                    # navy, red buttons, stock colours stay

def dark_text(c):
    h, l, s, a = hls(c)
    if a < 0.35 or l >= 0.55: return None          # already light (white on navy etc.)
    if s > 0.3: return from_hls(h, max(0.7, 1 - l), min(1, s * 1.05), a)   # coloured text: same colour, lighter
    return from_hls(h, min(0.93, max(0.64, 1 - l * 0.9)), s, a)

def dark_border(c):
    h, l, s, a = hls(c)
    if a < 0.2: return None
    if l >= 0.78: return from_hls(h, 0.22, s * .4, a)
    return None

def dark_shadow(c):
    h, l, s, a = hls(c)
    if l >= 0.9 and a > 0.5: return from_hls(h, 0.11, s * .5, a)   # white rings around dots
    return None

COLOR_RE = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b|\bblack\b')

def mode_for(prop):
    p = prop.strip().lower()
    if p in ('background', 'background-color', 'background-image'): return dark_bg
    if p in ('color', 'fill', 'stroke', 'caret-color', '-webkit-text-fill-color'): return dark_text
    if p.startswith('border') or p.startswith('outline'): return dark_border
    if p == 'box-shadow': return dark_shadow
    return None

def map_value(prop, val, root_vars):
    fn = mode_for(prop)
    if not fn: return None
    v = val
    # resolve var(--brand) / var(--accent) used as text so navy text turns light on dark
    if fn is dark_text:
        m = re.fullmatch(r'\s*var\((--[\w-]+)\)\s*(!important)?\s*', v)
        if m and m.group(1) in ('--brand', '--pri') and m.group(1) not in VARS:
            return '#9cc3ea' + (' !important' if m.group(2) else '')
    changed = False
    def rep(mo):
        nonlocal changed
        c = parse_color(mo.group(0))
        if not c: return mo.group(0)
        n = fn(c)
        if n is None: return mo.group(0)
        changed = True; return n
    out = COLOR_RE.sub(rep, v)
    return out if changed else None

def split_top(css):
    """yield (prelude, body) for top-level blocks; body is inner text"""
    i, n = 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j < 0: break
        k, d = j, 0
        while k < n:
            if css[k] == '{': d += 1
            elif css[k] == '}':
                d -= 1
                if d == 0: break
            k += 1
        pre = css[i:j]
        pre = re.sub(r'/\*.*?\*/', '', pre, flags=re.S).strip()
        semi = pre.rfind(';')                       # stray "@import ...;" or leftovers before the selector
        if semi >= 0 and not pre.startswith('@media'): pre = pre[semi + 1:].strip()
        yield pre, css[j + 1:k]
        i = k + 1

def scope(sel):
    out = []
    for s in sel.split(','):
        s = s.strip()
        if not s: continue
        if s.startswith(':root'): s = 'html.dark' + s[5:]
        elif s.startswith('html'): s = 'html.dark' + s[4:]
        else: s = 'html.dark ' + s
        out.append(s)
    return ','.join(out)

def convert(css):
    out = []
    for pre, body in split_top(css):
        if not pre: continue
        if pre.startswith('@keyframes') or pre.startswith('@font-face') or pre.startswith('@property'): continue
        if pre.startswith('@media') or pre.startswith('@supports'):
            inner = convert(body)
            if inner: out.append(pre + '{' + inner + '}')
            continue
        decls = []
        for d in re.split(r';(?![^(]*\))', body):
            if ':' not in d: continue
            prop, val = d.split(':', 1)
            prop = prop.strip()
            if prop.startswith('--'): continue           # tokens are set by hand (VARS)
            nv = map_value(prop, val, None)
            if nv is not None:
                imp = '!important' in val
                nv = nv.replace('!important', '').strip()
                decls.append(f'{prop}:{nv}' + ('!important' if imp else ''))
        if decls: out.append(scope(pre) + '{' + ';'.join(decls) + '}')
    return ''.join(out)

EXTRA = """
html.dark{color-scheme:dark}
html.dark .pthumb,html.dark .pphoto,html.dark .tk-p .pthumb{background:#e9ecf0!important}
html.dark img{color-scheme:light}
html.dark input,html.dark select,html.dark textarea{background-color:#14171b;color:var(--ink);border-color:var(--line)}
html.dark .nf-att{background:#3a2e10;color:#f3d48b}html.dark .nf-ok{background:#12301f;color:#7fd3a0}
html.dark .wnbub{background:var(--brand)}
html.dark .faith,html.dark .faith .fr{background:#000!important}html.dark .faith figcaption{color:#f2f2f2!important}html.dark .faith{box-shadow:0 0 0 1px rgba(255,255,255,.09)}
html.dark .wmini .wc.g,html.dark .wc.g,html.dark .hmini i.g,html.dark .hk i.g,html.dark .whd .k i.g,html.dark .lv i.g{background:#3f9e66}
html.dark .wmini .wc.w,html.dark .wc.w,html.dark .hmini i.w,html.dark .hk i.w,html.dark .whd .k i.w,html.dark .lv i.w{background:#d9a640}
html.dark .wmini .wc.r,html.dark .wc.r,html.dark .hmini i.r,html.dark .hk i.r,html.dark .whd .k i.r,html.dark .lv i.r{background:#d2483e}
html.dark .wmini .wc.g,html.dark .wmini .wc.w,html.dark .wmini .wc.r{color:#fff}
html.dark .wnplus:not(.open),html.dark #ckScan,html.dark .scanfab{background:var(--brand)!important;color:#fff!important}html.dark .wnplus.open{color:#fff!important}
html.dark .wnmenu .mi,html.dark .wnmenu .seg button{background:none!important}html.dark .wnmenu .seg button.on{background:#fff!important;color:var(--brand)!important}html.dark .wnmenu{background:var(--brand)!important;color:#fff!important}
html.dark .wnbar .tabbar a{background:none!important}
html.dark header.hw,html.dark body.hdr-a header{background:var(--card)!important}
"""

def build(path):
    s = open(path, encoding='utf-8').read()
    s = re.sub(r'\n?<style id="wn-dark">.*?</style>', '', s, flags=re.S)
    css = ''.join(re.findall(r'<style[^>]*>(.*?)</style>', s, re.S))
    rules = convert(css)
    toks = 'html.dark{' + ';'.join(f'{k}:{v}' for k, v in VARS.items()) + '}'
    block = '\n<style id="wn-dark">/* generated by ios/darkgen.py — dark theme (Menu + → Theme) */' + toks + EXTRA.strip() + rules + '</style>'
    i = s.index('</head>')
    s = s[:i] + block + '\n' + s[i:]
    open(path, 'w', encoding='utf-8').write(s)
    print(path, 'dark rules:', rules.count('{'), 'KB:', round(len(block) / 1024, 1))

if __name__ == '__main__':
    for p in sys.argv[1:] or ['workshop.html', 'index.html']: build(p)
