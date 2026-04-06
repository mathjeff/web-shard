#!/bin/bash
set -e
cd "$(dirname $0)"
projectRoot="./"
repoRoot="../../"

$repoRoot/generate.py --input-data $projectRoot/src/data.json --out-site $projectRoot/out/data --overwrite --entries-per-shard 4
cp $repoRoot/web-shard.js $projectRoot/out/
cp $projectRoot/src/index.html $projectRoot/out/

echo
echo "The website has been created in $projectRoot/"
echo
echo "Now open http://localhost:8000/out/index.html in a web browser"
echo
echo "Press ctrl-C when done"
echo
echo "Starting a webserver to show the website"
echo

python -m http.server
