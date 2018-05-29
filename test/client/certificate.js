'use strict'

/* eslint-env mocha */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

module.exports = get => {
  let client

  describe('certificate', () => { // testing the wss-server
    before(() => (client = get().client))

    it('should aquire a cert from letsencrypt', function (done) {
      this.timeout(30 * 1000)

      client._getCert((err, cert) => {
        expect(err).to.not.exist()
        // console.log(cert)
        expect(cert).to.exist()
        expect(cert.cert.certificate).to.exist()
        done()
      })
    })
  })
}
