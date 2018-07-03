'use strict'

const Peer = require('peer-info')
const Server = require('../server/src')
const Client = require('../src')

const Libp2p = require('libp2p')

const TCP = require('libp2p-tcp')
const WS = require('libp2p-websockets')

const MPLEX = require('libp2p-mplex')
const SPDY = require('libp2p-spdy')
const SECIO = require('libp2p-secio')

const Utils = module.exports = {
  serverPeer: () => {
    const id = global.ids[0]
    const peer = new Peer(id)
    // peer.multiaddrs.add('/ip4/127.0.0.1/tcp/8877/ws/ipfs/' + id.toB58String())
    peer.multiaddrs.add('/ip4/127.0.0.1/tcp/8899/ipfs/' + id.toB58String())
    return peer
  },
  clientPeer: () => {
    const id = global.ids[1]
    const peer = new Peer(id)
    peer.multiaddrs.add('/ip4/127.0.0.1/tcp/0/ipfs/' + id.toB58String())
    return peer
  },
  createServer: (config, cb) => {
    config.id = Utils.serverPeer().id
    const server = new Server(config)
    server.start(cb)
    return server
  },
  serverConfig: (c) => {
    let config = {
      letsencrypt: {
        storageDir: '/tmp/nodetrust-le-tmp',
        email: 'letsencrypt@mkg20001.io'
      },
      dns: {
        ttl: 10
      }
    }
    switch (true) {
      case Boolean(process.env.STANDALONE_DNS): {
        config.dns.standalone = true
        config.zone = process.env.STANDALONE_DNS
        break
      }
      case Boolean(process.env.REMOTE_DNS): {
        let [zone, addr] = process.env.REMOTE_DNS.split('@')
        config.dns.addr = addr
        config.zone = zone
        break
      }
      default: {
        config.letsencrypt.stub = true
        config.zone = 'ip.local'
        config.dns.standalone = true
        config.dns.port = 4500
      }
    }
    return Object.assign(config, c)
  },
  createClientSwarm: () => {
    return new Libp2p({
      transport: [
        new TCP(),
        new WS()
      ],
      connection: {
        muxer: [
          MPLEX,
          SPDY
        ],
        crypto: [SECIO]
      }
    }, Utils.clientPeer())
  },
  createClient: (config, cb) => {
    if (!config.node) config.node = Utils.serverPeer()
    const swarm = Utils.createClientSwarm()
    const client = new Client(config)
    client.__setSwarm(swarm)
    swarm.start(cb)
    return [swarm, client]
  }
}
