'use strict'

const RPC = require('./proto')
const WS = require('libp2p-websockets')
const multiaddr = require('multiaddr')
const {waterfall} = require('async')
const Peer = require('peer-info')
const Id = require('peer-id')
const defaultNode = new Peer(Id.createFromB58String('Qm'))
const once = require('once')
const debug = require('debug')
const log = debug('libp2p:nodetrust')
const noop = err => err ? log(err) : false
defaultNode.multiaddrs.add('/dnsaddr/libp2p-nodetrust.tk/tcp/8899')

const nat = require('nat-puncher')
const protocolMuxer = require('libp2p-switch/src/protocol-muxer')

module.exports = class Nodetrust {
  constructor (opt) {
    this.node = opt.node || defaultNode
  }
  __setSwarm (swarm) {
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

    if (!this.swarm.switch.transports.WebSockets) this.swarm.switch.transports.WebSockets = this.ws

    // HACK: hack in the wss server as a transport
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

    this.wss.listen(multiaddr('/ip4/0.0.0.0/tcp/0'), err => {
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
        // this._renewTimeout = setTimeout(this._renew.bind(this), cert.expiresAt - Date.now() - 1000) // leave 1s gap to avoid ._getCert race
        this._setupServer(cb)
      },
      (addr, cb) => {
        const {cert, swarm} = this
        const {peerInfo} = swarm
        const ma = this._addedMAs = cert.altnames.map(domain => '/dnsaddr/' + domain + '/tcp/' + addr.port + '/wss/ipfs/' + swarm.peerInfo.id.toB58String())
        ma.forEach(addr => peerInfo.multiaddrs.add(addr))
        cb()
      }
    ], cb)
  }

  _shutdown (cb) {
    waterfall([
      cb => this._shutdownServer(cb),
      cb => {
        const {_addedMAs, swarm, _renewTimeout} = this
        clearTimeout(_renewTimeout || 0)
        const {peerInfo} = swarm
        peerInfo.multiaddrs.replace(_addedMAs, [])
        cb()
      }
    ], cb)
  }

  _renew (cb) {
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
