'use strict'

const debug = require('debug')
const log = debug('nodetrust:server')

const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const Peer = require('peer-info')

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')

function stripSecrets (conf) {
  const c = Object.assign({}, conf) // clone the object
  for (const p in c) {
    if (Boolean(['key', 'cert', 'priv', 'id', 'api'].filter(v => p.indexOf(v) !== -1).length) && p !== 'provider') {
      c[p] = '[secret]'
    } else if (typeof c[p] === 'object' && !Array.isArray(c[p])) {
      c[p] = stripSecrets(c[p])
    }
  }
  return c
}

const Proto = require('./proto')
const LE = require('./letsencrypt')
const DNS = require('./dns')

const {waterfall} = require('async')

module.exports = class Nodetrust {
  constructor (opt) {
    if (!opt) throw new Error('No config!')
    if (!opt.listen) opt.listen = ['/ip4/0.0.0.0/tcp/8899', '/ip6/::/tcp/8899', '/ip4/0.0.0.0/tcp/8877/ws']
    const keys = ['id', 'zone', 'dns', 'letsencrypt']
    keys.forEach(k => {
      if (!opt[k]) throw new Error('Config is missing key ' + JSON.stringify(k) + '!')
    })

    const configSafe = stripSecrets(opt)

    const peer = new Peer(opt.id)
    opt.listen.forEach(addr => peer.multiaddrs.add(addr))

    log('creating server', configSafe)

    this.swarm = new Libp2p({
      transport: [
        new TCP()
      ],
      connection: {
        muxer: [
          MULTIPLEX,
          SPDY
        ],
        crypto: [SECIO]
      }
    }, peer, null, {
      relay: {
        enabled: true,
        hop: {
          enabled: true,
          active: false // passive relay
        }
      }
    })

    this.zone = opt.zone

    const dns = this.dns = new DNS(opt.dns)
    dns.zone = opt.zone
    opt.letsencrypt.dns = dns
    this.le = new LE(opt.letsencrypt)

    Proto(this)
  }

  start (cb) {
    waterfall([
      cb => this.swarm.start(err => cb(err)),
      cb => this.dns.start(err => cb(err))
    ], cb)
  }

  stop (cb) {
    waterfall([
      cb => this.swarm.stop(err => cb(err)),
      cb => this.dns.stop(err => cb(err))
    ], cb)
  }
}
