'use strict'

/* eslint-disable no-console */

const Peer = require('peer-info')
const Id = require('peer-id')
let node
if (process.env.USE_LOCAL) {
  node = new Peer(Id.createFromB58String('QmNnMDsFRCaKHd8Tybhui1eVuN7xKMMqRZobAEtgKBJU5t'))
  node.multiaddrs.add('/ip4/127.0.0.1/tcp/8899/ipfs/QmNnMDsFRCaKHd8Tybhui1eVuN7xKMMqRZobAEtgKBJU5t')
}
const {createClient} = require('./test/utils')
const multiaddr = require('multiaddr')

global.before = fnc => fnc(err => {
  if (err) throw err
  const [swarm, client] = createClient({node}, err => {
    if (err) throw err
    console.log('Getting certificate...')
    client.start(err => {
      if (err) throw err
      swarm.peerInfo.multiaddrs.toArray().map(a => a.toString()).forEach(addr => {
        console.log('Listening on %s', addr)
      })
      console.log('Dialing us...')
      swarm.dial(multiaddr(client._addedMAs[0]), console.log.bind(null, 'Dial over external address: %s'))
      swarm.dial(multiaddr('/ip4/127.0.0.1/tcp/' + client.wss.port + '/wss/ipfs/' + swarm.peerInfo.id.toB58String()), console.log.bind(null, 'Dial over localhost: %s'))
    })
  })
})
require('./test/load-ids')
