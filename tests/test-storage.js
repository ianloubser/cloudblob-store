const sinonChai = require('sinon-chai')
const chai = require('chai')
const { AWS } = require('../lib')

chai.should();
chai.use(sinonChai);
const expect = chai.expect

describe('Storage', () => {
  describe('constructor', () => {  
    
  })

  describe('readDoc', () => {
    const s3 = new AWS()
    s3.initConnection()

    it('should throw error if key not exist', () => {
      return s3.readDoc('example', 'user/2/entity.json').catch(err => {
        expect(err.message).to.be.equal("Key not found")
      })
    })
  })
})
