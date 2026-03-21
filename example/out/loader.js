class ShardLoader {
  constructor(baseurl) {
    this.baseurl = baseurl
    this.rootItems = null
    this.childKeyStart = null
    this.childKeyEnd = null
    this.children = {}
  }
  async getOneEntry(name, logger) {
    if (logger) {
      logger("ShardLoader getting " + name)
    }
    let encoded = btoa(name)
    if (logger) {
      logger("ShardLoader encoded " + name + " as " + encoded)
    }
    let result = await this.#loadOneEntryEncoded(encoded, logger)
    if (logger) {
      logger("ShardLoader.loadOneEntry(" + name + ") = " + result)
    }
    return result
  }

  async #loadOneEntryEncoded(name, logger) {
    await this.#ensureLoaded(logger)
    let rootResult = this.rootItems[name]
    if (rootResult != null) {
      return rootResult
    }
    let nextKey = this.#getNextKey(name)
    let child = this.#getChild(name)
    return child.#loadOneEntryEncoded(name, logger)
  }

  #getNextKey(name) {
    let keyLength = name.length
    let start = this.childKeyStart
    let end = Math.min(name.length, this.childKeyEnd)
    return name.substring(start, end)
  }

  #getChild(name) {
    let key = this.#getNextKey(name)
    let child = this.children[key]
    if (child == null) {
      child = new ShardLoader(this.baseurl + "/" + key)
      this.children[key] = child
    }
    return child
  }

  async #ensureLoaded(logger) {
    let url = this.baseurl + "/data.json"
    if (this.rootItems != null) {
      if (logger) {
        logger("Already loaded " + url)
      }
    } else {
      if (logger) {
        logger("ShardLoader fetching " + url)
      }

      let data = await this.getData(url)
      this.rootItems = data["contents"]
      this.childKeyStart = data["start"]
      this.childKeyEnd = data["end"]
      this.children = {}
      if (logger) {
        logger("rootItems.length = " + Object.keys(this.rootItems).length + " in " + this.baseurl)
        logger("child key range = [" + this.childKeyStart + ":" + this.childKeyEnd + "] in " + this.baseurl)
      }
    }
  }

  async getData(url) {
    try {
      let response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to load data from " + url + ": " + response.status)
      }
      let json = await response.json();
      return json 
    } catch (e) {
      console.log(e)
      throw e
    }
  }
}
