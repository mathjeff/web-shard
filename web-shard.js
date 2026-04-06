class ShardMap {
  // Represents a TreeMap<String, Object>
  constructor(baseurl) {
    this.baseurl = baseurl
    this.rootItems = null
    this.childKeys = null
    this.children = {}
  }

  // returns the item with key `name`, or null if none exists
  async get(name, logger) {
    if (logger) {
      logger("ShardMap getting " + name)
    }
    let encoded = name
    let result = await this.#getEncoded(encoded, logger)
    if (logger) {
      logger("ShardMap.load(" + name + ") = " + result)
    }
    return result
  }

  // finds the entries having keys near `name` and returns their keys
  async getNeighborhoodKeys(name, numBefore, numAfter, logger) {
    let entries = await this.getNeighborhoodEntries(name, numBefore, numAfter, logger)
    let results = []
    for (var i = 0; i < entries.length; i++) {
      let entry = entries[i]
      results.push(entry[0])
    }
    return results
  }

  // finds the entries having keys near `name` and returns their values
  async getNeighborhoodValues(name, numBefore, numAfter, logger) {
    let entries = await this.getNeighborhoodEntries(name, numBefore, numAfter, logger)
    let results = []
    for (var i = 0; i < entries.length; i++) {
      let entry = entries[i]
      results.push(entry[1])
    }
    return results
  }

  // finds the entries having keys near `name` and returns them
  async getNeighborhoodEntries(name, numBefore, numAfter, logger) {
    if (logger) {
      logger("ShardMap getting " + numBefore + " items before and " + numAfter + " items after " + name)
    }
    let encoded = name
    let before = await this.#getNeighborhoodEncodedBefore(encoded, numBefore, logger)
    let after = await this.#getNeighborhoodEncodedAfter(encoded, numAfter, logger)
    var result = []
    for (var item of before) {
      result.push(item)
    }
    for (var item of after) {
      result.push(item)
    }
    if (logger) {
      logger("ShardMap.getNeighborhoodEntries(" + name + ", " + numBefore + ", " + numAfter + ") = " + result.length + " results:")
      for (var entry of result) {
        logger(entry)
      }
    }
    return result
  }

  // finds the entries having keys equal to or before `name` and returns their values
  async #getNeighborhoodEncodedBefore(encoded, count, logger) {
    await this.#ensureLoaded(logger)
    var results = []
    if (this.rootItems.length > 0) {
      let endIndex = await this.#getRootIndexBefore(encoded, logger) + 1
      let startIndex = endIndex - count
      if (startIndex < 0)
        startIndex = 0
      results = await this.#getEntryRange(startIndex, endIndex, logger)
    } else {
      let childIndex = this.#getChildIndex(encoded)
      while (true) {
        if (results.length >= count) {
          break
        }
        if (childIndex < 0) {
          break
        }
        let child = this.#getChildByIndex(childIndex)
        let newResults = await child.#getNeighborhoodEncodedBefore(encoded, count - results.length, logger)
        results = newResults.concat(results)
        childIndex -= 1
      }
    }
    if (logger) {
      logger("ShardMap.getNeighborhoodEncodedBefore(" + encoded + ", " + count + ") in " + this.baseurl + " = " + results.length + " results:")
      logger(results)
    }
    return results
  }

  // finds the entries having keys after `name` and returns their values
  async #getNeighborhoodEncodedAfter(encoded, count, logger) {
    await this.#ensureLoaded(logger)
    var results = []
    if (this.rootItems.length > 0) {
      let startIndex = await this.#getRootIndexBefore(encoded, logger) + 1
      let endIndex = startIndex + count
      if (endIndex > this.rootItems.length)
        endIndex = this.rootItems.length
      results = await this.#getEntryRange(startIndex, endIndex, logger)
    } else {
      let childIndex = this.#getChildIndex(encoded)
      while (true) {
        if (results.length >= count) {
          break
        }
        if (childIndex >= this.childKeys.length) {
          break
        }
        let child = this.#getChildByIndex(childIndex)
        let newResults = await child.#getNeighborhoodEncodedAfter(encoded, count - results.length, logger)
        results = results.concat(newResults)
        childIndex += 1
      }
    }
    if (logger) {
      logger("ShardMap.getNeighborhoodEncodedAfter(" + encoded + ", " + count + ") in " + this.baseurl + " = " + results.length + " results:")
      logger(results)
    }
    return results
  }

  async #getEntryRange(startInclusive, endExclusive, logger) {
    await this.#ensureLoaded(logger)
    let results = []
    for (var i = startInclusive; i < endExclusive; i++) {
      results.push(this.rootItems[i])
    }
    return results
  }

  // returns the index of the item before the given item
  async #getRootIndexBefore(encoded, count, logger) {
    await this.#ensureLoaded(logger)
    if (this.rootItems.length < 1) {
      return -1
    }
    if (encoded < this.rootItems[0][0]) {
      return -1
    }
    if (encoded >= this.rootItems[this.rootItems.length - 1][0]) {
      return this.rootItems.length - 1
    }
    var lowIndex = 0
    var highIndex = this.rootItems.length
    while (highIndex >= lowIndex) {
      let middleIndex = Math.floor((lowIndex + highIndex) / 2)
      let candidate = this.rootItems[middleIndex][0]
      if (encoded == candidate) {
        return middleIndex
      }
      if (encoded < candidate) {
        highIndex = middleIndex - 1
      } else {
        lowIndex = middleIndex + 1
      }
    }
    let lastCandidate = this.rootItems[lowIndex][0]
    if (lastCandidate < encoded)
      return lowIndex
    return lowIndex - 1
  }

  #getChildIndex(name) {
    for (var i = 0; i < this.childKeys.length; i++) {
      if (this.childKeys[i] >= name)
        return i
    }
    return this.childKeys.length - 1
  }

  #getChildByIndex(index) {
    let child = this.children[index]
    if (child == null) {
      child = new ShardMap(this.baseurl + "/" + index)
      this.children[index] = child
    }
    if (child == null) {
      throw new Error("child with index " + index + " not found")
    }
    return child
  }

  #getChild(name) {
    let index = this.#getChildIndex(name)
    if (index == null) {
      return null
    }
    return this.#getChildByIndex(index)
  }

  #getRootEntryEncoded(name, logger) {
    for (var entry of this.rootItems) {
      let candidateName = entry[0]
      if (candidateName == name)
        return entry[1]
    }
    return null
  }

  async #getData(url) {
    try {
      let response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to load data from " + url + ": " + response.status)
      }
      let decompressedResponse = await this.decompressResponse(response)
      return await decompressedResponse.json()
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  async decompressResponse(response) {
    let compressedBlob = await response.blob()
    let content = await compressedBlob.stream().pipeThrough(new DecompressionStream("gzip"))
    return await new Response(content)
  }

  async #ensureLoaded(logger) {
    let url = this.baseurl + "/data.json.gz"
    if (this.rootItems != null) {
      if (logger) {
        logger("Already loaded " + url)
      }
    } else {
      if (logger) {
        logger("ShardMap fetching " + url)
      }

      let data = await this.#getData(url)
      this.rootItems = data["contents"]
      this.childKeys = data["childKeys"]
      this.children = {}
      if (logger) {
        logger("fetch result for " + this.baseurl + ": " + this.childKeys.length + " children, " + this.rootItems.length + " items")
      }
    }
  }

  async #getEncoded(name, logger) {
    await this.#ensureLoaded(logger)
    if (this.rootItems.length > 0) {
      return this.#getRootEntryEncoded(name, logger)
    }
    let child = this.#getChild(name)
    return child.#getEncoded(name, logger)
  }

  #decodeKeys(items) {
    let results = []
    for (let key of items) {
      let decodedKey = atob(key[0])
      let value = key[1]
      results.push([decodedKey, value])
    }
    return results
  }

  #decodeList(items) {
    let results = []
    for (let item of items) {
      results.push(atob(item))
    }
    return results
  }
}
