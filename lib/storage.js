const {S3, LexModelBuildingService} = require('aws-sdk')

class StorageBackend {

  constructor(params={}) {
    this._config = Object.assign({}, params)
  }

  initConnection = () => {
    this._connection = this._getConnection(this._config)
  }

  _buildKey = (namespace, key, parent=null) => {
    const filename = 'entity.json'
    
    let pre = [namespace, key, filename]
    if (parent)
      pre = [namespace, parent, key, filename]

    return pre.join("/")
  }
}


/**
 * Mock store for testing.
 */
class MockStore extends StorageBackend {
  constructor(params={}) {
    super(params)
    this._mock = {}
  }

  _getConnection = (config) => {
    return null
  }

  writeDoc = (bucket, key, doc) => {
    if (!this._mock[bucket])
      this._mock[bucket] = {}

    this._mock[bucket][key] = doc
    return Promise.resolve(doc)
  }

  headDoc = (bucket, key) => {
    if (!this._mock[bucket])
      this._mock[bucket] = {}
      
    return Promise.resolve(this._mock[bucket][key])
  }

  readDoc = (bucket, key) => {
    if (!this._mock[bucket])
      this._mock[bucket] = {}

    if (this._mock[bucket][key])
      return Promise.resolve(this._mock[bucket][key])
    else
      return Promise.reject('Key does not exist')
  }

  listDocs = (bucket, prefix, max) => {
    if (!this._mock[bucket])
      this._mock[bucket] = {}
    
    const data = Object.values(this._mock[bucket])
    // Object.entries(this)
    return Promise.resolve({
      next: null,
      results: data
    })
  }

}

class AWS extends StorageBackend {

  _getConnection = (config) => {
    return new S3(config)
  }

  _getKeyFromPath = (path) => {
    let k = path.split('/')
    if (k.length>1)
      return k[k.length-2]
    
    return null
  }

  headDoc = (bucket, key) => {
    return new Promise((resolve, reject) => {
      this._connection.headObject({Key: key, Bucket: bucket}, (err, data) => {
        if (data) {
          resolve(data.Metadata)
        } else{
          resolve(null)
        }
      })
    })
  }

  readDoc = (bucket, key) => {
    return this._connection.getObject({Key: key, Bucket: bucket}).promise()
      .then((data) => {
        return JSON.parse(Buffer.from(data.Body).toString())
      }).catch((err) => {
        throw new Error("Key not found")
      })
  }

  writeDoc = (bucket, key, doc) => {
    const Body = JSON.stringify(doc).toString('hex')
    return this._connection.putObject({Key: key, Bucket: bucket, Body}).promise()
      .then((data) => {
        // if (data.ETag)
        return doc
      }).catch((err) => {
        console.log("Could not write file "+key, err)
        return null
      })
  }

  listDocs = (bucket, namespace, max) => {
    return this._connection.listObjectsV2({Bucket: bucket, Prefix: namespace, MaxKeys:max}).promise()
      .then(data => {
        return {
          next: data.NextContinuationToken, 
          results: data.Contents.map(item => this._getKeyFromPath(item.Key))
        }
      })
  }
}

/**
 * Not implemented: Google Cloud backend
 */
class Azure extends StorageBackend {

}

/**
 * Not implemented: Google Cloud backend
 */
class Google extends StorageBackend {

}


module.exports.StorageBackend = StorageBackend
module.exports.MockStore = MockStore
module.exports.AWS = AWS
module.exports.Google = Google
module.exports.Azure = Azure