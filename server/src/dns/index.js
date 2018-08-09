'use strict'

const debug = require('debug')
const log = debug('nodetrust:server:dns')
const pull = require('pull-stream')
const ppb = require('pull-protocol-buffers')
const {DNS01Request, DNS01Response} = require('../proto')
const Named = require('./named')
const promisify = require('promisify-es6')
const DISCOVERY = '_nodetrust_discovery_v2' // pubsub discovery channel

class DNS {
  constructor (node, config) {
    this.node = node
    this.config = config
    this.named = new Named(node.log, config)
  }

  async start () {
    await promisify(cb => this.node.pubsub.subscribe(DISCOVERY, () => {}, cb))()
    this.node.handle('/p2p/nodetrust/dns-01/1.0.0', (proto, conn) => {
      conn.getPeerInfo((err, pi) => {
        if (err) {
          return log(err)
        }

        const id = pi.id.toB58String()

        if (this.config.admins.indexOf(id) === -1) {
          this.node.log.warn({type: 'dns.failedAuth', id}, 'Failed auth attempt!')
          return // TODO: somehow tell the other side or at least disconnect
        }

        this.handle(conn, id)
      })
    })

    return this.named.start()
  }

  async stop () {
    this.node.unhandle('/p2p/nodetrust/dns-01/1.0.0') // TODO: close conns
    return this.named.stop()
  }

  handle (conn, id) {
    this.node.log.info({type: 'dns01.connect', from: id}, 'New client connected')

    pull(
      conn,
      ppb.decode(DNS01Request),
      pull.map(request => {
        // TODO: validate fqdn
        let fqdn = '_acme-challenge.' + request.fqdn
        this.node.log.info({type: 'dns01.set', fqdn, from: id}, 'Add DNS-01 challenge proof')
        this.named.setDNS01(fqdn, request.value)
        return {error: 0}
      }),
      ppb.encode(DNS01Response),
      conn
    )
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
        '/ip4/0.0.0.0/tcp/25891'
      ]
    },
    dns: {
      addr: '/ip4/0.0.0.0/udp/53',
      admins: ['QmIssueServerId'],
      ns: 'this-server.domain.tld',
      ttl: 1000 * 60 * 60 * 10, // 10h default TTL
      txtttl: 1000 * 60 * 2 // 2min for dns-01
    }
  },
  create: (node, config) => new DNS(node, config)
}
