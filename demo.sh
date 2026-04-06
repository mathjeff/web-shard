#!/bin/bash
set -e
cd "$(dirname $0)"

./generate.py --input-data example/src/data.json --out-site example/out/data --overwrite --entries-per-shard 4
cp ./loader.js example/out/
cp ./example/src/index.html example/out/

echo
echo "The website has been created in example/out"
echo
echo "Now open http://localhost:8000/example/out/index.html in a web browser"
echo
echo "Press ctrl-C when done"
echo
echo "Starting a webserver to show the website"
echo

python -m http.server
