#!/bin/bash
set -e
cd "$(dirname $0)"

./generate.py --input-data example/src/data.json --out-site example/out/data --overwrite --entries-per-shard 2
cp ./loader.js example/out/
cp ./example/src/index.html example/out/
