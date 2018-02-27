'use strict'

const Peer = require('peer-info')
const Id = require('peer-id')
let node
if (!process.env.USE_LOCAL) {
  node = new Peer(Id.createFromB58String('QmQvFUNc1pKcUAoekE1XxS5TsMSDB9dw5CYkRxRiDGfFsX'))
  node.multiaddrs.add('/ip4/88.99.229.51/tcp/8899/ipfs/QmQvFUNc1pKcUAoekE1XxS5TsMSDB9dw5CYkRxRiDGfFsX')
} else {
  node = new Peer(Id.createFromB58String('QmRQuY14GoeyDx5DoFWq9xnCteSz6pWFKcopvJspei5LXa'))
  node.multiaddrs.add('/ip4/127.0.0.1/tcp/8899/ipfs/QmRQuY14GoeyDx5DoFWq9xnCteSz6pWFKcopvJspei5LXa')
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
      swarm.dial(multiaddr('/ip4/127.0.0.1/tcp/' + client.wss.port + '/ws/ipfs/' + swarm.peerInfo.id.toB58String()), console.log.bind(null, 'Dial over localhost: %s'))
    })
  })
})
require('./test/load-ids')
