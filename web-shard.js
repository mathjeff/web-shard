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
    let neighborhood = await this.getNeighborhoodEntries(name, 0, 0, logger)
    if (neighborhood.length > 0) {
      let candidate = neighborhood[0]
      if (this.#compare(candidate[0], name) == 0) {
        return candidate[1]
      }
    }
    return null
  }

  // finds the entries having keys near `name` and returns their keys
  async getNeighborhoodKeys(name, numBefore, numAfter, logger) {
    let entries = await this.getNeighborhoodEntries(name, numBefore, numAfter, logger)
    let results = []
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]
      results.push(entry[0])
    }
    return results
  }

  // finds the entries having keys near `name` and returns their values
  async getNeighborhoodValues(name, numBefore, numAfter, logger) {
    let entries = await this.getNeighborhoodEntries(name, numBefore, numAfter, logger)
    let results = []
    for (let i = 0; i < entries.length; i++) {
      let entry = entries[i]
      results.push(entry[1])
    }
    return results
  }

  // finds the entries having keys near `name` and returns them
  async getNeighborhoodEntries(name, numBefore, numAfter, logger) {
    numBefore = parseInt(numBefore)
    numAfter = parseInt(numAfter)
    if (logger) {
      logger("ShardMap getting " + numBefore + " items before and " + numAfter + " items after " + name)
    }
    let encoded = name
    let before = await this.#getNeighborhoodEncodedBefore(encoded, numBefore, logger)
    let after = await this.#getNeighborhoodEncodedAfter(encoded, numAfter + 1, logger)
    let result = []
    // add before items
    for (let item of before) {
      result.push(item)
    }
    // add target items and items after it
    if (after.length > 0) {
      // check how many items to include
      let endIndex = numAfter + 1
      if (this.#compare(name, after[0][0]) != 0)
        endIndex = numAfter // item not found
      if (endIndex >= after.length)
        endIndex = after.length
      // add items
      for (let i = 0; i < endIndex; i++) {
        result.push(after[i])
      }
    }
    if (logger) {
      logger("ShardMap.getNeighborhoodEntries(" + name + ", " + numBefore + ", " + numAfter + ") = " + result.length + " results:")
      for (let entry of result) {
        logger(entry)
      }
    }
    return result
  }

  #compare(a, b) {
    let result = 0
    if (a.toLowerCase() < b.toLowerCase())
      result = -1
    if (a.toLowerCase() > b.toLowerCase())
      result = 1
    return result
  }

  // finds the <count> entries having keys before `name` and returns their values
  async #getNeighborhoodEncodedBefore(encoded, count, logger) {
    await this.#ensureLoaded(logger)
    let results = []
    if (this.rootItems.length > 0) {
      let endIndex = await this.#getRootIndexAfter(encoded, logger)
      if (logger) {
        logger("getNeighborhoodEncodedBefore " + encoded + " got end index " + endIndex)
      }
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

  // finds the <count> entries having keys equal to or after `name` and returns their values
  async #getNeighborhoodEncodedAfter(encoded, count, logger) {
    await this.#ensureLoaded(logger)
    let results = []
    if (this.rootItems.length > 0) {
      let startIndex = await this.#getRootIndexAfter(encoded, logger)
      if (startIndex < 0)
        startIndex = 0
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
    for (let i = startInclusive; i < endExclusive; i++) {
      results.push(this.rootItems[i])
    }
    return results
  }

   // returns the index of the item at or after the given item
  async #getRootIndexAfter(encoded, count, logger) {
    await this.#ensureLoaded(logger)
    if (this.rootItems.length < 1) {
      return -1
    }
    if (this.#compare(encoded, this.rootItems[0][0]) < 0) {
      return -1
    }
    if (this.#compare(encoded, this.rootItems[this.rootItems.length - 1][0]) > 0) {
      return this.rootItems.length
    }
    let lowIndex = 0
    let highIndex = this.rootItems.length
    while (highIndex >= lowIndex) {
      let middleIndex = Math.floor((lowIndex + highIndex) / 2)
      let candidate = this.rootItems[middleIndex][0]
      if (encoded == candidate) {
        return middleIndex
      }
      if (this.#compare(encoded, candidate) < 0) {
        highIndex = middleIndex - 1
      } else {
        lowIndex = middleIndex + 1
      }
    }
    let lastCandidate = this.rootItems[highIndex][0]
    if (this.#compare(lastCandidate, encoded) > 0)
      return highIndex
    return highIndex + 1
  }

  #getChildIndex(name) {
    for (let i = 0; i < this.childKeys.length; i++) {
      if (this.#compare(this.childKeys[i], name) >= 0)
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
