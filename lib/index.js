module.exports = {
  get Datastore() {
    return require('./db').Datastore
  },

  get Elasticlunr() {
    return require('./indexer').Elasticlunr
  },

  get Flexsearch() {
    return require('./indexer').Flexsearch
  },

  get AWS() {
    return require('./storage').AWS
  },

  get storage() {
    return require('./storage')
  }
}