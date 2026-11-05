#!/bin/bash
# Copies the Workshop web app into www/ for the iPhone app.
# Usage: bash build-www.sh            (uses the website in the folder above: the repo root)
#        bash build-www.sh /path/to/workshop-navigator   (any other copy of the website)
# The Supabase library is bundled (no CDN), and Labs (3D viewer, AI Hub) is left out of the app.
set -euo pipefail
cd "$(dirname "$0")"
SITE="${1:-..}"
rm -rf www && mkdir -p www/vendor
cp "$SITE/index.html" "$SITE/workshop.html" "$SITE/manifest.json" www/
cp -R "$SITE/js" "$SITE/img" www/
CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
for f in www/index.html www/workshop.html; do
  CDN="$CDN" perl -pi -e 's#\Q$ENV{CDN}\E#vendor/supabase.min.js#g' "$f"
done
if [ -f vendor/supabase.min.js ]; then cp vendor/supabase.min.js www/vendor/; fi
echo "www/ ready ($(find www -type f | wc -l | tr -d ' ') files)"
