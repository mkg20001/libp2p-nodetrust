'use strict'

const ACME = require('./acme')
const { URLS } = ACME
const Storage = require('./storage')
const debug = require('debug')
const log = debug('nodetrust:server:issue')
const pull = require('pull-stream')
const lp = require('pull-length-prefixed')
const ppb = require('pull-protocol-buffers')
const {IssueInfo, IssueRequest, IssueResponse, Proof} = require('../proto')
const multiaddr = require('multiaddr')
const Id = require('peer-id')
const promisify = require('promisify-es6')
const id0 = require('./idPrefix')
const DNS = require('./dns')
const Peer = require('peer-info')
const delta = (a, b) => a > b ? a - b : b - a
const DISCOVERY = '_nodetrust_discovery_v2' // pubsub discovery channel

async function verifyProof (proof, key) {
  try {
    if (delta(proof.proof.timestamp, Date.now()) > 5 * 60 * 1000) return false // if delta more than 5min
    return (await promisify(cb => key.pubKey.verify(Proof.encode(proof.proof), proof.signature, cb))())
  } catch (err) {
    return false
  }
}

class Issue {
  constructor (node, config) {
    this.node = node
    this.config = config
    this.domain = config.domain
    this.suffix = '.' + this.domain
    this.infoPacket = IssueInfo.encode({
      domain: config.domain,
      proofs: config.pser.map(serv => {
        let addrs = serv.addrs.map(multiaddr)
        return {
          id: Id.createFromB58String(addrs[0].getPeerId()).toBytes(),
          addrs: addrs.map(addr => addr.buffer),
          display: serv.display
        }
      })
    })

    let serverUrl = URLS[(config.leenv || 'staging')] || config.leenv
    let storage = this.storage = new Storage(config.store)
    let dnsAddrs = config.dns.map(multiaddr)
    let dnsPi = new Peer(Id.createFromB58String(dnsAddrs[0].getPeerId()))
    dnsAddrs.forEach(addr => dnsPi.multiaddrs.add(addr))
    this.dns = new DNS(dnsPi, node)
    let acmeConf = {
      email: config.email,
      serverUrl,
      storage,
      challenge: {
        type: 'dns-01',
        set: (auth) => this.dns.setDNS01(auth.identifier.value, auth.dnsAuthorization),
        remove: (auth) => Promise.resolve(true) // dns server removes the entry automatically after 2mins
      }
      // validateWithDig: opt.validateWithDig || false
    }
    this.acme = new ACME(acmeConf)
  }

  async start () {
    await this.acme.init()
    this.proofKey = await promisify(cb => Id.createFromPubKey(this.config.proof, cb))()
    this.gc()
    await this.dns.start()
    await promisify(cb => this.node.pubsub.subscribe(DISCOVERY, () => {}, cb))()

    this.node.handle('/p2p/nodetrust/issue/info/1.0.0', (proto, conn) => pull(pull.values([this.infoPacket]), lp.encode(), conn, pull.drain()))
    this.node.handle('/p2p/nodetrust/issue/1.0.0', (proto, conn) => {
      conn.getPeerInfo((err, pi) => {
        if (err) {
          return log(err)
        }

        const id = pi.id

        this.handle(conn, id)
      })
    })
    this.gcIntv = setInterval(() => this.gc(), this.config.gcIntv || 60 * 60 * 1000)
  }

  async stop () {
    clearInterval(this.gcIntv)
    this.node.unhandle('/p2p/nodetrust/issue/1.0.0')
    this.node.unhandle('/p2p/nodetrust/issue/info/1.0.0')
  }

  handle (conn, id) {
    pull(
      conn,
      ppb.decode(IssueRequest),
      pull.asyncMap(async (request, cb) => {
        // verify all proofs
        if (!request.proofs.length) {
          return cb(null, {error: 2})
        }

        const result = await Promise.all(request.proofs.map(proof => verifyProof(proof, this.proofKey)))
        if (result.filter(Boolean).length !== request.proofs.length) {
          return cb(null, {error: 2}) // one or more proofs have invalid signatures
        }

        let canDoRSA = Boolean(request.supportedCryptos.filter(crypto => crypto === 1).length) // TODO: make this more dynamic once needed

        if (!canDoRSA) {
          return cb(null, {error: 4})
        }

        let ip2dns = request.proofs.map(proof => proof.proof.addrs.map(addr => {
          switch (addr.type) {
            case 1: // v4
              return 'ip4' + addr.address.replace(/\./g, '-') + this.suffix
            case 2: // v6
              return 'ip6' + addr.address.replace(/:/g, '-') + this.suffix
            default:
          }
        })).reduce((a, b) => a.concat(b), [])
        let cn = id0(id.toBytes(), this.suffix)
        let domains = [cn].concat(ip2dns)

        const cert = await this.acme.getCertificate(id.toB58String(), domains)
        cert.error = 0
        cert.cryptoType = 1 // RSA only for now
        return cb(null, cert)
      }),
      ppb.encode(IssueResponse),
      conn
    )
  }

  gc () { // TODO: make this async
    let log = debug('nodetrust:letsencrypt:gc')
    log('running gc')

    const store = this.storage
    let now = Date.now()

    let certStores = store.ls('.')
      .filter(file => file.startsWith('@'))
      .filter(certStore => {
        let files = store.ls(certStore)
          .filter(cert => {
            if (now > store.readJSON(certStore, cert).validity) {
              log('remove old cert %s from %s', cert, certStore)
              store.rm(certStore, cert)
            } else {
              return true
            }
          })
        if (files.length) {
          return true
        }
        log('remove empty store %s', certStore)
        store.rmdir(certStore)
      })
    store.ls('key')
      .filter(file => file.startsWith('@'))
      .filter(key => certStores.indexOf(key) === -1)
      .forEach(key => {
        log('remove unused key %s', key)
        store.rm('key', key)
      })

    log('gc took %sms', Date.now() - now)
  }
}

module.exports = {
  libp2pConfig: { // libp2p config
    peerDiscovery: {},
    relay: { // Circuit Relay options
      enabled: true,
      hop: { enabled: true, active: false }
    },
    // Enable/Disable Experimental features
    EXPERIMENTAL: { pubsub: true, dht: false }
  },
  template: { // template for config creation
    swarm: {
      addrs: [
        '/ip4/0.0.0.0/tcp/25893',
        '/ip4/0.0.0.0/tcp/25894/ws'
      ]
    },
    issue: {
      domain: 'your-nodetrust-domain.tld',
      store: './letsencrypt',
      email: 'email-for-letsencrypt',
      leenv: 'staging',
      dns: ['/address/to/dns/server'],
      proof: 'Add public proof key here',
      pser: [
        {
          display: 'v4',
          addrs: ['/dnsaddr/v4.domain.tld/tcp/25892/ipfs/Qm']
        },
        {
          display: 'v6',
          addrs: ['/dnsaddr/v6.domain.tld/tcp/25892/ipfs/Qm']
        },
        {
          display: 'fc00',
          addrs: ['/dnsaddr/fc00.domain.tld/tcp/25892/ipfs/Qm']
        }
      ]
    }
  },
  create: (node, config) => new Issue(node, config)
}
