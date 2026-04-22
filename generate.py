#!/usr/bin/python3

import base64, collections, gzip, hashlib, json, math, os, shutil, sys

def usage(message = None):
  print("Usage: ./generate.py --input-data <file.json> --out-site <out-dir> [--overwrite] [--unique-subdir] [--branching-factor <factor>] [--entries-per-shard <count>]")
  print("Reads a data file, creates a TreeMap, splits it into pieces, and writes each piece to a file")
  print("  --overwrite If the output dir already exists, delete it first")
  print("  --unique-subdir Put the data into a subdirectory of <out-dir>.")
  print("     Different runs with different data are expected to choose different subdirectories. If the calling web page is updated to point to this new subdirectory, it can clarify that the data has changed and should be re-fetched")
  print("  --branching-factor <factor> Each node in the tree can have up to <factor> child nodes")
  print("  --entries-per-shard <count> Each leaf node in the tree can store up to <count> entries")
  if message is not None:
    print(message)
  sys.exit(1)

def readFile(path):
  with open(path, encoding = 'utf-8') as f:
    return json.load(f)

def readDict(path):
  data = readFile(path)
  if not isinstance(data, dict):
    raise Exception("Data at " + path + " is " + str(type(data).__name__) + ", but dict is required")
  return data

def hashFile(path):
  hasher = hashlib.new("sha1")
  with open(path, "rb") as file:
    while True:
      section = file.read(8192)
      if not section:
        break
      hasher.update(section)
  return str(hasher.hexdigest())

# splits information into shards
class ShardMap(object):
  # dataList is expected to be sorted
  def __init__(self, dataList, targetBranchingFactor, targetNumEntriesPerShard):
    # List<Pair<Key, Value>>
    self.rootItems = []
    self.children = []
    self.minKey = dataList[0][0]
    self.maxKey = dataList[-1][0]
    # choose sizes
    self.targetBranchingFactor = targetBranchingFactor
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
    print("Splitting " + str(len(dataList)) + " items into about " + str(self.targetBranchingFactor) + " children")
    # estimate the number of nodes we need for this amount of data
    numLeafNodes = len(dataList) / self.targetNumEntriesPerShard
    requiredDepth = int(math.log(numLeafNodes, self.targetBranchingFactor) + 1)
    # try to put about the same amount of data in each node
    numChildren = int(math.pow(numLeafNodes, 1 / requiredDepth) + 1)
    childStart = 0
    for i in range(numChildren):
      childEnd = int(len(dataList) * (i + 1) / numChildren)
      childContents = dataList[childStart:childEnd]
      self.children.append(ShardMap(childContents, self.targetBranchingFactor, self.targetNumEntriesPerShard))
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

def run(inputFile, outputDir, targetBranchingFactor, targetNumEntriesPerShard, overwrite, uniqueSubdir):
  if os.path.exists(outputDir):
    if overwrite:
      shutil.rmtree(outputDir)
    else:
      raise Exception("Output dir " + str(outputDir) + " already exists! Pass --overwrite to automatically remove it")
  print("loading " + inputFile)
  data = readDict(inputFile)
  if uniqueSubdir:
    print("hashing data")
    hashText = hashFile(inputFile)
    # We want to make it easy to share when the data has changed, so we allow moving the data into a subdir based on its hash
    # However, we might make a lot of requests that contain this hash in the url, so we don't want the hash to be too long
    hashText = hashText[:8]
    print("computed hash " + hashText)
    versionedOutputDir = os.path.join(outputDir, hashText)
  else:
    versionedOutputDir = outputDir
  print("transforming " + inputFile + " into " + versionedOutputDir)
  print("loaded " + str(len(data)) + " entries from " + str(inputFile))
  print("sorting")
  sortedKeys = sorted(data.keys(), key=lambda x:(x.lower(), x))
  print("building entries")
  entries = []
  for key in sortedKeys:
    value = data[key]
    entries.append((key, value))
  print("Building tree")
  shardMap = ShardMap(entries, targetBranchingFactor, targetNumEntriesPerShard)
  print("saving")
  shardMap.write(versionedOutputDir)
  print("saved results to " + str(versionedOutputDir))


def main(args):
  inputFile = None
  outputDir = None
  overwrite = False
  uniqueSubdir = False
  numEntriesPerShard = 4096
  branchingFactor = 256
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
    if arg == "--unique-subdir":
      uniqueSubdir = True
      continue
    if arg == "--entries-per-shard":
      numEntriesPerShard = int(args[0])
      args = args[1:]
      continue
    if arg == "--branching-factor":
      branchingFactor = int(args[0])
      args = args[1:]
      continue
    raise Exception("Unrecognized argument " + arg)
  if inputFile is None:
    usage("--input-data is required")
  if outputDir is None:
    usage("--out-site is required")
  if numEntriesPerShard is None:
    usage("--entries-per-shard is required")
  run(inputFile, outputDir, branchingFactor, numEntriesPerShard, overwrite, uniqueSubdir)

if __name__ == "__main__":
  main(sys.argv[1:])
