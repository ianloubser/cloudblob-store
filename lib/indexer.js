const elasticlunr = require('elasticlunr')
const flex = require('flexsearch')

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


class Flexsearch {
  constructor(fields, ref) {
    this._indexPath = 'flex_index.json'
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
      this._index = new flex();
      this._index.import(body)
    } catch {
      this.init(this._fields, this._ref)
    }
  }

  init = (fields, ref) => {
    this._index = flex.create({
      tokenize: 'forward',
      cache: false
    })
  }

  serialize = () => {
    if (!this._index)
      throw Error("Tried to serialize an index not loaded yet")
    
    return this._index.export()
  }

  add = (doc) => {
    this._dirty = true
    for (let i=0; i<this._fields.length; i++) {
      // indexing the fields separately results in smaller index & faster searching
      this._index.add(doc[this._ref], doc[this._fields[i]])
    }
  }

  search = (query) => {
    // returns a list of keys
    return this._index.search(query)
  }
}


module.exports.Flexsearch = Flexsearch
module.exports.Elasticlunr = Elasticlunr