'use strict'

const ACME = require('acme-v2')
const ACME_DIG = require('./dig')
const RSA = require('rsa-compat').RSA
const prom = require('promisify-es6')
const promCl = (cl, fnc) => prom(fnc.bind(cl))

const genKeyPair = prom((cb) => RSA.generateKeypair(2048, null, { pem: true, public: true, jwk: true }, cb))
const promiseFnc = ['init', 'getOrGenKey', 'genKey', 'registerAccount', 'obtainCertificate', 'getCertificate'] // TODO: find a better way to do this

const debug = require('debug')
const log = debug('nodetrust:letsencrypt:acme')

const URLS = {
  production: 'https://acme-v02.api.letsencrypt.org/directory',
  staging: 'https://acme-staging-v02.api.letsencrypt.org/directory'
}

class LetsencryptACME {
  constructor (opt) {
    this.opt = opt
    this.storage = opt.storage
    this.challenge = opt.challenge
    this.acme = ACME.ACME.create({debug: true})
    this.acme._dig = ACME_DIG
    promiseFnc.forEach(name => (this[name] = promCl(this, this[name])))
  }

  getOrGenKey (keyid, cb) {
    if (this.storage.exists('key', keyid)) return cb(null, this.storage.readJSON('key', keyid))
    return this.genKey(keyid, cb)
  }
  genKey (keyid, cb) {
    genKeyPair((err, pair) => {
      if (err) return cb(err)
      this.storage.writeJSON('key', keyid, pair)
      cb(null, pair)
    })
  }

  init (cb) {
    this.acme.init(this.opt.serverUrl)
      .then(() => this.registerAccount(this.opt.email), cb)
      .then((account) => {
        Object.assign(this, account)
        this.acme._kid = account.account.key.kid
        cb()
      }, cb)
  }

  registerAccount (email, cb) {
    this.getOrGenKey('ac-key', (err, accountKeypair) => {
      if (err) return cb(err)
      let account = this.storage.readJSON('ac-data')
      if (account) return cb(null, {account, accountKeypair})
      log('creating account')
      this.acme.accounts.create({
        email,
        accountKeypair: accountKeypair,
        agreeToTerms: tosUrl => Promise.resolve(tosUrl)
      }).then(account => {
        this.storage.writeJSON('ac-data', account)
        cb(null, {account, accountKeypair})
      }, cb)
    })
  }

  obtainCertificate (id, domainKeypair, domains, cb) { // TODO: save authorizations to save time // TODO: fix race conditions
    const {accountKeypair} = this
    log('obtain certificate %s', domains.join(', '))
    this.acme.certificates.create({
      domainKeypair,
      accountKeypair,
      domains,
      challengeType: this.challenge.type,
      setChallenge: this.challenge.set,
      removeChallenge: this.challenge.remove
    }).then(certs => {
      let {cert, ca, chain, expires} = certs
      let res = {
        error: false,
        domains,
        cn: domains[0],
        altnames: domains.slice(1),
        privkey: domainKeypair.privateKeyPem,
        cert,
        chain,
        ca,
        validity: Date.parse(expires)
      }
      this.storage.writeJSON(...id, res)
      cb(null, res)
    }, cb)
  }

  getCertificate (nodeID, domains, cb) {
    let certID = ['@' + nodeID, domains.join('!')]
    log('get certificate %s %s', nodeID, domains.join(', '))
    this.getOrGenKey('@' + nodeID)
      .then(domainKeypair => {
        let cert = this.storage.readJSON(...certID)
        if (!cert || Date.now() > (cert.validity - 60 * 60 * 1000)) return this.obtainCertificate(certID, domainKeypair, domains)
        else return Promise.resolve(cert)
      }, cb)
      .then(cert => cb(null, cert), cb)
  }
}

module.exports = LetsencryptACME
module.exports.URLS = URLS
