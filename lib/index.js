module.exports = {
  get db() {
    return require('./db')
  },

  get indexer() {
    return require('./indexer')
  },

  get storage() {
    return require('./storage')
  }
}