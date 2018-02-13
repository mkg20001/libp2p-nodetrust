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

module.exports = class Nodetrust {
  constructor (opt) {
    this.node = opt.node || defaultNode
    this.ws = new WS()
  }
  __setSwarm (swarm) {
    this.swarm = swarm
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

  _stealListener () {
    // HACK: get a random listener from libp2p
    const swarm = this.swarm.switch
    for (const transport in swarm.transports) {
      if (swarm.transports[transport].listeners.length) return swarm.transports[transport].listeners[0]
    }
    return false
  }

  _setupServer (cb) {
    if (this.wss) return cb()

    // HACK: hack in the wss server as a transport
    const listener = this._stealListener()
    if (!listener) return cb(new Error('Couldn\'t get a listener'))

    log('starting wss server')

    this.wss = this.ws.createListener({
      cert: this.cert.chain,
      key: this.cert.key
    }, conn => listener.emit('connection', conn))

    this.wss.listen(multiaddr('/ip4/0.0.0.0/tcp/0'), err => {
      if (err) return cb(err)
      this.wss.getAddrs((err, addr) => {
        if (err) return cb(err)
        this.wss.addr = addr
        const port = parseInt(addr.map(a => a.toString().match(/\/tcp\/(\d+)\//)[1]).filter(Boolean)[0], 10)
        if (isNaN(port)) return cb(new Error('WSS listening on invalid port!'))
        log('doing nat')
        nat.addMapping(port, port, 3600 * 24).then(res => {
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
        const ma = this._addedMAs = cert.altnames.map(domain => '/dnsaddr/' + domain + '/tcp/' + addr.port + '/wss')
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
