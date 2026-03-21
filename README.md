This project makes it easy to split a json dictionary into pieces and lazily request those pieces from javascript

Usage looks like this:
* Run generate.py to split a dictionary into pieces
* Add the resulting .json files to your website into a subdirectory such as dataSubdir
* Add loader.json to your website
* Create a ShardLoader like `loader = new ShardLoader("dataSubdir")`
* Query a ShardLoader like `loader.getOneEntry("key", optionalLogger)`

See examples/ for an example

