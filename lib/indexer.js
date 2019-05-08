"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Elasticlunr = exports.Flexsearch = void 0;

var _elasticlunr = _interopRequireDefault(require("elasticlunr"));

var _flexsearch = _interopRequireDefault(require("flexsearch"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Elasticlunr = function Elasticlunr(_fields, _ref) {
  var _this = this;

  _classCallCheck(this, Elasticlunr);

  _defineProperty(this, "isDirty", function () {
    return _this._dirty;
  });

  _defineProperty(this, "setClean", function () {
    _this._dirty = false;
  });

  _defineProperty(this, "reset", function () {
    _this._index = null;
  });

  _defineProperty(this, "load", function (body) {
    try {
      _this._index = _elasticlunr["default"].Index.load(body);
    } catch (_unused) {
      _this.init(_this._fields, _this._ref);
    }
  });

  _defineProperty(this, "init", function (fields, ref) {
    _this._index = (0, _elasticlunr["default"])(function (idx) {
      // console.log(idx)
      for (var i in fields) {
        idx.addField(fields[i]);
      }

      idx.setRef(ref);
      idx.saveDocument(false);
    });
  });

  _defineProperty(this, "serialize", function () {
    if (!_this._index) throw Error("Tried to serialize an index not loaded yet");
    return _this._index.toJSON();
  });

  _defineProperty(this, "add", function (doc) {
    _this._dirty = true;
    return _this._index.addDoc(doc);
  });

  _defineProperty(this, "search", function (query) {
    // returns a list of keys
    return _this._index.search(query).map(function (item) {
      return item.ref;
    });
  });

  this._indexPath = 'el_index.json';
  this._index = null;
  this._fields = _fields;
  this._ref = _ref; // whether there are any unsaved indexes

  this._dirty = false;
};

exports.Elasticlunr = Elasticlunr;

var Flexsearch = function Flexsearch(fields, ref) {
  var _this2 = this;

  _classCallCheck(this, Flexsearch);

  _defineProperty(this, "isDirty", function () {
    return _this2._dirty;
  });

  _defineProperty(this, "setClean", function () {
    _this2._dirty = false;
  });

  _defineProperty(this, "reset", function () {
    _this2._index = null;
  });

  _defineProperty(this, "load", function (body) {
    try {
      _this2._index = new _flexsearch["default"]();

      _this2._index["import"](body);
    } catch (_unused2) {
      _this2.init(_this2._fields, _this2._ref);
    }
  });

  _defineProperty(this, "init", function (fields, ref) {
    _this2._index = _flexsearch["default"].create({
      tokenize: 'forward',
      cache: false
    });
  });

  _defineProperty(this, "serialize", function () {
    if (!_this2._index) throw Error("Tried to serialize an index not loaded yet");
    return _this2._index["export"]();
  });

  _defineProperty(this, "add", function (doc) {
    _this2._dirty = true;

    for (var i = 0; i < _this2._fields.length; i++) {
      // indexing the fields separately results in smaller index & faster searching
      _this2._index.add(doc[_this2._ref], doc[_this2._fields[i]]);
    }
  });

  _defineProperty(this, "search", function (query) {
    // returns a list of keys
    return _this2._index.search(query);
  });

  this._indexPath = 'flex_index.json';
  this._index = null;
  this._fields = fields;
  this._ref = ref; // whether there are any unsaved indexes

  this._dirty = false;
};

exports.Flexsearch = Flexsearch;