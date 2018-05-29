'use strict'

/* eslint-env mocha */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

module.exports = get => {
  let client

  describe('wss-server', () => { // testing the wss-server
    before(() => (client = get().client))

    it('should launch a wss server', (done) => {
      process.env.SKIP_NAT = '1'
      client.start(err => {
        expect(err).to.not.exist()
        expect(client.wss).to.exist()
        done()
      })
    })
    it('should add the multiaddrs for that server')
    it('should be reachable over that address')
  })
}
