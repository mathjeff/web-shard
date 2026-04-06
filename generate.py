#!python

import base64, collections, gzip, json, math, os, shutil, sys

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
  # dataList is expected to be sorted
  def __init__(self, dataList, targetNumEntriesPerShard):
    # List<Pair<Key, Value>>
    self.rootItems = []
    self.children = []
    self.minKey = dataList[0][0]
    self.maxKey = dataList[-1][0]
    # choose sizes
    self.targetNumEntriesPerShard = targetNumEntriesPerShard
    self.putAll(dataList)

  def putAll(self, dataList):
    if len(dataList) <= self.targetNumEntriesPerShard:
      self.saveInSelf(dataList)
    else:
      self.saveInChildren(dataList)

  def saveInSelf(self, dataList):
    self.rootItems = dataList

  def saveInChildren(self, dataList):
    print("Splitting " + str(len(dataList)) + " items into about " + str(self.targetNumEntriesPerShard) + " children")
    # estimate the number of nodes we need for this amount of data
    requiredDepth = int(math.log(len(dataList), self.targetNumEntriesPerShard) + 1)
    # try to put about the same amount of data in each node
    numChildren = int(math.pow(len(dataList), 1 / requiredDepth) + 1)
    childStart = 0
    for i in range(numChildren):
      childEnd = int(len(dataList) * (i + 1) / numChildren)
      childContents = dataList[childStart:childEnd]
      self.children.append(Sharder(childContents, self.targetNumEntriesPerShard))
      childStart = childEnd
    print("Split " + str(len(dataList)) + " items into " + str(len(self.children)) + " children")

  def formatRootItems(self):
    return json.dumps(self.rootItems)

  def formatChildKeys(self):
    keys = []
    if len(self.children) > 0:
      keys = [child.maxKey for child in self.children]
    return json.dumps(keys)

  def write(self, destDir):
    os.makedirs(destDir, exist_ok = True)
    destFile = destDir + "/data.json.gz"

    lines = [
      '{',
    ]
    lines.append('  "childKeys": ' + self.formatChildKeys() + ",")
    lines.append('  "contents": ' + self.formatRootItems())
    lines.append('}')
    text = "\n".join(lines)
    with gzip.open(destFile, 'wt') as f:
      f.write(text)
    for i in range(len(self.children)):
      child = self.children[i]
      subdir = destDir + "/" + str(i)
      child.write(subdir)

  def getNextKey(self, item):
    return item[self.childKeyStart:min(self.childKeyEnd, len(item))]

def run(inputFile, outputDir, targetNumEntriesPerShard, overwrite):
  if os.path.exists(outputDir):
    if overwrite:
      shutil.rmtree(outputDir)
    else:
      raise Exception("Output dir " + str(outputDir) + " already exists! Pass --overwrite to automatically remove it")
  print("transforming " + inputFile + " into " + outputDir)
  print("loading " + inputFile)
  data = readDict(inputFile)
  print("loaded " + str(len(data)) + " entries from " + str(inputFile))
  print("sorting")
  sortedKeys = sorted(data.keys())
  print("building entries")
  entries = []
  for key in sortedKeys:
    value = data[key]
    entries.append((key, value))
  print("Building tree")
  sharder = Sharder(entries, targetNumEntriesPerShard)
  print("saving")
  sharder.write(outputDir)
  print("saved results to " + str(outputDir))


def main(args):
  inputFile = None
  outputDir = None
  overwrite = False
  numEntriesPerShard = 4096
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
    if arg == "--entries-per-shard":
      numEntriesPerShard = int(args[0])
      args = args[1:]
      continue
    raise Exception("Unrecognized argument " + arg)
  if inputFile is None:
    usage("--input-data is required")
  if outputDir is None:
    usage("--out-site is required")
  if numEntriesPerShard is None:
    usage("--entries-per-shard is required")
  run(inputFile, outputDir, numEntriesPerShard, overwrite)

if __name__ == "__main__":
  main(sys.argv[1:])
