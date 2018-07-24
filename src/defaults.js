'use strict'

const Id = require('peer-id')
const Peer = require('peer-info')

let defaultNode

defaultNode = new Peer(Id.createFromB58String('QmP44NJN9MyhZCTcPXqBNroW9ekkp5PFrMQRxRhuSzd3Mz'))
if (process.toString() === '[object process]') { // node
  /* defaultNode.multiaddrs.add('/dnsaddr/nodetrust.libp2p.io/tcp/8899/ipfs/Qm') */
  defaultNode.multiaddrs.add('/dnsaddr/issue.libp2p-nodetrust.tk/tcp/25893/ipfs/QmP44NJN9MyhZCTcPXqBNroW9ekkp5PFrMQRxRhuSzd3Mz')
  defaultNode.multiaddrs.add('/ip4/46.4.20.132/tcp/25893/ipfs/QmP44NJN9MyhZCTcPXqBNroW9ekkp5PFrMQRxRhuSzd3Mz')
} else { // browser
  /* defaultNode.multiaddrs.add('/dnsaddr/nodetrust.libp2p.io/tcp/443/wss/ipfs/Qm') */
  defaultNode.multiaddrs.add('/dnsaddr/libp2p-nodetrust.tk/tcp/443/wss/ipfs/QmP44NJN9MyhZCTcPXqBNroW9ekkp5PFrMQRxRhuSzd3Mz')
}

module.exports = {
  defaultNode
}
