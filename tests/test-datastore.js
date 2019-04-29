import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import chai, { expect } from 'chai'
import Datastore from '../src/db';
import { AWS, MockStore } from '../src/storage'
import { Elasticlunr } from '../src/indexer'

chai.should();
chai.use(sinonChai);


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
  })

  describe('put', () => {
    const s3 = new AWS()
    const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}}
    sinon.stub(s3, 'writeDoc')
    const db = new Datastore({db: 'example', storage: s3, namespaces})

    it('should call storage backend', () => {
      let user = {id: 1, name: 'john', surname: 'doe', age: '28'}
      db.put('user', user, user.id)

      s3.writeDoc.should.have.callCount(1)
    })

    it('should generate correct key', () => {
      let user = {id: 1, name: 'john', surname: 'doe', age: '28'}
      db.put('user', user, user.id)

      let expectedKey = 'user/1/entity.json'
      s3.writeDoc.should.have.been.calledWith('example', expectedKey, user)
    })
  })

  describe('get', () => {
    const s3 = new AWS()
    const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}}
    sinon.stub(s3, 'readDoc').callsFake(() => {
      return Promise.resolve()
    })
    const db = new Datastore({db: 'example', storage: s3, namespaces})

    it('should call storage backend', () => {
      db.get('user', 1)
      s3.readDoc.should.have.callCount(1)
    })

    it('should generate correct key', () => {
      db.get('user', 1)
      let expectedKey = 'user/1/entity.json'
      s3.readDoc.should.have.been.calledWith('example', expectedKey)
    })
  })

  describe('loadIndex', () => {
    let db = null;
    
    beforeEach(() => {
      const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}}
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


    // it('should load the index only once', () => {
    //   // make sure we are starting with a clean slate
    //   expect(db._indexer._index).to.be.null

    //   return db.filter('user', 'some query').then((res) => {
    //     db._storage.readDoc.should.have.callCount(1)
    //     expect(db._indexer._index).to.not.be.null
    //   })
    // })
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

    it('should return a promise', () => {
      let a = db.index('user', 'doc_key', user)
      expect(a.then).to.not.be.undefined
    })
  })

  describe('filter', () => {
    const namespaces = {user: {indexer: new Elasticlunr(['name'], '_id')}}
    const db = new Datastore({db: 'example', namespaces})
    // we need to stub the index load
    sinon.stub(db._storage, 'readDoc').callsFake(() => Promise.resolve({}))

    // stub the search call to spy on it
    sinon.stub(db.namespaces.user.indexer, 'search').callsFake(() => Promise.resolve({}))

    it('should throw error for unknown namespace', () => {
      expect(() => {
        db.filter('bad_namespace', 'some query')
      }).to.throw("No indexer for namespace 'bad_namespace' defined")
    })

    it('should call index backend search', () => {
      return db.filter('user', 'some query').then(res => {
        db.namespaces.user.indexer.search.should.have.callCount(1)
        db.namespaces.user.indexer.search.should.have.been.calledWith('some query')
      })
    })

    it('should return a promise', () => {
      let a = db.filter('user', 'some query')
      expect(a.then).to.not.be.undefined
    })
  })

  describe('list', () => {
    const db = new Datastore({db: 'example'})
    sinon.stub(db._storage, 'listDocs').callsFake(() => {
      return Promise.resolve({results: []})
    })

    it('should call storage backend listDocs', () => {
      db.list('users')
      db._storage.listDocs.should.have.callCount(1)
      db._storage.listDocs.should.have.been.calledWith('example', 'users')
    })
  })
})