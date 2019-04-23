import {AWS} from './storage'
import uuid4 from 'uuid/v4'
import uuidParse from 'uuid-parse'

class Datastore {

  constructor(params={}) {
    const {db, ...clean} = params

    if (!db)
      throw Error("Expected 'db' name to be specified")

    this._bucket = db

    this._cache = clean.cache
    
    if (clean.storage)
      this._storage = clean.storage
    else
      this._storage = new AWS({bucket: db})

    this._storage.initConnection()

    if (clean.namespaces)
      this._indexer = clean.namespaces
    else
      this._indexer = {}
  }

  loadIndex = (namespace) => {
    if (Object.keys(this._indexer).indexOf(namespace)<0)
      throw Error(`No indexer for namespace '${namespace}' defined`)

    const self = this

    if (!this._indexer[namespace]._index) {
      const key = [namespace, this._indexer[namespace]._indexPath].join('/')

      return this._storage.readDoc(this._bucket, key).then(docBody => {
        self._indexer[namespace].load(docBody)
      })
    } else {
      // index has already been loaded, just return it as a promise
      return new Promise((resolve, reject) => resolve())
    }
  }

  /**
   * generate a uuid4 and return as hex
   */
  _generateId = () => {
    return uuidParse.parse(uuid4(), Buffer.alloc(16)).toString('hex')
  }

  _loadFromCache = (namespace, key) => {
    if (this._cache) {
      this._cache.get([namespace, key].join('/'), (err, val) => {
        if (!err)
          return Promise.resolve(JSON.parse(val))
      })
    }
  }

  _cacheEntity = (namespace, key, doc) => {
    if (this._cache)
      this._cache.set([namespace, key].join('/'), JSON.stringify(doc))
  }

  dumpIndex = (namespace) => {
    if (Object.keys(this._indexer).indexOf(namespace)<0)
      throw Error(`No indexer for namespace '${namespace}' defined`)

    const key = [namespace, this._indexer[namespace]._indexPath].join('/')
    return this._storage.writeDoc(this._bucket, key, this._indexer[namespace].serialize()).then(res => {
      if (res.success)
        this._indexer[namespace].setClean()
    })
  }

  clearIndex = (namespace, saveFirst=false) => {
    if (Object.keys(this._indexer).indexOf(namespace)<0)
      throw Error(`No indexer for namespace '${namespace}' defined`)

    if (saveFirst && this._indexer[namespace].isDirty())
      this.dumpIndex(namespace).then(() => this._indexer[namespace].reset())
    else 
      this._indexer[namespace].reset()
  }

  write = (namespace, doc, key) => {
    // there can be some use cases where a user would want to manage reference theirself
    let _id = key
    if (!_id)
     _id = this._generateId()

    const fullKey = this._storage._buildKey(namespace, _id)
    doc[this._indexer[namespace]._ref] = _id
    
    return this._storage.writeDoc(this._bucket, fullKey, doc)
  }

  read = (namespace, key) => {
    const fullKey = this._storage._buildKey(namespace, key)
    const cached = this._loadFromCache(namespace, key)
    
    if (cached)
      return cached

    return this._storage.readDoc(this._bucket, fullKey)
      .then(res => {
        this._cacheEntity(namespace, key, res)
        return res
      })
  }

  index = (namespace, doc) => {
    const self = this
    return this.loadIndex(namespace).then(() => self._indexer[namespace].add(doc))
  }

  filter = (namespace, query, keysOnly=true) => {
    const self = this
    
    return this.loadIndex(namespace).then(() => {
      return {'results': self._indexer[namespace].search(query)}
    })
  }

  list = (namespace, max) => {
    return this._storage.listDocs(this._bucket, namespace, max).then(res => {
      let getKeys = res.results.map(key => this.read(namespace, key))
      
      return Promise.all(getKeys).then(data => {
        return {
          next: data.NextContinuationToken, 
          results: data
        }
      })
    })
  }
}

module.exports = Datastore