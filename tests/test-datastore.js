const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chai = require('chai')
const { Datastore } = require('../lib/db')
const { AWS, MockStore } = require('../lib/storage')
const { Elasticlunr } = require('../lib/indexer')

chai.should();
chai.use(sinonChai);
const expect = chai.expect

describe('Datastore', () => {

  describe('constructor', () => {
    it('constructor overrides', () => {
      class Example extends MockStore {}
      class Indexer extends Elasticlunr {}

      let ex = new Example()
      let namespaces = {
        model: {indexer: new Indexer()}
      }
      let db = new Datastore({db: 'example-db', storage: ex, namespaces})

      expect(db._bucket).to.be.equal('example-db')
      expect(db._storage.constructor.name).to.be.equal('Example')

      expect(db.namespaces.model.indexer).to.not.be.undefined
      expect(db.namespaces.model.indexer).to.be.instanceOf(Indexer)
    })
  
    it('default constructor values', () => {
      let db = new Datastore({db: 'someDB'})
      
      // check datastore defaults
      expect(db._bucket).to.be.equal('someDB')
      
      // check storage defaults
      expect(db._storage.constructor.name).to.be.equal('MockStore')

      // check indexer defaults
      expect(db.namespaces).to.be.empty
    })

    it('throws error if bucket not specified', () => {
      expect(() => {
        new Datastore()
      }).to.throw("Expected 'db' name to be specified")
    })

    it('should check config for cache object', () => {
      const mockCache = {
        get: sinon.spy(),
        set: sinon.spy()
      }
      let db1 = new Datastore({db: 'someDB', cache: {client: mockCache, expiry: 60*3}})

      expect(db1._cacheExpiry).to.be.equal(60*3)

      expect(db1._cache.set.called).to.be.false
      db1._cache.set()
      expect(db1._cache.set.called).to.be.true

      mockCache.set.resetHistory()

      let db2 = new Datastore({db: 'someDB', cache: {client: mockCache}})
      expect(db2._cacheExpiry).to.be.equal(60*60)

      expect(db2._cache.set.called).to.be.false
      db2._cache.set()
      expect(db2._cache.set.called).to.be.true
    })
  })

  /**
   * Tests for operations on documents/entities
   */
  describe('meta', () => {
    const db = new Datastore({db: 'example'})
    sinon.stub(db._storage, 'headDoc').callsFake(() => {
      return Promise.resolve({_id: "1"})
    })

    it('should call storage backend head method', () => {
      return db.meta('user', '1234').then(res => {
        expect(res._id).to.be.equal('1')
        db._storage.headDoc.should.have.been.calledWith('example', 'user/1234/entity.json')
      })
    })
  })

  describe('put', () => {
    const db = new Datastore({db: 'example', namespaces: {user: {ref: 'id'}}})
    let stub = sinon.stub(db._storage, 'writeDoc')

    beforeEach(() => {
      stub.reset()
    })

    it('should call storage backend', () => {

      let user = {id: 1, name: 'john', surname: 'doe', age: '28'}
      db.put('user', user, user.id)

      db._storage.writeDoc.should.have.callCount(1)
    })

    it('should generate correct key', () => {
      let user = {name: 'jack', surname: 'johnson', age: '28'}

      stub.callsFake((...args) => {
        expect(args[0]).to.be.equal('example')
        expect(args[2]).to.deep.equal(user)
        
        // make sure the key was generated correctly
        // expect(args[1]).to.be.undefined
        expect(/user\/([a-f0-9]{2}){16}\/entity\.json/i.test(args[1])).to.be.true
      })
      
      db.put('user', user)
    })

    it('should allow key override', () => {
      let user = {id: 1, name: 'jack', surname: 'johnson', age: '28'}

      stub.callsFake((...args) => {
        expect(args[0]).to.be.equal('example')
        expect(args[2]).to.deep.equal(user)
        
        // make sure the key was overloaded
        expect(args[1]).to.be.equal('user/1/entity.json')
      })

      db.put('user', user, user.id)
    })
  })

  describe('get', () => {
    const s3 = new AWS()
    const mockCache = {
      get: (key, cb) => {
        if (key === 'user/1')
          cb(null, JSON.stringify({_id: key, user: "John"}))
        else
          cb(null, null)
      },
      set: sinon.spy()
    }
    const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}}
    let stub = sinon.stub(s3, 'readDoc').callsFake(() => {
      return Promise.resolve({fake: true})
    })
    const db = new Datastore({db: 'example', storage: s3, namespaces})

    beforeEach(() => {
      stub.resetHistory()
    })

    it('should call storage backend without cache', () => {
      return db.get('user', 1).then((res) => {
        s3.readDoc.should.have.callCount(1)
      })
    })

    it('should generate correct key', () => {
      return db.get('user', 1).then(res => {
        let expectedKey = 'user/1/entity.json'
        s3.readDoc.should.have.been.calledWith('example', expectedKey)
      })
    })

    it('should load = require(storage and cache if cache miss', () => {
      const tmp = new Datastore({db: 'example', storage: s3, namespaces, cache:mockCache})
      // sinon.stub(mockCache, 'set').callsFake((...args) => {

      // })

      return tmp.get('user', 2).then(res => {
        let expectedKey = 'user/2/entity.json'
        s3.readDoc.should.have.been.calledWith('example', expectedKey)

        // make sure the entity was cached
        expect(mockCache.set.calledOnce).to.be.true
      })
    })

    it('should load = require(cache if present', () => {
      const tmp = new Datastore({db: 'example', namespaces, cache:mockCache})

      return tmp.get('user', 1).then(res => {
        // make sure the backend wasn't called since loaded = require(cache
        s3.readDoc.should.have.callCount(0)

        expect(res.user).to.be.equal('John')
      })
    })
  })

  describe('index', () => {
    const user = {id: 1, name: 'john', surname: 'doe', age: '28'}
    const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}}
    const db = new Datastore({db: 'example', namespaces})
    // stub the index load aws call
    sinon.stub(db._storage, 'readDoc').callsFake(() => Promise.resolve({}))
    sinon.stub(db.namespaces.user.indexer, 'add')

    it('should call index backend add', () => {
      return db.index('user', user).then(res => {
        db.namespaces.user.indexer.add.should.have.callCount(1)
        db.namespaces.user.indexer.add.should.have.been.calledWith(user)
      })
    })

    it('should lazyload index and return a promise', () => {
      sinon.spy(db, 'loadIndex')
      let a = db.index('user', 'doc_key', user)
      // make sure a promise is returned
      expect(a.then).to.not.be.undefined

      return a.then(res => {
        expect(db.loadIndex.calledOnce).to.be.true
      })
    })
  })

  describe('filter', () => {
    const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}}
    const db = new Datastore({db: 'example', namespaces})
    // we need to stub the index load
    let readStub = sinon.stub(db._storage, 'readDoc').callsFake(() => Promise.resolve({}))

    // stub the search call to spy on it
    const fakeResult = ['1', '2', '3', '4', '5']
    let searchStub = sinon.stub(db.namespaces.user.indexer, 'search').returns(fakeResult)

    beforeEach(() => {
      readStub.resetHistory()
      searchStub.resetHistory()
    })

    it('should throw error for unknown namespace', () => {
      return db.filter('bad_namespace', 'some query').then(res => {
        throw new Error("Should not resolve")
      }, err => {
        expect(err).to.be.equals("Expected namespace 'bad_namespace' to be configured")
      })
    })

    it('should call index backend search', () => {
      return db.filter('user', 'some query').then(res => {
        db.namespaces.user.indexer.search.should.have.callCount(1)
        db.namespaces.user.indexer.search.should.have.been.calledWith('some query')
      })
    })

    it('should return keys only by default', () => {
      let spy = sinon.spy(db, 'get')
      return db.filter('user', 'some query').then(res => {
        expect(db.get.notCalled).to.be.true
        spy.restore()
      })
    })

    it('should return docs if keysOnly false', () => {
      let stub = sinon.stub(db, 'get').callsFake(_ => {
        return Promise.resolve({fake: true})
      })

      return db.filter('user', 'some query', false).then(res => {
        stub.should.have.callCount(5)
      })
    })

    it('should lazyload index and return a promise', () => {
      sinon.spy(db, 'loadIndex')
      let a = db.filter('user', 'some query')
      expect(a.then).to.not.be.undefined

      return a.then(res => {
        expect(db.loadIndex.calledOnce).to.be.true
      })
    })
  })

  describe('list', () => {
    const db = new Datastore({db: 'example'})
    sinon.stub(db._storage, 'listDocs').callsFake(() => {
      return Promise.resolve({results: [1, 2, 3, 4, 5]})
    })

    const getStub = sinon.stub(db, 'get').callsFake(() => {
      return Promise.resolve({fake: true})
    })

    it('should call storage backend listDocs', () => {
      return db.list('users').then(res => {
        db._storage.listDocs.should.have.callCount(1)
        db._storage.listDocs.should.have.been.calledWith('example', 'users')

        // make sure each item ref is retreived.
        expect(getStub.callCount).to.be.equal(5)
      })
    })
  })

  /**
   * Tests operations on cache
   */
  describe('loadFromCache', () => {
    let db = null

    it('should resolve null if cache not configured', () => {
      db = new Datastore({db: 'example'})
      return db._loadFromCache('user', '1234').then(res => {
        expect(res).to.be.null
      })
    })

    it('should call cache get and return promise', () => {
      const mockCache = {
        get: (key, cb) => {
          cb(null, JSON.stringify({_id: key}))
        }
      }

      db = new Datastore({db: 'example', cache: mockCache})
      return db._loadFromCache('user', '1234').then(res => {
        expect(res).to.deep.equal({
          _id: 'user/1234'
        })
      })
    })
  })

  describe('cacheEntity', () => {
    let db = null
    const doc = {
      name: "John"
    }

    it('should return false if cache not configured', () => {
      db = new Datastore({db: 'example'})
      expect(db.cacheEntity('user', '1234', doc)).to.be.false
    })

    it('should call cache set method and return true, default expiry', () => {
      const mockCache = { set: (key, doc, cmd, exp) => true }
      sinon.stub(mockCache, 'set').callsFake((...args) => {
        // we assert the args here. Best way to assert objects eqaul
        expect(args[0]).to.be.equal('user/1234')
        expect(args[1]).to.be.equal(JSON.stringify(doc))
        expect(args[2]).to.be.equal('EX')

        // make sure cache set was called with correct params and default cache expiry (1 hour)
        expect(args[3]).to.be.equal(60*60)
      })

      db = new Datastore({db: 'example', cache: mockCache})

      expect(db.cacheEntity('user', '1234', doc)).to.be.true
    })

    it('should call cache set method and return true, override expiry', () => {
      const mockCache = { set: (key, doc, cmd, exp) => true }
      sinon.stub(mockCache, 'set').callsFake((...args) => {
        // we assert the args here. Best way to assert objects eqaul
        expect(args[0]).to.be.equal('user/1234')
        expect(args[1]).to.be.equal(JSON.stringify(doc))
        expect(args[2]).to.be.equal('EX')

        // Cache should be called with overriden expiry
        expect(args[3]).to.be.equal(60*5)
      })

      db = new Datastore({db: 'example', cache: mockCache})

      expect(db.cacheEntity('user', '1234', doc, 60*5)).to.be.true
    })
  })

  /**
   * Tests for operations on namespaces indexes
   */
  describe('loadIndex', () => {
    let db = null;
    
    beforeEach(() => {
      const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}, log: {ref: "id"}}
      db = new Datastore({db: 'example', namespaces})
      sinon.stub(db._storage, 'readDoc').callsFake(() => {
        return Promise.resolve({})
      })
    })

    it('should lazyload the index on index add', () => {
      // make sure we are starting with a clean slate
      expect(db.namespaces.user.indexer._index).to.be.null

      return db.index('user', 'doc_key', {}).then((res) => {
        db._storage.readDoc.should.have.callCount(1)
        expect(db.namespaces.user.indexer._index).to.not.be.null
      })
    })

    it('should lazyload the index on filter call', () => {
      // make sure we are starting with a clean slate
      expect(db.namespaces.user.indexer._index).to.be.null

      return db.filter('user', 'some query').then((res) => {
        db._storage.readDoc.should.have.callCount(1)
        expect(db.namespaces.user.indexer._index).to.not.be.null
      })
    })

    it('rejects if namespace not configured', () => {
      return db.loadIndex('bad_ns').then(res => {
        throw new Error("Was not supposed to pass")
      }, err => {
        expect(err).to.be.equal("Expected namespace 'bad_ns' to be configured")
      })
    })

    it('rejects if namespace not indexed', () => {
      return db.loadIndex('log').then(res => {
        throw new Error("Was not supposed to pass")
      }, err => {
        expect(err).to.be.equal("No indexer for namespace 'log' defined")
      })
    })

    // it('should load the index only once', () => {
      // make sure we are starting with a clean slate
      // expect(db.namespaces.user.indexer._index).to.be.null

      // return db.filter('user', 'some query').then((res) => {
      //   db._storage.readDoc.should.have.callCount(1)
      //   expect(db.namespaces.user.indexer._index).to.not.be.null
      // })
    // })
  })

  describe('dumpIndex', () => {
    const namespaces = {user: {
      indexer: new Elasticlunr(['name'], '_id'),
      ref: "_id"
    }, log: {ref: "_id"}}
    const db = new Datastore({db: 'example', namespaces})
    const writeStub = sinon.stub(db._storage, 'writeDoc')

    beforeEach(() => {
      db._persist = true
      writeStub.reset()
    })

    it('should not save index if persist is false', () => {
      db._persist = false
      return db.dumpIndex('user').then(res => {
        // make sure storage write call never fired
        expect(writeStub.called).to.be.false
        // make sure false is returned
        expect(res).to.be.false
      })
    })

    it('rejects if namespace not configured', () => {
      return db.dumpIndex('bad_ns').then(res => {
        throw new Error("Was not supposed to pass")
      }, err => {
        expect(err).to.be.equal("Expected namespace 'bad_ns' to be configured")
      })
    })

    it('rejects if namespace not indexed', () => {
      return db.dumpIndex('log').then(res => {
        throw new Error("Was not supposed to pass")
      }, err => {
        expect(err).to.be.equal("No indexer for namespace 'log' defined")
      })
    })

    it('resolves doc write success', () => {
      // init the in-memory index
      db.namespaces.user.indexer.load()
      writeStub.returns(Promise.resolve({index: true}))

      return db.dumpIndex('user').then(res => {
        expect(writeStub.callCount).to.be.equal(1)
        expect(res).to.be.true
      })
    })

    it('resolves doc write failure', () => {
      // init the in-memory index
      db.namespaces.user.indexer.load()
      writeStub.returns(Promise.resolve({}))

      return db.dumpIndex('user').then(res => {
        expect(writeStub.callCount).to.be.equal(1)
        expect(res).to.be.false
      })
    })
  })

  describe('flushIndex', () => {
    const namespaces = {user: {
      indexer: new Elasticlunr(['name'], '_id'),
      ref: "_id"
    }}
    const db = new Datastore({db: 'example', namespaces})
    const resetSpy = sinon.spy(db.namespaces.user.indexer, 'reset')
    const dumpStub = sinon.stub(db, 'dumpIndex').callsFake(_ => {
      return Promise.resolve(true)
    })

    beforeEach(() => {
      dumpStub.resetHistory()
      resetSpy.resetHistory()
      db.namespaces.user.indexer.load()
    })

    it('saves index first then resets', () => {
      return db.flushIndex('user', true).then(res => {
        expect(dumpStub.calledOnce).to.be.true
        expect(resetSpy.calledOnce).to.be.true
      })
    })

    it('resets the index',  () => {
      return db.flushIndex('user').then(res => {
        // make sure it doesn't save first by default
        expect(dumpStub.called).to.be.false
        expect(resetSpy.calledOnce).to.be.true
      })
    })
  })

  /**
   * Tests for utility methods
   */
  describe('checkNS', () => {
    const cfg = {
      db: 'example',
      namespaces: {
        user: {
          ref: 'id'
        }
      }
    }
    const db = new Datastore(cfg)

    it('should throw error for unconfigured namespace', () => { 
      expect(() => {
        db.checkNS('badNS')
      }).to.throw("Expected namespace 'badNS' to be configured")
    })

    it('should return true if namespace configured', () => {
      expect(db.checkNS('user')).to.be.true
    })
  })

  describe('_generateId', () => {
    const db = new Datastore({db: 'db'})

    it('should return a hex uuid4', () => {
      var hexStr = /([a-f0-9]{2}){16}/i
      const id = db._generateId()
      expect(hexStr.test(id)).to.be.true
    })
  })
})