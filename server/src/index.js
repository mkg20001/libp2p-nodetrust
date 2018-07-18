'use strict'

const debug = require('debug')
const log = debug('nodetrust:server')
const bunyan = require('bunyan')
const promisify = require('promisify-es6')

const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const WS = require('libp2p-websockets')
const Peer = require('peer-info')

const SPDY = require('libp2p-spdy')
const MPLEX = require('libp2p-mplex')
const SECIO = require('libp2p-secio')

module.exports = class Nodetrust {
  constructor (service, serviceName, config) {
    const peer = new Peer(config.swarm.id)
    config.swarm.addrs.forEach(addr => peer.multiaddrs.add(addr))

    this.swarm = new Libp2p({
      peerInfo: peer, // The Identity of your Peer
      modules: {
        transport: [TCP, WS],
        streamMuxer: [SPDY, MPLEX],
        connEncryption: [SECIO]
      },
      config: service.libp2pConfig
    })
    this.swarm.log = bunyan.createLogger({name: 'nodetrust.' + serviceName})
    this.service = service.create(this.swarm, config[serviceName])
  }
  async start () {
    log('starting')
    await promisify(cb => this.swarm.start(cb))()
    await this.service.start()
  }
  async stop () {
    log('stopping')
    await this.service.stop()
    await promisify(cb => this.swarm.stop(cb))()
  }
}
