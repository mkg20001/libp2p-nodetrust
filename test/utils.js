'use strict'

const Peer = require('peer-info')
const Server = require('../server/src')
const Client = require('../src')

const Libp2p = require('libp2p')

const TCP = require('libp2p-tcp')

const MULTIPLEX = require('libp2p-multiplex')
const SPDY = require('libp2p-spdy')
const SECIO = require('libp2p-secio')

const Utils = module.exports = {
  serverPeer: () => {
    const id = global.ids[0]
    const peer = new Peer(id)
    peer.multiaddrs.add('/ip4/127.0.0.1/tcp/8877/ws/ipfs/' + id.toB58String())
    return peer
  },
  clientPeer: () => {
    const id = global.ids[1]
    const peer = new Peer(id)
    peer.multiaddrs.add('/ip4/127.0.0.1/tcp/7788/ipfs/' + id.toB58String())
    return peer
  },
  createServer: (config, cb) => {
    config.id = Utils.serverPeer().id
    const server = new Server(config)
    server.start(cb)
    return server
  },
  createClientSwarm: () => {
    return new Libp2p({
      transport: [
        new TCP()
      ],
      connection: {
        muxer: [
          MULTIPLEX,
          SPDY
        ],
        crypto: [SECIO]
      }
    }, Utils.clientPeer())
  },
  createClient: (config, cb) => {
    config.node = Utils.serverPeer()
    const swarm = Utils.createClientSwarm()
    const client = new Client(config)
    client.__setSwarm(swarm)
    swarm.start(cb)
    return [swarm, client]
  }
}
