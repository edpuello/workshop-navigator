// Shared part rules — copied exactly from the Checklist (index.html) so both pages count and search the same way.
// tests/parity checks that the Workshop page and the Checklist always show the same numbers. Needs: WN (sync.js).
// Functions that read the whole list take the items array; the Checklist's versions read its `data` variable.
const STOCK_LABEL={plenty:'Plenty',low:'Low',out:'Out'};
function qtyNum(x){return x.qty===''||x.qty==null||isNaN(Number(x.qty))?null:Number(x.qty)}
const RODLIKE=x=>/threaded rod/i.test(x.category||'');
function defaultLowAt(x){return x&&x.kind==='supply'?1:RODLIKE(x)?1:10}
function lowAt(x){const v=x.lowAt;return v===''||v==null||isNaN(Number(v))?defaultLowAt(x):Number(v)}
function qtyLevel(x){const q=qtyNum(x);if(q==null)return '';const full=Math.max(Number(x.full)||0,q);
 if(q<lowAt(x))return 'low';if(q<full/2||(RODLIKE(x)&&q<full))return 'half';return 'ok'}
function qtyClass(x){const l=qtyLevel(x);return l?'q-'+l:''}
function countLevel(x){const q=qtyNum(x);if(q==null)return '';if(q===0)return 'out';return qtyLevel(x)==='low'?'low':'plenty'}
function stockLevel(x){return STOCK_LABEL[x.stock]?x.stock:countLevel(x)}
function itemStatus(x){return x.archived?'archived':x.store?'instock':x.need?'tobuy':x.buy?'putaway':'unmarked'}
function isLow(x){return !!x.store&&['low','out'].includes(stockLevel(x))}
const FILTER_ALIAS={need:'tobuy',owned:'instock',unstored:'unmarked'};
function matchFilter(x,f){f=FILTER_ALIAS[f]||f;if(f==='archived')return !!x.archived;if(x.archived)return false;return f==='all'||(f==='low'?isLow(x):f==='tobuy'?!!x.need:itemStatus(x)===f)}
const normS=v=>String(v??'').toLowerCase().replace(/[×✕]/g,'x').replace(/[“”″]/g,'"').replace(/\s+/g,' ');
// Search (10.25) is forgiving on purpose. A size can be typed joined or spaced, with or without inch marks or units, as a fraction or a decimal;
// a word can be plural, joined up, or a common other name. When nothing matches, closestMatches() offers the nearest parts, typos included.
const NUMT=/^[#m]?[0-9][0-9.\/]*$/;const reCache=new Map();
const reEsc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function termRe(t){let r=reCache.get(t);if(!r){r=new RegExp('(^|[^0-9./])'+reEsc(t)+'(?![0-9./])');reCache.set(t,r)}return r}
const SEARCH_NOISE=new Set(['x','in','in.','inch','inches','mm','by','the','a','an','of','for','and','with','w/','-','&']);
const SEARCH_ALSO={nyloc:['nylon-insert','nylon insert','locknut','lock nut'],nylock:['nyloc','nylon-insert','nylon insert','locknut','lock nut'],nylok:['nyloc','nylon-insert','nylon insert','locknut'],
 locknut:['lock nut','nyloc','nylon-insert'],lockwasher:['lock washer'],allen:['socket','hex key'],ss:['stainless'],stainless:['18-8','a2 '],philips:['phillips'],phillip:['phillips'],
 tek:['self-drilling','self drilling'],selfdrilling:['self-drilling','tek'],ziptie:['cable tie','zip tie'],zip:['cable tie'],wirenut:['wire nut','wire connector'],heatshrink:['heat shrink','heat-shrink'],
 glue:['adhesive','epoxy'],imperial:['sae'],tnut:['t-nut','tee nut'],'t-nut':['tee nut'],tee:['t-nut'],molly:['hollow wall'],allthread:['threaded rod'],'all-thread':['threaded rod']};
function searchTerms(raw){const s=normS(raw).replace(/(\d)["']+/g,'$1').replace(/["',;]+/g,' ').replace(/(\d)\s*(?:x|\*)\s*(?=[#m.]?\d)/g,'$1 ').replace(/(\d)(mm|inches|inch|in)\b/g,'$1 $2').replace(/\block[ -]nut(s?)\b/g,'locknut$1').replace(/\bzip[ -]tie(s?)\b/g,'ziptie$1').replace(/\ball[ -]thread\b/g,'allthread');
 const out=[];for(const w of s.trim().split(' ')){if(!w||SEARCH_NOISE.has(w))continue;const m=/^([#m]?\d+(?:[\/.]\d+)?)-(\d+(?:\.\d+)?)$/.exec(w);if(m)out.push(m[1],m[2]);else out.push(w)}return out}
// one haystack per part: the text, the same text with spaces and hyphens squeezed out, every fraction/decimal as a number, and the words
function hayOf(str){const s=normS(str).replace(/(\d)["']+/g,'$1').replace(/["']/g,' ').replace(/\s+/g,' '),vals=[];
 s.replace(/(^|[^\d\/.])(\d+)[- ](\d+)\/(\d+)(?![\d\/.])|(\d+)\/(\d+)|(\d*\.\d+)/g,(m,p,w,n,d,n2,d2,dec)=>{vals.push(w!=null?+w+n/d:n2!=null?(+d2?n2/d2:-1):+dec);if(w!=null&&+d)vals.push(n/d);return m});
 return {s,sq:s.replace(/[\s-]+/g,''),vals,words:s.split(/[^a-z0-9]+/).filter(w=>w.length>2&&/[a-z]/.test(w))}}
function numVal(t){let m;if((m=/^(\d+)-(\d+)\/(\d+)$/.exec(t)))return +m[3]?+m[1]+m[2]/m[3]:null;if((m=/^(\d+)\/(\d+)$/.exec(t)))return +m[2]?m[1]/m[2]:null;return /^(\d*\.\d+|\d+\.\d*)$/.test(t)?+t:null}
function wordAlts(t){const a=[t];if(t.length>3&&/[a-z]s$/.test(t)&&!/(ss|us|is)$/.test(t)){a.push(t.slice(0,-1));if(/[a-z]es$/.test(t))a.push(t.slice(0,-2))}const also=SEARCH_ALSO[t]||SEARCH_ALSO[a[1]];if(also)a.push(...also);return a}
function matchTerm(t,H){const v=numVal(t);if(v!=null&&H.vals.some(u=>Math.abs(u-v)<1e-6))return true;
 if(NUMT.test(t))return termRe(t).test(H.s);
 if(wordAlts(t).some(a=>H.s.includes(a)))return true;const q=t.replace(/-/g,'');return q.length>=6&&H.sq.includes(q)}
function matchHay(H,terms){return terms.every(t=>matchTerm(t,H))}
function partHay(x){return hayOf([x.id,x.name,x.category,x.location,x.notes,STOCK_LABEL[stockLevel(x)]||''].join(' '))}
function matchesSearch(x,terms){if(!terms.length)return true;return matchHay(partHay(x),terms)}
// typo distance (letters swapped, missing, extra or wrong), stopping early once it passes max
function editDist(a,b,max){const n=a.length,m=b.length;if(Math.abs(n-m)>max)return max+1;let p2=null,p=[];for(let j=0;j<=m;j++)p[j]=j;
 for(let i=1;i<=n;i++){const c=[i];let best=i;for(let j=1;j<=m;j++){let v=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,p2[j-2]+1);c[j]=v;if(v<best)best=v}
  if(best>max)return max+1;p2=p;p=c}return p[m]}
function fuzzyTerm(t,H){if(t.length<4||!/^[a-z-]+$/.test(t))return false;const max=t.length>=8?2:1;
 return wordAlts(t).slice(0,3).some(q=>H.words.some(w=>editDist(q,w,max)<=max||(q.length>=5&&w.length>q.length&&editDist(q,w.slice(0,q.length),max)<=max)))}
// nothing matched every word: rank by how much of the search each part does match, and return the best group
function closestMatches(arr,terms,hayFn){const n=terms.length;if(!n)return [];const need=n===1?1:n<=3?n-1:Math.ceil(n*.6),sc=[];
 for(const x of arr){const H=hayFn(x);let hit=0,s=0;for(const t of terms){if(matchTerm(t,H)){hit++;s+=NUMT.test(t)||numVal(t)!=null?1.2:1}else if(fuzzyTerm(t,H)){hit++;s+=.8}}if(hit>=need)sc.push([s,x])}
 if(!sc.length)return [];const top=Math.max(...sc.map(e=>e[0]));return sc.filter(e=>e[0]>=top-.45).sort((a,b)=>b[0]-a[0]).map(e=>e[1])}
// words people add that the part's name may not carry ("sheet metal screws", "hex bolts"): tried first, dropped if they are what blocks a match
const SEARCH_SOFT=new Set(['screw','screws','bolt','bolts','fastener','fasteners','hardware','part','parts','piece','pieces','pcs','size','type','kind']);
// the one way to search a list: every word → the same without the soft words → the closest (near:true means "not exact")
function findParts(arr,terms,hayFn){if(!terms.length)return {list:arr.slice(),near:false};const hs=arr.map(x=>[x,hayFn(x)]);
 let l=hs.filter(e=>matchHay(e[1],terms));if(l.length)return {list:l.map(e=>e[0]),near:false};
 const hard=terms.filter(t=>!SEARCH_SOFT.has(t));if(hard.length&&hard.length<terms.length){l=hs.filter(e=>matchHay(e[1],hard));if(l.length)return {list:l.map(e=>e[0]),near:false}}
 return {list:closestMatches(arr,terms,hayFn),near:true}}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const SIZE_WORDS={'extra-small':.5,'x-small':.5,xs:.5,mini:.6,small:1,short:1,light:1,'light-duty':1,medium:2,'medium-duty':2,regular:2,standard:2,large:3,long:3,heavy:3,'heavy-duty':3,'x-large':4,xl:4,'extra-large':4};
const SIZE_RE=/#\s?(\d+)|\bm(\d+(?:\.\d+)?)\b|(\d+)-(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)/gi;
function sizeKey(name){const out=[],str=String(name||'').toLowerCase().replace(/#\s?(\d+)\s*\/\s*#\s?\d+/g,'#$1');str.replace(SIZE_RE,(m,g,mm,w,n,d,n2,d2,num)=>{out.push(g!=null?.06+.013*(+g):mm!=null?+mm:w!=null?+w+n/d:n2!=null?n2/d2:+num);return m});
 for(const w of str.split(/[^a-z-]+/))if(w in SIZE_WORDS){out.push(SIZE_WORDS[w]);break}return out}
function familyKey(name){return String(name||'').toLowerCase().replace(SIZE_RE,' ').replace(/[×✕"”″'’—–\-\/#.,()]/g,' ').split(/\s+/).filter(w=>w&&w!=='x'&&w!=='in'&&w!=='inch'&&w!=='mm'&&w!=='duty'&&!(w in SIZE_WORDS)).join(' ')}
function cmpSize(a,b){const ka=sizeKey(a.name),kb=sizeKey(b.name);if(!ka.length||!kb.length)return (kb.length-ka.length)||a.name.localeCompare(b.name);for(let i=0;i<Math.max(ka.length,kb.length);i++){const x=ka[i],y=kb[i];if(x==null)return -1;if(y==null)return 1;if(x!==y)return x-y}return a.name.localeCompare(b.name,undefined,{numeric:true})}
function orderIndex(items){const m=new Map();(items||WN.doc.items).forEach((x,i)=>m.set(x.id,i));return m}
function effOrder(x,idx){return typeof x.order==='number'?x.order:(idx.get(x.id)??0)*10}
function sortCat(list,idx){return list.slice().sort((a,b)=>effOrder(a,idx)-effOrder(b,idx)||(idx.get(a.id)-idx.get(b.id)))}
