'use strict'

const protos = require('./protos')
const Id = require('peer-id')
const Peer = require('peer-info')
const defaultNode = new Peer(Id.createFromB58String('Qm')) // TODO: add the official node
const debug = require('debug')
const log = debug('libp2p:nodetrust')
const EventEmitter = require('events').EventEmitter
const forge = require('node-forge')

class DiscoveryInstance extends EventEmitter {
  constructor () {
    super()
    this.start = this.start.bind(this)
    this.stop = this.stop.bind(this)
    this._handle = this._handle.bind(this)
  }

  start (cb) {
    this.started = true
    cb()
  }

  stop (cb) {
    this.started = false
    cb()
  }

  enableStandalone (config) {
    this.node = config.node || defaultNode
    this.discoveryPeers = config.discoveryPeers || 20
    this.interval = setInterval(this._doDiscovery.bind(this), config.intervalMS || 1000)
    this.swarm = config.swarm
  }

  disableStandalone () {
    clearInterval(this.interval || 0)
  }

  _doDiscovery (numPeers, cb) {
    log('discovery')
    if (!numPeers) numPeers = this.discoveryPeers
    if (!cb) cb = e => e ? log(e) : false
    this.swarm.dial(this.node, '/nodetrust/discovery/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.discovery, {
        numPeers
      }, (err, res) => {
        if (err) return cb(err)
        if (!res.success || !res.peers) return cb(new Error('Server did not complete discovery request!'))
        this._handle(res.peers)
        cb(null, res.peers)
      })
    })
  }

  _handle (peers) {
    // if (!this.started) return
    peers.forEach(peer => {
      const pi = new Peer(Id.createFromB58String(peer.id))
      peer.multiaddr.forEach(addr => pi.multiaddrs.add(addr))
      this.emit('peer', pi)
    })
  }
}

module.exports = class NodeTrust {
  constructor (swarm, config) {
    log('init')
    this.swarm = swarm
    config = this.config = config || {}
    this.id = this.swarm.peerInfo.id
    this.node = config.node || defaultNode
    this.discovery = config.discovery || new DiscoveryInstance()
    config.swarm = swarm
    config.node = this.node
    this.discovery.enableStandalone(config)

    this.swarm.nodetrust = this
  }

  static get discovery () {
    return new DiscoveryInstance()
  }

  enable (opt, cb) {
    if (typeof opt === 'function') {
      cb = opt
      opt = {}
    }
    log('enabling')
    this.getInfo(err => {
      if (err) return cb(err)
      protos.buildCN(this.id.toB58String(), this.info.zone, (err, cn) => {
        if (err) return cb(err)
        this.domain = cn
        this.getCert((err, cert, key, chain) => {
          if (err) return cb(err)
          this.cert = cert
          this.chain = chain
          this.key = key
          if (process.env.NODETRUST_LOG_KEYS) {
            console.log(chain.toString() + key.toString()) // eslint-ignore-line no-console
          }
          this.loop(err => {
            if (err) return cb(err)
            this.interval = setInterval(this.loop.bind(this), 5 * 60 * 1000 - 20000).unref()
            this.enabled = true
            cb()
          })
        })
      })
    })
  }

  disable (cb) {
    if (!this.enabled) return cb()
    clearInterval(this.interval)
    this.enabled = false
    cb()
  }

  loop (cb) {
    log('doLoop')
    if (!cb) cb = (e) => e ? log('loop error', e) : null
    this.renewDNS(err => {
      if (err) return cb(err)
      this.doAnnounce(err => {
        if (err) return cb(err)
        log('loop ok')
        cb()
      })
    })
  }

  // Info

  getInfo (cb) {
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

  getCert (cb) {
    log('getting %s certificate', this.info.type)
    switch (this.info.type) {
      case 'csr-ca':
        this._CSRCA(cb)
        break
      case 'drop-wildcard':
        this._DROPWILDCARD(cb)
        break
      default:
        cb(new Error('Certificate Request type ' + this.info.type + ' not supported!'))
    }
  }

  _DROPWILDCARD (cb) {
    this.swarm.dial(this.node, '/nodetrust/ca/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.ca, {}, (err, res) => {
        if (err) return cb(err)
        if (!res.success || !res.certificate || !res.certificate.length || !res.key || !res.key.length) return cb(new Error('Server did not complete certificate request'))
        cb(null, res.certificate, res.key, res.fullchain)
      })
    })
  }

  _CSRCA (cb) {
    this._getCSR(this.info, (err, request, key) => {
      if (err) return cb(err)
      this.id.privKey.sign(request, (err, sign) => {
        if (err) return cb(err, sign)
        this._getCertCSRCA(request, sign, (err, cert, chain) => {
          if (err) return cb(err)
          cb(null, cert, key, chain)
        })
      })
    })
  }
  _getCertCSRCA (certRequest, signature, cb) {
    this.swarm.dial(this.node, '/nodetrust/ca/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.ca, {
        certRequest,
        signature
      }, (err, res) => {
        if (err) return cb(err)
        if (!res.success || !res.certificate || !res.certificate.length) return cb(new Error('Server did not complete certificate request'))
        cb(null, res.certificate, res.fullchain)
      })
    })
  }
  _getCSR (info, cb) {
    const keys = forge.pki.rsa.generateKeyPair(1024) // TODO: use bigger key and generate async
    const csr = forge.pki.createCertificationRequest()
    csr.publicKey = keys.publicKey
    csr.setSubject([{
      name: 'commonName',
      value: this.domain
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
      value: 'Libp2p'
    }, {
      shortName: 'OU',
      value: this.id.toB58String()
    }])
      // set (optional) attributes
      /* csr.setAttributes([{
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
      }]) */
    csr.sign(keys.privateKey)
    return cb(null, Buffer.from(forge.pki.certificationRequestToPem(csr)), Buffer.from(forge.pki.privateKeyToPem(keys.privateKey)))
  }

  // DNS

  renewDNS (cb) {
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
          if (!res.success) return cb(new Error('Server did not complete dns request!'))
          cb()
        })
      })
    })
  }

  // Discovery

  doAnnounce (cb) {
    log('announce')
    this.swarm.dial(this.node, '/nodetrust/announce/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.announce, {
        multiaddr: this.swarm.peerInfo.multiaddrs.toArray().map(addr => addr.buffer)
      }, (err, res) => {
        if (err) return cb(err)
        if (!res.success) return cb(new Error('Server did not complete discovery request!'))
        cb(null)
      })
    })
  }
}
