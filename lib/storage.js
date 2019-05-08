"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Azure = exports.Google = exports.AWS = exports.MockStore = exports.StorageBackend = void 0;

var _awsSdk = require("aws-sdk");

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var StorageBackend = function StorageBackend() {
  var _this = this;

  var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  _classCallCheck(this, StorageBackend);

  _defineProperty(this, "initConnection", function () {
    _this._connection = _this._getConnection(_this._config);
  });

  _defineProperty(this, "_buildKey", function (namespace, key) {
    var parent = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var filename = 'entity.json';
    var pre = [namespace, key, filename];
    if (parent) pre = [namespace, parent, key, filename];
    return pre.join("/");
  });

  this._config = Object.assign({}, params);
};
/**
 * Mock store for testing.
 */


exports.StorageBackend = StorageBackend;

var MockStore =
/*#__PURE__*/
function (_StorageBackend) {
  _inherits(MockStore, _StorageBackend);

  function MockStore() {
    var _this2;

    var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, MockStore);

    _this2 = _possibleConstructorReturn(this, _getPrototypeOf(MockStore).call(this, params));

    _defineProperty(_assertThisInitialized(_this2), "_getConnection", function (config) {
      return null;
    });

    _defineProperty(_assertThisInitialized(_this2), "writeDoc", function (bucket, key, doc) {
      if (!_this2._mock[bucket]) _this2._mock[bucket] = {};
      _this2._mock[bucket][key] = doc;
      return Promise.resolve(doc);
    });

    _defineProperty(_assertThisInitialized(_this2), "headDoc", function (bucket, key) {
      if (!_this2._mock[bucket]) _this2._mock[bucket] = {};
      return Promise.resolve(Boolean(_this2._mock[bucket][key]));
    });

    _defineProperty(_assertThisInitialized(_this2), "readDoc", function (bucket, key) {
      if (!_this2._mock[bucket]) _this2._mock[bucket] = {};
      if (_this2._mock[bucket][key]) return Promise.resolve(_this2._mock[bucket][key]);else return Promise.reject('Key does not exist');
    });

    _defineProperty(_assertThisInitialized(_this2), "listDocs", function (bucket, prefix, max) {
      if (!_this2._mock[bucket]) _this2._mock[bucket] = {};
      var data = Object.values(_this2._mock[bucket]); // Object.entries(this)

      return Promise.resolve({
        next: null,
        results: data
      });
    });

    _this2._mock = {};
    return _this2;
  }

  return MockStore;
}(StorageBackend);

exports.MockStore = MockStore;

var AWS =
/*#__PURE__*/
function (_StorageBackend2) {
  _inherits(AWS, _StorageBackend2);

  function AWS() {
    var _getPrototypeOf2;

    var _this3;

    _classCallCheck(this, AWS);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this3 = _possibleConstructorReturn(this, (_getPrototypeOf2 = _getPrototypeOf(AWS)).call.apply(_getPrototypeOf2, [this].concat(args)));

    _defineProperty(_assertThisInitialized(_this3), "_getConnection", function (config) {
      return new _awsSdk.S3(config);
    });

    _defineProperty(_assertThisInitialized(_this3), "_getKeyFromPath", function (path) {
      var k = path.split('/');
      if (k.length > 1) return k[k.length - 2];
      return null;
    });

    _defineProperty(_assertThisInitialized(_this3), "headDoc", function (bucket, key) {
      return new Promise(function (resolve, reject) {
        _this3._connection.headObject({
          Key: key,
          Bucket: bucket
        }, function (err, data) {
          if (data) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      });
    });

    _defineProperty(_assertThisInitialized(_this3), "readDoc", function (bucket, key) {
      return _this3._connection.getObject({
        Key: key,
        Bucket: bucket
      }).promise().then(function (data) {
        return JSON.parse(Buffer.from(data.Body).toString());
      })["catch"](function (err) {
        throw new Error("Key not found");
      });
    });

    _defineProperty(_assertThisInitialized(_this3), "writeDoc", function (bucket, key, doc) {
      var Body = JSON.stringify(doc).toString('hex');
      return _this3._connection.putObject({
        Key: key,
        Bucket: bucket,
        Body: Body
      }).promise().then(function (data) {
        // if (data.ETag)
        return doc;
      })["catch"](function (err) {
        console.log("Could not write file " + key, err);
        return {};
      });
    });

    _defineProperty(_assertThisInitialized(_this3), "listDocs", function (bucket, namespace, max) {
      return _this3._connection.listObjectsV2({
        Bucket: bucket,
        Prefix: namespace,
        MaxKeys: max
      }).promise().then(function (data) {
        return {
          next: data.NextContinuationToken,
          results: data.Contents.map(function (item) {
            return _this3._getKeyFromPath(item.Key);
          })
        };
      });
    });

    return _this3;
  }

  return AWS;
}(StorageBackend);

exports.AWS = AWS;

var Azure =
/*#__PURE__*/
function (_StorageBackend3) {
  _inherits(Azure, _StorageBackend3);

  function Azure() {
    _classCallCheck(this, Azure);

    return _possibleConstructorReturn(this, _getPrototypeOf(Azure).apply(this, arguments));
  }

  return Azure;
}(StorageBackend);

exports.Azure = Azure;

var Google =
/*#__PURE__*/
function (_StorageBackend4) {
  _inherits(Google, _StorageBackend4);

  function Google() {
    _classCallCheck(this, Google);

    return _possibleConstructorReturn(this, _getPrototypeOf(Google).apply(this, arguments));
  }

  return Google;
}(StorageBackend);

exports.Google = Google;