'use strict'

const ACME = require('acme-v2')
const ACME_DIG = require('./dig')
const Queue = require('./queue')
const RSA = require('rsa-compat').RSA
const prom = require('promisify-es6')
const promy = (fnc) => new Promise((resolve, reject) => fnc((err, res) => err ? reject(err) : resolve(res)))

const genKeyPair = prom((cb) => RSA.generateKeypair(2048, null, { pem: true, public: true, jwk: true }, cb))

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
    this.queue = new Queue()
    if (opt.validateWithDig) this.acme._dig = ACME_DIG
  }

  async getOrGenKey (keyid) {
    if (this.storage.exists('key', keyid)) return this.storage.readJSON('key', keyid)
    return this.genKey(keyid)
  }

  async genKey (keyid) {
    const pair = await genKeyPair()
    this.storage.writeJSON('key', keyid, pair)
    return pair
  }

  async init () {
    await this.acme.init(this.opt.serverUrl)
    const account = await this.registerAccount(this.opt.email)
    Object.assign(this, account)
    this.acme._kid = account.account.key.kid
  }

  async registerAccount (email) {
    const accountKeypair = await this.getOrGenKey('ac-key')
    let account = this.storage.readJSON('ac-data')
    if (account) return {account, accountKeypair}

    log('creating account')
    account = await this.acme.accounts.create({
      email,
      accountKeypair: accountKeypair,
      agreeToTerms: tosUrl => Promise.resolve(tosUrl)
    })
    this.storage.writeJSON('ac-data', account)
    return {account, accountKeypair}
  }

  async obtainCertificateReal (id, domainKeypair, domains) { // TODO: fix var overwrite race conditions in acme-v2
    const {accountKeypair} = this
    log('obtain certificate %s', domains.join(', '))
    const certs = await this.acme.certificates.create({
      domainKeypair,
      accountKeypair,
      domains,
      challengeType: this.challenge.type,
      setChallenge: this.challenge.set,
      removeChallenge: this.challenge.remove
    })
    let {cert, ca, chain, expires} = certs
    let res = {
      cert,
      chain,
      ca,
      key: domainKeypair.privateKeyPem,
      cn: domains[0],
      altnames: domains.slice(1),
      validity: Date.parse(expires)
    }
    this.storage.writeJSON(...id, res)
    return res
  }

  async obtainCertificate (id, domainKeypair, domains, cb) {
    let taskID = id + '@' + domains.join('!')
    return promy(cb => this.queue.aquireLock(taskID, domains, (cb) => this.obtainCertificateReal(id, domainKeypair, domains).then((res) => cb(null, res), cb), cb))
  }

  async getCertificate (nodeID, domains) {
    let certID = ['@' + nodeID, domains.join('!')]
    log('get certificate %s %s', nodeID, domains.join(', '))
    const domainKeypair = await this.getOrGenKey('@' + nodeID)
    let cert = this.storage.readJSON(...certID)
    if (!cert || Date.now() > (cert.validity - 60 * 60 * 1000)) return this.obtainCertificate(certID, domainKeypair, domains)
    cert.fromCache = true
    return cert
  }
}

module.exports = LetsencryptACME
module.exports.URLS = URLS
