import elasticlunr from 'elasticlunr'

class Elasticlunr {

  constructor(fields, ref) {
    this._indexPath = 'el_index.json'
    this._index = null

    this._fields = fields
    this._ref = ref

    // whether there are any unsaved indexes
    this._dirty = false
  }

  isDirty = () => {
    return this._dirty
  }

  setClean = () => {
    this._dirty = false
  }

  reset = () => {
    this._index = null
  }

  load = (body) => {
    try {
      this._index = elasticlunr.Index.load(body)
    } catch {
      this.init(this._fields, this._ref)
    }
  }

  init = (fields, ref) => {
    this._index = elasticlunr((idx) => {
      // console.log(idx)
      for (let i in fields) {
        idx.addField(fields[i]);
      }

      idx.setRef(ref);
      idx.saveDocument(false);
    });
  }

  serialize = () => {
    if (!this._index)
      throw Error("Tried to serialize an index not loaded yet")
    
    return this._index.toJSON()
  }

  add = (doc) => {
    this._dirty = true
    return this._index.addDoc(doc)
  }

  search = (query) => {
    // returns a list of keys
    return this._index.search(query).map(item => item.ref)
  }
}


class Bulksearch {
  constructor() {
    this._indexPath = 'bulk_index.json'
    this._index = null
  }
}


class Flexsearch {
  constructor() {
    this._indexPath = 'flex_index.json'
    this._index = null
  }
}


export {
  Flexsearch, Bulksearch, Elasticlunr
}