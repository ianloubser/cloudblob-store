# clob-db

Node document store interface using cloud persistent storage as backend(Azure Blob storage, AWS S3 or Google Cloud Storage).

## Overview

Use `clob-db` as a hobbyist, for prototyping or even for scaling up & out. Our platform is completely open source, so when you find our service doesn't offer enough, export your project and host our stack yourself!

Offers indexing & search capabilities out the box through the help for libraries like, FlexSearch, Bulksearch and Elasticlunr.

## Why
Provider agnostic. You can use any of the big cloud service providers like Azure, AWS or Google Cloud. If none of these suit you, you can also host your own storage solution using libraries like MinIO.

## Example Usage

```
var Datastore = require('clob-db/db');

var config = {
    // AWS-sdk s3 client parameters
    ...
}

var store = new Datastore({
  storage: new S3(config),
  // specify the namespaces and their indexer class
  namespaces: {
    'user': new Flexsearch(['name', 'about', 'age'], 'id')
  }
});

var _id = 1
var user = {
    id: _id,
    name: 'John Doe',
    about: 'I'm a deceased person',
    age: '30'
}

// save a document
store.write('user', doc).then(console.log)

// index the document
store.index('user', _id, doc).then(console.log)

// read the document
store.read('user', _id).then(console.log)

// search namespace index (returns key only by default)
store.filter('user', 'John Doe').then(console.log)

// list namespace documents as paginated response
store.list('user').then(console.log)
```

