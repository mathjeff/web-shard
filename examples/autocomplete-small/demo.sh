#!/bin/bash
set -e
cd "$(dirname $0)"
projectRoot="./"
repoRoot="../../"

rm "$projectRoot/out/" -rf

$repoRoot/generate.py --input-data $projectRoot/src/data.json --out-site $projectRoot/out/data --overwrite --entries-per-shard 4 --branching-factor 4
cp $repoRoot/web-shard.js $projectRoot/out/
$projectRoot/../deps/expand-includes.sh $projectRoot/src/index.html $projectRoot/out/index.html

echo
echo "The website has been created in $projectRoot/"
echo
echo "Now open http://localhost:8000/out/index.html in a web browser"
echo
echo "Press ctrl-C when done"
echo
echo "Starting a webserver to show the website"
echo

python3 -m http.server
