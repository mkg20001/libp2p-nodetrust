'use strict'

const LE = require('greenlock')
const storeCertbot = require('le-store-certbot')
const DnsChallenge = require('./dnsChallenge')
const cp = require('child_process')

const debug = require('debug')
const log = debug('nodetrust:letsencrypt')

const path = require('path')
const fs = require('fs')

const _FAKECERT = path.join(__dirname, '..', '..')
const read = (...f) => fs.readFileSync(path.join(_FAKECERT, ...f)).toString()

const multihashing = require('multihashing-async')
const domainBase = require('base-x')('abcdefghijklmnopqrstuvwxyz0123456789-')

const urls = {
  production: 'https://acme-v02.api.letsencrypt.org/directory',
  staging: 'https://acme-staging-v02.api.letsencrypt.org/directory'
}

function idToCN (id, zone, cb) { // TODO: maybe refactor this method as it could be attacked
  let pref = 'id0'
  let suf = '.' + zone
  multihashing(Buffer.from(id), 'sha3-224', (err, digest) => {
    if (err) return cb(err)
    id = domainBase.encode(digest).substr(0, 64 - pref.length - suf.length)
    cb(null, pref + id + suf)
  })
}

class Letsencrypt {
  constructor (opt) {
    if (opt.stub) {
      this.pem = { cert: read('cert.pem'), key: read('key.pem') }
    }

    const debug = log.enabled
    const leStore = storeCertbot.create({
      configDir: opt.storageDir,
      debug,
      log
    })

    this.email = opt.email

    const dns = new DnsChallenge(opt)

    this.le = LE.create({
      version: 'v02',
      server: urls[(opt.env || 'staging')] || opt.env,
      agreeTos: true,

      challenges: {
        'dns-01': dns
      },
      challengeType: 'dns-01',

      store: leStore,

      debug,
      log
    })

    this.le.acme._dig = (q) => new Promise((resolve, reject) => { // the nodeJS dns module seems to be buggy sometimes. use real dig.
      try {
        let records = cp.spawnSync('dig', ['+short', q.name, q.type, '@8.8.8.8'], {stdio: 'pipe'})
          .stdout.toString().split('\n').filter(s => Boolean(s.trim())).map(v => JSON.parse(v))
        resolve({ answer: records.map(data => { return { data: [data] } }) })
      } catch (e) {
        reject(e)
      }
    })
  }
  handleRequest (id, zone, domains, cb) {
    if (this.pem) {
      const params = {
        error: false,
        privkey: this.pem.key,
        cert: this.pem.cert,
        chain: this.pem.cert
      }
      return cb(null, params)
    }
    if (!domains.length) return cb(new Error('No domains specified!'))
    idToCN(id, zone, (err, cn) => {
      if (err) return cb(err)
      domains = [cn].concat(domains)
      log('issue: %s as %s', domains[0], domains.slice(1).join(', '))
      this.le.register({
        domains,
        email: this.email,
        agreeTos: true,
        rsaKeySize: 2048,
        challengeType: 'dns-01'
      }).then(res => cb(null, res), cb)
    })
  }
}

module.exports = Letsencrypt
