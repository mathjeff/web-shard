This project makes it easy to split a json dictionary into pieces and lazily request those pieces from javascript

Usage looks like this:
* Run generate.py to split a dictionary into pieces
* Add the resulting .json files to your website into a subdirectory such as dataSubdir
* Add loader.json to your website
* Create a ShardLoader like `loader = new ShardLoader("dataSubdir")`
* Query a ShardLoader like `loader.getOneEntry("key", optionalLogger)`

See ./demo.sh for an example of how to generate the data files

See example/out/data for an example of what the generated data files might look like

See example/src/index.html for an example of how to use these data files from javascript
