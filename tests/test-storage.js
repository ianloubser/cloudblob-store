import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import chai, { expect } from 'chai'
import { Storage, AWS } from '../src/storage'

chai.should();
chai.use(sinonChai);

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
