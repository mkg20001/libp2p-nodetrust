'use strict'

const debug = require("debug")
const log = debug("nodetrust:server")

const libp2p = require("libp2p")
const TCP = require("libp2p-tcp")
const Peer = require("peer-info")

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')

const protos = require('./protos')

module.exports = function NodetrustServer(config) {
  const self = this

  if (!config) throw new Error("Config is required")
  if (!config.listen) config.listen = ["/ip4/0.0.0.0/tcp/4001", "/ip6/::/tcp/4001"]
  Array("id", "zone", "ca", "dns", "discovery").forEach(key => {
    if (!config[key]) throw new Error("Config key " + JSON.stringify(key) + " missing!")
  })

  log("creating server", config)

  const peer = new Peer(config.id)
  config.listen.forEach(addr => peer.multiaddrs.add(addr))

  const swarm = self.swarm = new libp2p({
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
  }, peer)

  swarm.zone = config.zone
  swarm.getCN = id => {
    if (id.toB58String) id = id.toB58String()
    return protos.buildCN(id, swarm.zone)
  }

  require("./ca")(swarm, config.ca)
  require("./dns")(swarm, config.dns)
  require("./discovery")(swarm, config.discovery)
  require("./info")(swarm, config)

  self.start = cb => swarm.start(cb)
  self.stop = cb => swarm.stop(cb)
}
