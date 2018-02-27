'use strict'

const LE = require('greenlock')
const storeCertbot = require('le-store-certbot')
const DnsChallenge = require('./dnsChallenge')
const sniChallenge = require('./fakeSni')

const debug = require('debug')
const log = debug('nodetrust:letsencrypt')

function leAgree (opts, agreeCb) {
  console.log('Agreeing to tos %s with email %s to obtain certificate for %s', opts.tosUrl, opts.email, opts.domains.join(', '))
  // opts = { email, domains, tosUrl }
  agreeCb(null, opts.tosUrl)
}

class Letsencrypt {
  constructor (opt) {
    const debug = log.enabled
    const leStore = storeCertbot.create({
      configDir: opt.storageDir,
      debug,
      log
    })

    this.email = opt.email

    const dns = new DnsChallenge(opt)
    const sni = sniChallenge.create({})

    this.le = LE.create({
      server: LE[(opt.env || 'staging') + 'ServerUrl'] || opt.env,
      store: leStore,
      challenges: {
        'dns-01': dns,
        'tls-sni-01': sni
      },
      challengeType: 'dns-01',
      aggreeToTerms: leAgree,
      debug,
      log
    })
    this.le.challenges['dns-01'] = dns // workarround
    this.le.challenges['tls-sni-01'] = sni // added this so it STFU about tls-sni-01.loopback
  }
  handleRequest (domains, cb) {
    this.le.register({
      domains,
      email: this.email,
      agreeTos: true, // yolo
      rsaKeySize: 2048,
      challengeType: 'dns-01'
    }).then(res => cb(null, res), cb)
  }
}

module.exports = Letsencrypt
