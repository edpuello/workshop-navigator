#!/bin/bash
# Run once on the Mac before the first build: downloads the Supabase library the app bundles (cloud sync).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor www/vendor
curl -fsSL 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js' -o vendor/supabase.min.js
cp vendor/supabase.min.js www/vendor/supabase.min.js
echo "Supabase library downloaded ($(wc -c < vendor/supabase.min.js | tr -d ' ') bytes). Now open WorkshopNavigator.xcodeproj in Xcode."
