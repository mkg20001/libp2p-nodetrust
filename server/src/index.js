'use strict'

const debug = require("debug")
const log = debug("libp2p:nodetrust:server")

const libp2p = require("libp2p")
const TCP = require("libp2p-tcp")
const Peer = require("peer-info")

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')

module.exports = function NodetrustServer(config) {
  const self = this

  if (!config) throw new Error("Config is required")
  if (!config.listen) config.listen = ["/ip4/0.0.0.0/tcp/4001", "/ip6/::/tcp/4001"]
  Array("id", "ca", "dns", "discovery").forEach(key => {
    if (!config[key]) throw new Error("Config key '" + JSON.stringify(key) + "' missing!")
  })

  log("creating server", config)

  const peer = new Peer(config.id)

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

  require("./ca")(swarm, config.ca)
  require("./dns")(swarm, config.dns)
  require("./discovery")(swarm, config.discovery)

}
