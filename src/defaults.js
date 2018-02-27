'use strict'

const Id = require('peer-id')
const Peer = require('peer-info')

let defaultNode

defaultNode = new Peer(Id.createFromB58String('Qm'))
if (process.toString() === '[object process]') {
  /* defaultNode.multiaddrs.add('/dnsaddr/nodetrust.libp2p.io/tcp/8899') */
  defaultNode.multiaddrs.add('/dnsaddr/libp2p-nodetrust.tk/tcp/8899')
} else {
  /* defaultNode.multiaddrs.add('/dnsaddr/nodetrust.libp2p.io/tcp/8899') */
  defaultNode.multiaddrs.add('/dnsaddr/libp2p-nodetrust.tk/tcp/8899/ws')
}

module.exports = {
  defaultNode
}
