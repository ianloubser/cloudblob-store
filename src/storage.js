import {S3} from 'aws-sdk'


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

  readDoc = (bucket, key) => {
    if (this._mock[bucket] && this._mock[bucket][key]) {
      return Promise.resolve(this._mock[bucket][key])
    } else
      return Promise.resolve({})
  }

  listDocs = (bucket, prefix, max) => {
    const data = this._mock
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

  readDoc = (bucket, key) => {
    return this._connection.getObject({Key: key, Bucket: bucket}).promise()
      .then((data) => {
        return JSON.parse(Buffer.from(data.Body).toString())
      }).catch((err) => {
        console.log("Could not read file: "+err)
        return {}
      })
  }

  writeDoc = (bucket, key, doc) => {
    const Body = JSON.stringify(doc).toString('hex')
    return this._connection.putObject({Key: key, Bucket: bucket, Body}).promise()
      .then((data) => {
        // if (data.ETag)
        return doc
      }).catch((err) => {
        console.log("Could not write file: "+err)
        return {}
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

class Azure extends StorageBackend {

}

class Google extends StorageBackend {

}


export {
  StorageBackend, MockStore, AWS, Google, Azure
}