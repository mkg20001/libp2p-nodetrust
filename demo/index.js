'use strict'

const Libp2p = require('libp2p')
const TCP = require('libp2p-tcp')
const WS = require('libp2p-websockets')
const Peer = require('peer-info')
const Id = require('peer-id')
const multiaddr = require('multiaddr')

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')
const listen = ['/ip4/0.0.0.0/tcp/0', '/ip6/::/tcp/0']
const pull = require('pull-stream')

const {
  map
} = require('async')

require('colors')

const NodeTrust = require('../src')

map(require('../test/ids.json'), Id.createFromJSON, (e, ids) => {
  if (e) throw e
  Id.create({bits: 512}, (e, id) => {
    if (e) throw e
    const peer = new Peer(id)

    listen.forEach(addr => peer.multiaddrs.add(addr))

    let tcp = new TCP()
    let ws = new WS()
    let l = []
    const create = tcp.createListener.bind(tcp)
    tcp.createListener = (options, handler) => { // mitm the tcp listener so we can get the handler easily
      let n = create(options, handler)
      n.handler = handler || options
      l.push(n)
      return n
    }

    const discovery = NodeTrust.discovery

    const swarm = new Libp2p({
      transport: [
        tcp
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

    const node = new Peer(ids[0])
    node.multiaddrs.add('/ip4/127.0.0.1/tcp/8899/ipfs/' + ids[0].toB58String())

    const nodetrust = new NodeTrust(swarm, {
      node: process.env.USE_PROD ? null : node,
      discovery
    })

    swarm.start(err => {
      if (err) throw err
      nodetrust.enable(err => {
        if (err) throw err
        let wss = ws.createListener({
          cert: nodetrust.chain,
          key: nodetrust.key
        }, l[0].handler) // use the handler from TCP
        wss.listen(multiaddr('/ip4/0.0.0.0/tcp/5285/ws'), err => {
          if (err) throw err
          const ma = '/dns/' + nodetrust.domain + '/tcp/5285/wss/'
          console.log('Online @ https://localhost:5285 & %s', ma)
          swarm.peerInfo.multiaddrs.add(ma)
          nodetrust.doAnnounce(err => err ? console.error('ANNOUNCE FAILED: %s', err) : false)
        })
      })
    })

    swarm.handle('/messages/1.0.0', conn => {
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
})
