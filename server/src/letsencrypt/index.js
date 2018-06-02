'use strict'

const ACME = require('./acme')
const { URLS } = ACME
const Storage = require('./storage')
const prom = require('promisify-es6')
const idPrefix = prom(require('./idPrefix'))

class Letsencrypt {
  constructor (opt) {
    let serverUrl = URLS[(opt.env || 'staging')] || opt.env
    let storage = this.storage = new Storage(opt.storageDir)
    let acmeConf = {
      email: opt.email,
      serverUrl,
      storage,
      challenge: {
        type: 'dns-01',
        set: (auth) => opt.dns.addRecords('_acme-challenge.' + auth.identifier.value, [['TXT', auth.dnsAuthorization]]),
        remove: (auth) => opt.dns.deleteRecords('_acme-challenge.' + auth.identifier.value)
      }
    }
    this.acme = new ACME(acmeConf)
  }
  init (cb) {
    this.acme.init(cb)
  }
  handleRequest (id, zone, domains, cb) {
    idPrefix(id, zone)
      .then(prefix => {
        domains.unshift(prefix)
        this.acme.getCertificate(id, domains)
      }, cb)
  }
}

module.exports = Letsencrypt
