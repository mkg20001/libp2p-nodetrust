'use strict'

const WS = require('libp2p-websockets')
const promy = (fnc) => new Promise((resolve, reject) => fnc((err, res) => err ? reject(err) : resolve(res)))
const multiaddr = require('multiaddr')
const once = require('once')
const debug = require('debug')
const log = debug('libp2p:nodetrust')
const noop = err => err ? log(err) : false
const client = require('./client')

const nat = require('nat-puncher') // TODO: use libp2p nat-flow once ready

const Discovery = require('./discovery')
const {defaultNode} = require('./defaults')

module.exports = class Nodetrust {
  constructor (opt) {
    this.node = opt.node || defaultNode
    this.discovery = new Discovery()
  }

  __setSwarm (swarm) {
    this.discovery.__setSwarm(swarm)
    this.swarm = swarm
    this.ws = new WS()
  }

  async _getCert () {
    if (this.cert && this.cert.expiresAt - Date.now() > 0) {
      log('using cached cert')
      return this.cert
    }

    log('aquiring certificate')
    this.cert = await client(this.swarm, this.node)
    return this.cert
  }

  async _setupServer () {
    if (this.wss) return this.wss

    log('starting wss server')

    if (!this.swarm._modules.transport.filter(t => WS.isWebSockets(t) || t.isWebSockets).length) {
      this.swarm._switch.transport.add('WebSockets', new WS())
    }

    // HACK: hack in the wss server as a transport (needs some way to change listeners at runtime)
    this.wss = this.ws.createListener({
      cert: Buffer.concat([this.cert.cert.certificate.certificate, Buffer.from('\n\n'), this.cert.ca.certificate]),
      key: this.cert.cert.key.key
    }, conn => {
      this.swarm._switch.protocolMuxer('WebSockets')(conn)
    })

    await promy(cb => this.wss.listen(multiaddr('/ip4/0.0.0.0/tcp/' + (process.env.NODETRUST_FIXED_PORT || 0)), cb))
    const addr = await promy(cb => this.wss.getAddrs(cb))
    this.wss.addr = addr
    const port = parseInt(addr.map(a => a.toString().match(/\/tcp\/(\d+)\//)[1]).filter(Boolean)[0], 10)
    if (isNaN(port)) { throw new Error('WSS listening on invalid port!') }

    let eport

    if (!process.env.SKIP_NAT) {
      log('doing nat')
      const res = await nat.addMapping(port, port, 3600)
      if (res.externalPort === -1 || !res.externalPort) {
        log('nat failed')
        eport = port
      } else {
        eport = res.externalPort
        log('nat success at %s', eport)
      }
    } else {
      log('skip nat')
      eport = port
    }

    this.wss.port = eport
    addr.port = eport

    return this.wss
  }

  async _shutdownServer () {
    if (!this.wss) return

    await promy(cb => this.wss.close(cb))
    this.wss = null
  }

  async _setup () {
    const cert = await this._getCert()
    this._renewInterval = setInterval(this._renew.bind(this), 10000)
    const wss = await this._setupServer()

    const {swarm} = this
    const {peerInfo} = swarm
    const ma = this._addedMAs = cert.altnames.map(domain => '/dnsaddr/' + domain + '/tcp/' + wss.port + '/wss/ipfs/' + swarm.peerInfo.id.toB58String())
    ma.forEach(addr => peerInfo.multiaddrs.add(addr))
  }

  async _shutdown () {
    await this._shutdownServer()

    const {_addedMAs, swarm, _renewInterval} = this
    clearInterval(_renewInterval || 0)
    const {peerInfo} = swarm
    peerInfo.multiaddrs.replace(_addedMAs, [])
  }

  async _renew () {
    if (this.cert.expiresAt + 1000 > Date.now()) return this.discovery._broadcast(this.swarm.peerInfo)
    log('renewing')
    await this._shutdown() // TODO: use sni callback instead of restarting wss://
    await this._setup()
  }

  start (cb) {
    log('starting')
    cb = once(cb || noop)
    this._setup().then(() => cb(), cb)
  }

  stop (cb) {
    log('stopping')
    cb = once(cb || noop)
    this._shutdown().then(() => cb(), cb)
  }
}
