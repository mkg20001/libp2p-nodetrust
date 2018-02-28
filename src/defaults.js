'use strict'

const Id = require('peer-id')
const Peer = require('peer-info')

let defaultNode

defaultNode = new Peer(Id.createFromB58String('QmQvFUNc1pKcUAoekE1XxS5TsMSDB9dw5CYkRxRiDGfFsX'))
if (process.toString() !== '[object process]') { // browser
  /* defaultNode.multiaddrs.add('/dnsaddr/nodetrust.libp2p.io/tcp/8899/ipfs/Qm') */
  defaultNode.multiaddrs.add('/ip4/88.99.229.51/tcp/8877/ws/ipfs/QmQvFUNc1pKcUAoekE1XxS5TsMSDB9dw5CYkRxRiDGfFsX')
} else {
  /* defaultNode.multiaddrs.add('/dnsaddr/nodetrust.libp2p.io/tcp/443/wss/ipfs/Qm') */
  defaultNode.multiaddrs.add('/dnsaddr/libp2p-nodetrust.tk/tcp/443/wss/ipfs/QmQvFUNc1pKcUAoekE1XxS5TsMSDB9dw5CYkRxRiDGfFsX')
}

module.exports = {
  defaultNode
}
