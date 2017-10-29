"use strict"

const libp2p = require("libp2p")
const TCP = require("libp2p-tcp")
const Peer = require("peer-info")
const Id = require("peer-id")

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')
const listen = ["/ip4/0.0.0.0/tcp/5284", "/ip6/::/tcp/5284"]

const {
  map
} = require("async")

const nodetrust = require("./src")

map(require("./test/ids.json"), Id.createFromJSON, (e, ids) => {
  if (e) throw e
  const peer = new Peer(ids[1])

  listen.forEach(addr => peer.multiaddrs.add(addr))

  const swarm = new libp2p({
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

  const node = new Peer(ids[0])
  node.multiaddrs.add("/ip4/127.0.0.1/tcp/4001/ipfs/" + ids[0].toB58String())

  new nodetrust(swarm, {
    node
  })

  swarm.start(err => {
    if (err) throw err
    swarm.nodetrust.enable(console.log)
  })
})
