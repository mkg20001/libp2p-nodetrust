'use strict'

const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const Peer = require('peer-info')
const Id = require('peer-id')

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')
const listen = ['/ip4/0.0.0.0/tcp/0', '/ip6/::/tcp/0']
const pull = require('pull-stream')

require('colors')

const NodeTrust = require('../src')

Id.create({bits: 512}, (e, id) => {
  if (e) throw e
  const peer = new Peer(id)

  listen.forEach(addr => peer.multiaddrs.add(addr))

  const node = new Peer(Id.createFromB58String('QmNnMDsFRCaKHd8Tybhui1eVuN7xKMMqRZobAEtgKBJU5t'))
  node.multiaddrs.add('/ip4/127.0.0.1/tcp/8899/ipfs/QmNnMDsFRCaKHd8Tybhui1eVuN7xKMMqRZobAEtgKBJU5t')
  const nodetrust = new NodeTrust({ node })
  const {discovery} = nodetrust

  const swarm = new Libp2p({
    transport: [
      new TCP()
    ],
    connection: {
      muxer: [
        MULTIPLEX,
        SPDY
      ],
      crypto: [SECIO],
      discovery: [discovery]
    }
  }, peer)

  nodetrust.__setSwarm(swarm)

  swarm.start(err => {
    if (err) throw err
    nodetrust.start(err => {
      if (err) throw err
    })
  })

  swarm.handle('/messages/1.0.0', (proto, conn) => {
    pull(
      pull.values([Buffer.from('Hello from ' + id.toB58String() + '!')]),
      conn,
      pull.drain()
    )
  })

  let nodes = {}
  discovery.on('peer', pi => {
    const id = pi.id.toB58String()
    if (nodes[id]) return // only show new discoveries
    nodes[id] = true
    console.log('%s%s%s', id.blue.bold, ': '.white.bold, pi.multiaddrs.toArray().map(s => s.toString().yellow).join(', '.grey.bold))
  })
})
