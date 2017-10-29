'use strict'

const protos = require('./protos')
const Id = require('peer-id')
const Peer = require('peer-info')
const defaultNode = new Peer(Id.fromB58String('Qm')) //TODO: add the official node
const debug = require('debug')
const log = debug('libp2p:nodetrust')
const EventEmitter = require("events").EventEmitter

class DiscoveryInstance extends EventEmitter {
  constructor() {
    super()
  }

  start(cb) {
    this.started = true
    cb()
  }

  stop(cb) {
    this.started = false
    cb()
  }

  _handle(peers) {
    if (!this.started) return
    peers.forEach(peer => {
      const pi = new Peer(Id.fromB58String(peer.id))
      peer.multiaddr.forEach(addr => pi.multiaddrs.addSafe(addr))
      this.emit("peer", pi)
    })
  }
}

module.exports = class NodeTrust {
  constructor(swarm, config) {
    this.swarm = swarm
    this.config = config || {}
    this.id = this.swarm.peerInfo.id
    this.node = config.node || defaultNode
    this.discoveryPeers = config.discoveryPeers || 20
    this.discovery = new DiscoveryInstance()

    this.swarm.nodetrust = this
  }

  enable(cb) {
    log('enabling')
    this.getCert((err, cert) => {
      if (err) return cb(err)
      this.cert = cert
      this.loop(err => {
        if (err) return cb(err)
        this.interval = setInterval(4 * 60 * 1000, this.loop.bind(this))
        this.enabled = true
      })
    })
  }

  disable(cb) {
    if (!this.enabled) return cb()
    clearInterval(this.interval)
    this.enabled = false
    cb()
  }

  loop(cb) {
    log("doLoop")
    if (!cb) cb = (e) => e ? log("loop error", e) : null
    this.renewDNS(err => {
      if (err) cb(err)
      this.doDiscovery(this.discoveryPeers, err => {
        if (err) cb(err)
        log("loop ok")
      })
    })
  }

  // Certificate

  getCert(cb) {
    log('getting certificate')
    this._getCertRequest(this.id, (err, request) => {
      if (err) return cb(err)
      this.id.sign(request, (err, sign) => {
        if (err) return cb(err, sign)
        this._getCert(request, sign, cb)
      })
    })
  }
  _getCert(certRequest, signature, cb) {
    this.swarm.dial(this.node, '/nodetrust/ca/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.ca, {
        certRequest,
        signature
      }, (err, res) => {
        if (err) return cb(err)
        if (!res.success || !res.certificate || !res.certificate.length) return cb(new Error('Server did not complete certificate request'))
        cb(null, res.certificate)
      })
    })
  }
  _getCertRequest(id, cb) {

  }

  // DNS

  renewDNS(cb) {
    log('renewing dns')
    const time = new Date().getTime()
    this.id.sign(time.toString(), (err, signature) => {
      if (err) return cb(err)

      this.swarm.dial(this.node, '/nodetrust/dns/1.0.0', (err, conn) => {
        if (err) return cb(err)
        protos.client(conn, protos.dns, {
          time,
          signature
        }, (err, res) => {
          if (err) return cb(err)
          if (!res.success) return cb(new Error('Server did not complete dns request'))
          cb()
        })
      })
    })
  }

  // Discovery

  doDiscovery(numPeers, cb) {
    log('discovery')
    this.swarm.dial(this.node, '/nodetrust/discovery/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.discovery, {
        numPeers,
        multiaddr: this.swarm.peerInfo.multiaddrs.toArray().map(addr => addr.buffer)
      }, (err, res) => {
        if (err) return cb(err)
        if (!res.success || !res.peers || !res.peers.length) return cb(new Error('Server did not complete discovery request'))
        this.discovery.handle(res.peers)
        cb(null, res.peers)
      })
    })
  }
}
