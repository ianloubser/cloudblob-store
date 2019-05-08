"use strict";

var _storage = require("./storage");

var _v = _interopRequireDefault(require("uuid/v4"));

var _uuidParse = _interopRequireDefault(require("uuid-parse"));

var _util = require("util");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Datastore =
/**
 * Create a datastore intance
 * @param {Object} params 
 */
function Datastore() {
  var _this = this;

  var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  _classCallCheck(this, Datastore);

  _defineProperty(this, "_generateId", function () {
    return _uuidParse["default"].parse((0, _v["default"])(), Buffer.alloc(16)).toString('hex');
  });

  _defineProperty(this, "checkNS", function (namespace) {
    if (_this.namespaces[namespace]) {
      return true;
    } else {
      throw new Error("Expected namespace '".concat(namespace, "' to be configured"));
    }
  });

  _defineProperty(this, "_loadFromCache", function (namespace, key) {
    if (_this._cache) {
      var getAsync = (0, _util.promisify)(_this._cache.get).bind(_this._cache);
      return getAsync([namespace, key].join('/')).then(function (val) {
        return JSON.parse(val);
      });
    }

    return Promise.resolve(null);
  });

  _defineProperty(this, "cacheEntity", function (namespace, key, doc, expiry) {
    var expire = _this._cacheExpiry;
    if (expiry) expire = expiry;

    if (_this._cache) {
      _this._cache.set([namespace, key].join('/'), JSON.stringify(doc), 'EX', expire);

      return true;
    }

    return false;
  });

  _defineProperty(this, "exists", function (namespace, key) {
    // return a check for entity existence
    var fullKey = _this._storage._buildKey(namespace, key);

    return _this._storage.headDoc(_this._bucket, fullKey);
  });

  _defineProperty(this, "put", function (namespace, doc, key) {
    // there can be some use cases where a user would want to manage reference themself.
    // Yes this is actually useful, it's used for the cloudblob-auth package to enforce unique email users.
    var _id = key;

    if (!_id) {
      _id = _this._generateId();
      doc[_this.namespaces[namespace].ref] = _id;
    }

    var fullKey = _this._storage._buildKey(namespace, _id);

    return _this._storage.writeDoc(_this._bucket, fullKey, doc);
  });

  _defineProperty(this, "get", function (namespace, key) {
    var fullKey = _this._storage._buildKey(namespace, key);

    var cached = _this._loadFromCache(namespace, key);

    return cached.then(function (res) {
      if (res) return res;else {
        return _this._storage.readDoc(_this._bucket, fullKey).then(function (res) {
          _this.cacheEntity(namespace, key, res);

          return res;
        });
      }
    });
  });

  _defineProperty(this, "index", function (namespace, doc) {
    var self = _this;
    return _this.loadIndex(namespace).then(function () {
      return self.namespaces[namespace].indexer.add(doc);
    });
  });

  _defineProperty(this, "filter", function (namespace, query) {
    var keysOnly = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var self = _this;
    return _this.loadIndex(namespace).then(function () {
      var results = self.namespaces[namespace].indexer.search(query);

      if (keysOnly) {
        return {
          'results': results
        };
      } else {
        var getKeys = results.map(function (key) {
          return _this.get(namespace, key);
        });
        return Promise.all(getKeys).then(function (data) {
          return {
            'results': data
          };
        });
      }
    });
  });

  _defineProperty(this, "list", function (namespace, max) {
    return _this._storage.listDocs(_this._bucket, namespace, max).then(function (res) {
      var getKeys = res.results.map(function (key) {
        return _this.get(namespace, key);
      });
      return Promise.all(getKeys).then(function (data) {
        return {
          next: data.NextContinuationToken,
          results: data
        };
      });
    });
  });

  _defineProperty(this, "loadIndex", function (namespace) {
    try {
      _this.checkNS(namespace);
    } catch (err) {
      return Promise.reject(err.message);
    }

    if (!_this.namespaces[namespace].indexer) return Promise.reject("No indexer for namespace '".concat(namespace, "' defined"));
    var self = _this;

    if (!_this.namespaces[namespace].indexer._index) {
      var key = [namespace, _this.namespaces[namespace].indexer._indexPath].join('/');
      return _this._storage.readDoc(_this._bucket, key).then(function (docBody) {
        self.namespaces[namespace].indexer.load(docBody);
      });
    } else {
      // index has already been loaded, just return it as a promise
      return Promise.resolve();
    }
  });

  _defineProperty(this, "dumpIndex", function (namespace) {
    if (!_this._persist) return Promise.resolve(false);

    try {
      _this.checkNS(namespace);
    } catch (err) {
      return Promise.reject(err.message);
    }

    if (!_this.namespaces[namespace].indexer) return Promise.reject("No indexer for namespace '".concat(namespace, "' defined"));
    var key = [namespace, _this.namespaces[namespace].indexer._indexPath].join('/');
    return _this._storage.writeDoc(_this._bucket, key, _this.namespaces[namespace].indexer.serialize()).then(function (res) {
      var success = Object.values(res).length > 0;
      if (success) _this.namespaces[namespace].indexer.setClean();
      return success;
    });
  });

  _defineProperty(this, "flushIndex", function (namespace) {
    var saveFirst = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    if (saveFirst) return _this.dumpIndex(namespace).then(function () {
      return _this.namespaces[namespace].indexer.reset();
    });
    return Promise.resolve(_this.namespaces[namespace].indexer.reset());
  });

  if (!params.db) throw Error("Expected 'db' name to be specified");
  this._bucket = params.db;
  this._cacheExpiry = 60 * 60; // 1 hour

  if (params.cache && params.cache.client) {
    this._cache = params.cache.client;
    if (params.cache.expiry) this._cacheExpiry = params.cache.expiry;
  } else this._cache = params.cache;

  if (params.storage) this._storage = params.storage;else this._storage = new _storage.MockStore();

  this._storage.initConnection();

  if (params.namespaces) this.namespaces = params.namespaces;else this.namespaces = {}; // whether the search indexes should be persisted to disk. defaults to false

  this._persist = Boolean(params.persist);
}
/**
 * Generate a uuid4 and return as hex string to use for entity ID.
 * 
 * @returns {String}
 */
;

module.exports = Datastore;