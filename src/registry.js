var store = null;

module.exports = {
  register: (store) => {
    store = store;
  },
  getDatastore: () => {
    if (!store)
      throw TypeError("Expected datastore to have been registered")
    
    return store
  }
}