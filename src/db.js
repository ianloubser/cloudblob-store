import {MockStore} from './storage'
import uuid4 from 'uuid/v4'
import uuidParse from 'uuid-parse'

class Datastore {

  /**
   * Create a datastore intance
   * @param {Object} params 
   */
  constructor(params={}) {
    const {db, ...clean} = params

    if (!db)
      throw Error("Expected 'db' name to be specified")

    this._bucket = db

    this._cache = clean.cache
    
    if (clean.storage)
      this._storage = clean.storage
    else
      this._storage = new MockStore()

    this._storage.initConnection()

    if (clean.namespaces)
      this._indexer = clean.namespaces
    else
      this._indexer = {}
  }

  
  /**
   * Load a serialized index into memory for specified namespace.
   * 
   * @param {String}} namespace Namespace who's index should be loaded into memory
   * @returns Promise
   */
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
   * Generate a uuid4 and return as hex string to use for entity ID.
   * 
   * @returns String
   */
  _generateId = () => {
    return uuidParse.parse(uuid4(), Buffer.alloc(16)).toString('hex')
  }


  /**
   * Fetch an entity with key from a specified namespace. If no
   * entity cached doesn't return anything.
   * 
   * @param {String} namespace The namespace of key
   * @param {String} key The hex uuid4 key of the entity
   * @returns Promise or Undefined
   */
  _loadFromCache = (namespace, key) => {
    if (this._cache) {
      this._cache.get([namespace, key].join('/'), (err, val) => {
        if (!err)
          return Promise.resolve(JSON.parse(val))
      })
    }
  }

  /**
   * If cache is configured, caches the provided doc with 'namespace/key' as
   * cache backend reference.
   * 
   * @param {String} namespace The namespace in which to cache the entity
   * @param {String} key The key of the entity
   * @param {Object} doc The raw object as stored to cache
   */
  _cacheEntity = (namespace, key, doc) => {
    if (this._cache)
      this._cache.set([namespace, key].join('/'), JSON.stringify(doc))
  }

  /**
   * Serialize the namespace's index and dump to storage backend.
   * 
   * @param {String} namespace The namespace who's index to dump
   * @returns Promise
   */
  dumpIndex = (namespace) => {
    if (Object.keys(this._indexer).indexOf(namespace)<0)
      throw Error(`No indexer for namespace '${namespace}' defined`)

    const key = [namespace, this._indexer[namespace]._indexPath].join('/')
    return this._storage.writeDoc(this._bucket, key, this._indexer[namespace].serialize()).then(res => {
      if (res.success)
        this._indexer[namespace].setClean()
    })
  }

  /**
   * Remove the namespace index loaded into memory. This call doesn't make any changes
   * to the actual index.
   * 
   * @param {String} namespace The namespace index to reset
   * @param {Boolean} saveFirst Whether the index should be dumped before clearing. Defaults to false
   */
  clearIndex = (namespace, saveFirst=false) => {
    if (Object.keys(this._indexer).indexOf(namespace)<0)
      throw Error(`No indexer for namespace '${namespace}' defined`)

    if (saveFirst && this._indexer[namespace].isDirty())
      this.dumpIndex(namespace).then(() => this._indexer[namespace].reset())
    else 
      this._indexer[namespace].reset()
  }

  exists = (namespace, key) => {
    // return a check for entity existence
    const fullKey = this._storage._buildKey(namespace, key)
    return this._storage.headDoc(this._bucket, fullKey)
  }

  /**
   * Saves a provided document under specified namespace. Optionally override key
   * generation with pre-generated key. Yes this is actually useful, it's used for 
   * the clob-server-auth package to enforce unique email users.
   * 
   * @param {String} namespace Namespace to store document
   * @param {String} doc The document object to serialize and store
   * @param {String} key (optional) Manually specify an entity key.
   * @returns Promise
   */
  put = (namespace, doc, key) => {
    // there can be some use cases where a user would want to manage reference theirself
    let _id = key
    if (!_id) {
      _id = this._generateId()
      doc[this._indexer[namespace]._ref] = _id
    }

    const fullKey = this._storage._buildKey(namespace, _id)
    return this._storage.writeDoc(this._bucket, fullKey, doc)
  }

  /**
   * Read a document. If cache configured check cache first otherwise read from storage
   * backend and then add to cache with default cache expiry set.
   * 
   * @param {String} namespace Document namespace
   * @param {String} key Document reference key
   * @returns Promise
   */
  get = (namespace, key) => {
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

  /**
   * Index the provided doc en specified namespace for searching later.
   * 
   * @param {String} namespace The namespace who's indexer should be used.
   * @param {String} doc The document object to index
   * @returns Promise
   */
  index = (namespace, doc) => {
    const self = this
    return this.loadIndex(namespace).then(() => self._indexer[namespace].add(doc))
  }

  /**
   * Filter the namespace documents by query. Returning either just document keys
   * or full documents as specified.
   * 
   * @param {String} namespace The namespace to search
   * @param {String} query The search query
   * @param {Boolean} keysOnly Return only keys to matches or full documents stored. Default true
   * @returns Promise
   */
  filter = (namespace, query, keysOnly=true) => {
    const self = this
    
    return this.loadIndex(namespace).then(() => {
      const results = self._indexer[namespace].search(query)
      if (keysOnly) {
        return {'results': results}
      } else {
        let getKeys = results.map(key => this.get(namespace, key))
      
        return Promise.all(getKeys).then(data => {
          return {'results': data}
        })
      }
    })
  }

  /**
   * Lists documents in namespace limiting to max documents specified. WARNING this
   * method does not return reliable results everytime as this depends on the ordering
   * of storage backend response.
   * 
   * @param {String} namespace Namespace to list
   * @param {Integer} max Maximum number of documents to return
   * @returns Promise
   */
  list = (namespace, max) => {
    return this._storage.listDocs(this._bucket, namespace, max).then(res => {
      let getKeys = res.results.map(key => this.get(namespace, key))
      
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