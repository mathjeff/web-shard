class ShardLoader {
  constructor(baseurl) {
    this.baseurl = baseurl
    this.rootItems = null
    this.childKeys = null
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
    if (this.rootItems.length > 0) {
      return this.#loadRootEntryEncoded(name, logger)
    }
    let child = this.#getChild(name)
    return child.#loadOneEntryEncoded(name, logger)
  }

  #loadRootEntryEncoded(name, logger) {
    for (var entry of this.rootItems) {
      let candidateName = entry[0]
      if (candidateName == name)
        return entry[1]
    }
    return null
  }

  #getChild(name) {
    let key = this.#getChildKey(name)
    if (key == null) {
      return null;
    }
    let child = this.children[key]
    if (child == null) {
      child = new ShardLoader(this.baseurl + "/" + key)
      this.children[key] = child
    }
    return child
  }

  #getChildKey(name) {
    for (var i = 0; i < this.childKeys.length; i++) {
      if (this.childKeys[i] >= name)
        return i
    }
    return null;
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
      this.childKeys = data["childKeys"]
      this.children = {}
      if (logger) {
        logger("rootItems.length = " + this.rootItems.length + " in " + this.baseurl)
        logger("num child keys  =" + this.children.length + " in " + this.baseurl)
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
