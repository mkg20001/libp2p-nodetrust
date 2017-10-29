'use strict'

const protos = require('./protos')
const Id = require('peer-id')
const Peer = require('peer-info')
const defaultNode = new Peer(Id.createFromB58String('Qm')) //TODO: add the official node
const debug = require('debug')
const log = debug('libp2p:nodetrust')
const EventEmitter = require("events").EventEmitter
const forge = require("node-forge")

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
    log('init')
    this.swarm = swarm
    config = this.config = config || {}
    this.id = this.swarm.peerInfo.id
    this.node = config.node || defaultNode
    this.discoveryPeers = config.discoveryPeers || 20
    this.discovery = new DiscoveryInstance()

    this.swarm.nodetrust = this
  }

  enable(cb) {
    log('enabling')
    this.getInfo(err => {
      if (err) return cb(err)
      this.getCert((err, cert) => {
        if (err) return cb(err)
        this.cert = cert
        this.loop(err => {
          if (err) return cb(err)
          this.interval = setInterval(this.loop.bind(this), 5 * 60 * 1000 - 20000).unref()
          this.enabled = true
        })
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
      if (err) return cb(err)
      this.doDiscovery(this.discoveryPeers, err => {
        if (err) return cb(err)
        log("loop ok")
        cb()
      })
    })
  }

  // Info

  getInfo(cb) {
    if (this.info) return cb()
    this.swarm.dial(this.node, '/nodetrust/info/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.info, {}, (err, res) => {
        if (err) return cb(err)
        this.info = res
        cb()
      })
    })
  }

  // Certificate

  getCert(cb) {
    log('getting certificate')
    this._getCertRequest(this.info, (err, request) => {
      if (err) return cb(err)
      this.id.privKey.sign(request, (err, sign) => {
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
  _getCertRequest(info, cb) {
    const keys = forge.pki.rsa.generateKeyPair(1024) //TODO: use bigger key and generate async
    const csr = forge.pki.createCertificationRequest()
    csr.publicKey = keys.publicKey
    csr.setSubject([{
      name: 'commonName',
      value: this.id.toB58String() + "." + info.zone
    }, {
      name: 'countryName',
      value: 'US'
    }, {
      shortName: 'ST',
      value: 'Virginia'
    }, {
      name: 'localityName',
      value: 'Blacksburg'
    }, {
      name: 'organizationName',
      value: 'Test'
    }, {
      shortName: 'OU',
      value: 'Test'
    }])
    // set (optional) attributes
    /*csr.setAttributes([{
      name: 'challengePassword',
      value: 'password'
    }, {
      name: 'unstructuredName',
      value: 'My Company, Inc.'
    }, {
      name: 'extensionRequest',
      extensions: [{
        name: 'subjectAltName',
        altNames: [{
          // 2 is DNS type
          type: 2,
          value: 'test.domain.com'
        }, {
          type: 2,
          value: 'other.domain.com',
        }, {
          type: 2,
          value: 'www.domain.net'
        }]
      }]
    }])*/
    csr.sign(keys.privateKey)
    return cb(null, Buffer.from(forge.pki.certificationRequestToPem(csr)))
  }

  // DNS

  renewDNS(cb) {
    log('renewing dns')
    const time = new Date().getTime()
    this.id.privKey.sign(time.toString(), (err, signature) => {
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
        if (!res.success || !res.peers) return cb(new Error('Server did not complete discovery request'))
        this.discovery._handle(res.peers)
        cb(null, res.peers)
      })
    })
  }
}
