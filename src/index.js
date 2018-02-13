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
defaultNode.multiaddrs.add('/dns/libp2p-nodetrust.tk/tcp/8899')

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
    if (this.cert && this.cert.expiresAt - Date.now() > 0) return cb(null, this.cert)
    this._aquireCert((err, cert) => {
      if (err) return cb(err)
      this.cert = cert
      return cb(null, cert)
    })
  }

  _stealListener () {
    // HACK: get a random listener from libp2p
    const {swarm} = this
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

    this.wss = this.ws.createListener({
      cert: this.cert.chain,
      key: this.cert.key
    }, conn => listener.emit('connection', conn))
    // TODO: upnp
    this.wss.listen(multiaddr('/ip4/0.0.0.0/tcp/0'), err => {
      if (err) return cb(err)
      this.wss.getAddrs((err, addr) => {
        if (err) return cb(err)
        this.wss.addr = addr
        cb(null, addr)
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
        this._renewTimeout = setTimeout(this._renew.bind(this), cert.expiresAt - Date.now() - 1000) // leave 1s gap to avoid ._getCert race
        this._setupServer(cb)
      },
      (addr, cb) => {
        const {cert, swarm} = this
        const {peerInfo} = swarm
        const port = parseInt(addr.map(a => a.toString().match(/\/tcp\/(\d+)\//)[1]).filter(Boolean)[0], 10)
        if (isNaN(port)) return cb(new Error('WSS listening on invalid port!'))
        const ma = this._addedMAs = cert.altnames.map(domain => '/dns/' + domain + '/tcp/' + port + '/wss')
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
        peerInfo.replace(_addedMAs, [])
        cb()
      }
    ], cb)
  }

  _renew (cb) {
    waterfall([
      cb => this._shutdown(cb),
      cb => this._setup(cb)
    ], cb)
  }

  start (cb) {
    cb = once(cb || noop)
    this._setup(cb)
  }

  stop (cb) {
    cb = once(cb || noop)
    this._shutdown(cb)
  }
}
