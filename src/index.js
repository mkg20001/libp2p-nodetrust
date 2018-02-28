'use strict'

const RPC = require('./proto')
const WS = require('libp2p-websockets')
const multiaddr = require('multiaddr')
const {waterfall} = require('async')
const once = require('once')
const debug = require('debug')
const log = debug('libp2p:nodetrust')
const noop = err => err ? log(err) : false

const nat = require('nat-puncher')
const protocolMuxer = require('libp2p-switch/src/protocol-muxer')

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

  _aquireCert (cb) {
    const rpc = new RPC(cb)
    this.swarm.dialProtocol(this.node, '/nodetrust/2.0.0', (err, conn) => {
      if (err) return cb(err)
      rpc.setup(conn)
    })
  }

  _getCert (cb) {
    cb = once(cb)
    if (this.cert && this.cert.expiresAt - Date.now() > 0) return cb(null, this.cert)
    log('aquiring certificate')
    this._aquireCert((err, cert) => {
      if (err) return cb(err)
      this.cert = cert
      return cb(null, cert)
    })
  }

  _setupServer (cb) {
    if (this.wss) return cb()

    log('starting wss server')

    if (!this.swarm.switch.transports.WebSockets) this.swarm.switch.transports.WebSockets = this.ws // HACK: hack in the wss transport for dialing. (needs some way to add transports at runtime)

    // HACK: hack in the wss server as a transport (needs some way to change listeners at runtime)
    this.wss = this.ws.createListener({
      cert: this.cert.chain,
      key: this.cert.key
    }, conn => {
      if (this.swarm.switch.protocolMuxer) { // this hack is compatible with 2 versions of libp2p-switch. hacks nowadays seem to evolve ;)
        this.swarm.switch.protocolMuxer('WebSockets')(conn)
      } else {
        protocolMuxer(this.swarm.switch.protocols, conn)
      }
    })

    this.wss.listen(multiaddr('/ip4/0.0.0.0/tcp/' + (process.env.NODETRUST_FIXED_PORT || 0)), err => {
      if (err) return cb(err)
      this.wss.getAddrs((err, addr) => {
        if (err) return cb(err)
        this.wss.addr = addr
        const port = parseInt(addr.map(a => a.toString().match(/\/tcp\/(\d+)\//)[1]).filter(Boolean)[0], 10)
        if (isNaN(port)) return cb(new Error('WSS listening on invalid port!'))
        log('doing nat');
        (process.env.SKIP_NAT ? Promise.resolve({}) : nat.addMapping(port, port, 3600)).then(res => {
          let eport
          if (res.externalPort === -1 || !res.externalPort) {
            log('nat failed')
            eport = port
          } else {
            eport = res.externalPort
            log('nat success at %s', eport)
          }
          this.wss.port = eport
          addr.port = eport
          cb(null, addr)
        }, cb)
      })
    })
  }

  _shutdownServer (cb) {
    if (!this.wss) return cb()
    this.wss.close(err => {
      if (err) return cb(err)
      this.wss = null
      cb()
    })
  }

  _setup (cb) {
    waterfall([
      cb => this._getCert(cb),
      (cert, cb) => {
        this._renewInterval = setInterval(this._renew.bind(this), 10000)
        this._setupServer(cb)
      },
      (wss, cb) => {
        const {cert, swarm} = this
        const {peerInfo} = swarm
        const ma = this._addedMAs = cert.altnames.map(domain => '/dnsaddr/' + domain + '/tcp/' + wss.port + '/wss/ipfs/' + swarm.peerInfo.id.toB58String())
        ma.forEach(addr => peerInfo.multiaddrs.add(addr))
        cb()
      }
    ], cb)
  }

  _shutdown (cb) {
    waterfall([
      cb => this._shutdownServer(cb),
      cb => {
        const {_addedMAs, swarm, _renewInterval} = this
        clearInterval(_renewInterval || 0)
        const {peerInfo} = swarm
        peerInfo.multiaddrs.replace(_addedMAs, [])
        cb()
      }
    ], cb)
  }

  _renew (cb) {
    if (this.cert.expiresAt + 1000 > Date.now()) return this.discovery._broadcast(this.swarm.peerInfo)
    log('renewing')
    waterfall([
      cb => this._shutdown(cb),
      cb => this._setup(cb)
    ], cb)
  }

  start (cb) {
    log('starting')
    cb = once(cb || noop)
    this._setup(cb)
  }

  stop (cb) {
    log('stopping')
    cb = once(cb || noop)
    this._shutdown(cb)
  }
}
