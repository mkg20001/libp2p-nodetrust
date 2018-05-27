'use strict'

const debug = require('debug')
const log = debug('nodetrust:letsencrypt:dns')
const crypto = require('crypto')
const createAuthDigest = keyAuthorization => crypto.createHash('sha256').update(keyAuthorization || '').digest('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

module.exports = class DNSChallenge {
  constructor (opt) {
    this.dns = opt.dns
    this.zone = opt.dns.zone
  }
  set (args, domain, challenge, keyAuthorization, cb) {
    domain = (args.test || '') + (args.acmeChallengeDns || '_acme-challenge.') + domain
    if (!domain.endsWith(this.zone)) return cb(new Error('Domain not in managed zone!'))
    this.dns.addRecords(domain, [['TXT', createAuthDigest(keyAuthorization)]]).then(cb, cb)
    log('deployed challenge for %s', domain)
  }
  get (defaults, domain, challenge, cb) {
    // This function is just a stub
    cb(null)
  }
  remove (args, domain, challenge, cb) {
    domain = (args.test || '') + (args.acmeChallengeDns || '_acme-challenge.') + domain
    this.dns.deleteRecords(domain).then(cb, cb)
    log('removed challenge for %s', domain)
  }
  getOptions () {
    return {
      dns: this.dns,
      zone: this.zone,
      acmeChallengeDns: '_acme-challenge.'
    }
  }

  loopback (opts, domain, token, cb) { // TODO: added this stub so greenlock STFU, does not seem needed...
    return cb()
  }

  test (args, domain, challenge, keyAuthorization, cb) { // TODO: added this stub so greenlock STFU, does not seem needed...
    return cb()
  }
}
