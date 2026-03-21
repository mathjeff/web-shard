#!python

import base64, collections, json, math, os, shutil, sys

def usage(message = None):
  print("Usage: ./generate.py --input-data <file.json> --out-site <out-dir> [--overwrite]")
  if message is not None:
    print(message)
  sys.exit(1)

def readFile(path):
  with open(path) as f:
    return json.load(f)

def readDict(path):
  data = readFile(path)
  if not isinstance(data, dict):
    raise Exception("Data at " + path + " is " + str(type(data).__name__) + ", but dict is required")
  return data

# splits information into shards
class Sharder(object):
  def __init__(self, dataDict, targetNumItemsPerShard, keyStart = 0):
    # allocate some data
    self.children = {}
    self.rootItems = {}
    # choose sizes
    self.targetNumItemsPerShard = targetNumItemsPerShard
    numShards = int(len(dataDict) / targetNumItemsPerShard) + 1
    numChars = int(math.log(numShards) / math.log(64)) + 1
    self.childKeyStart = keyStart 
    self.childKeyEnd = keyStart + numChars
    if self.childKeyEnd <= self.childKeyStart:
      raise Exception("child keys " + str(self.childKeyStart) + ":" + str(self.childKeyEnd))
    # save data
    self.putAll(dataDict)

  def putAll(self, dataDict):
    if len(dataDict) <= self.targetNumItemsPerShard:
      self.saveInSelf(dataDict)
    else:
      self.saveInChildren(dataDict)

  def saveInSelf(self, dataDict):
    self.rootItems = dataDict

  def saveInChildren(self, dataDict):
    print("Splitting " + str(len(dataDict)) + " items into children")
    # group items by child
    contentByKey = collections.defaultdict(lambda: {})
    for name, value in dataDict.items():
      key = self.getNextKey(name)
      contentByKey[key][name] = value
    print("Split " + str(len(dataDict)) + " items into " + str(len(contentByKey)) + " children")
    # pass items to children
    for key, contents in contentByKey.items():
      self.children[key] = Sharder(contents, self.targetNumItemsPerShard, self.childKeyEnd)

  def formatRootItems(self):
    return json.dumps(self.rootItems)

  def write(self, destDir, name = "."):
    os.makedirs(destDir, exist_ok = True)
    destFile = destDir + "/data.js"

    lines = [
      "shards['" + name + "'] = {}",
      "shards['" + name + "']['s'] = " + str(self.childKeyStart),
      "shards['" + name + "']['e'] = " + str(self.childKeyEnd),
      "shards['" + name + "']['c'] = " + self.formatRootItems(),
      "\n"
    ]
    text = "\n".join(lines)
    with open(destFile, 'w') as f:
      f.write(text)
    for childKey, child in self.children.items():
      subdir = destDir + "/" + childKey
      childName = name + "/" + childKey
      child.write(subdir, childName)

  def getNextKey(self, item):
    return item[self.childKeyStart:min(self.childKeyEnd, len(item))]

def run(inputFile, outputDir, overwrite):
  if os.path.exists(outputDir):
    if overwrite:
      shutil.rmtree(outputDir)
    else:
      raise Exception("Output dir " + str(outputDir) + " already exists! Pass --overwrite to automatically remove it")
  print("transforming " + inputFile + " into " + outputDir)
  print("loading " + inputFile)
  data = readDict(inputFile)
  print("loaded " + str(len(data)) + " entries from " + str(inputFile))
  targetNumEntriesPerShard = 2
  print("encoding keys")
  encoded = {}
  for key, value in data.items():
    encodedKey = base64.b64encode(key.encode('utf-8')).decode('ascii')
    encoded[encodedKey] = value
  print("hashing and grouping")
  sharder = Sharder(encoded, targetNumEntriesPerShard)
  print("saving")
  sharder.write(outputDir)
  print("saved results to " + str(outputDir))


def main(args):
  inputFile = None
  outputDir = None
  overwrite = False
  while len(args) > 0:
    arg = args[0]
    args = args[1:]
    if arg == "--input-data":
      inputFile = args[0]
      args = args[1:]
      continue
    if arg == "--out-site":
      outputDir = args[0]
      args = args[1:]
      continue
    if arg == "--overwrite":
      overwrite = True
      continue
    raise Exception("Unrecognized argument " + arg)
  if inputFile is None:
    usage("--input-data is required")
  if outputDir is None:
    usage("--out-site is required")
  run(inputFile, outputDir, overwrite)

if __name__ == "__main__":
  main(sys.argv[1:])
