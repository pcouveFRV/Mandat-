#!/bin/sh
# Construction locale sans npm (environnement sans accès au registre) : bun + sources de Preact clonées depuis GitHub.
# Usage : PREACT_SRC=/chemin/vers/preact sh scripts/dev/build-local.sh [dossier de sortie]
# Pour un usage normal, préférer : npm install && npm run build (Vite).
set -e
OUT=${1:-.local/dist}
PRE=${PREACT_SRC:-.sources/preact}
mkdir -p "$OUT" .local
cat > .local/tsconfig.local.json <<EOF
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "preact", "baseUrl": "..", "paths": {
  "preact": ["$PRE/src/index.js"], "preact/hooks": ["$PRE/hooks/src/index.js"], "preact/jsx-runtime": ["$PRE/jsx-runtime/src/index.js"] } } }
EOF
bun build src/ui/main.tsx --outdir "$OUT/assets" --target browser --minify --tsconfig-override .local/tsconfig.local.json --define '__LOCAL_WORKER__="./assets/worker.js"' --entry-naming '[name].[ext]'
bun build src/worker/worker.ts --outdir "$OUT/assets" --target browser --minify --entry-naming '[name].[ext]'
sed -e 's#/src/ui/main.tsx#./assets/main.js#' -e 's#</head>#<link rel="stylesheet" href="./assets/main.css"></head>#' index.html > "$OUT/index.html"
rm -rf "$OUT/data" && cp -r public/data "$OUT/data"
rm -rf "$OUT/vendor" && cp -r public/vendor "$OUT/vendor"
echo "Construit dans $OUT"
