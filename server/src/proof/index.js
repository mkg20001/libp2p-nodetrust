'use strict'

const debug = require('debug')
const log = debug('nodetrust:server:proof')
const pull = require('pull-stream')
const ppb = require('pull-protocol-buffers')
const {Proof, ProofResponse} = require('../proto')
const Id = require('peer-id')
const mafmt = require('mafmt')
const promisify = require('promisify-es6')
const multiaddr = require('multiaddr')

const ma2ipTYPE = { // convert multiaddrs type to AddressType type
  4: 1, // IPv4
  41: 2 // IPv6
}

async function generateProof (addrs, id, key) {
  const proof = {
    id,
    timestamp: Date.now(),
    addrs: addrs.map(multiaddr).filter(mafmt.TCP.matches).map((addr) => {
      let ip = addr.stringTuples()[0]
      return {
        type: ma2ipTYPE[ip[0]],
        address: ip[1]
      }
    })
  }
  const data = Proof.encode(proof)
  const signature = await promisify(cb => key.privKey.sign(data, cb))()
  return {proof, signature}
}

class ProofService {
  constructor (node, config) {
    this.node = node
    this.config = config
  }

  async start () {
    this.proofKey = await promisify(cb => Id.createFromPrivKey(this.config.key, cb))()

    this.node.handle('/p2p/nodetrust/proof/1.0.0', (proto, conn) => {
      conn.getPeerInfo((err, pi) => {
        if (err) {
          return log(err)
        }

        const id = pi.id.toBytes()

        conn.getObservedAddrs((err, addrs) => {
          if (err) {
            return log(err)
          }

          this.handle(conn, addrs, id)
        })
      })
    })
  }

  async stop () {
    this.node.unhandle('/p2p/nodetrust/proof/1.0.0')
  }

  async handle (conn, addrs, id) {
    let proof

    try {
      proof = await generateProof(addrs, id, this.proofKey)
      proof.error = 0
    } catch (err) {
      log(err)
      proof.error = 9
    }

    pull(
      pull.values(proof),
      ppb.encode(ProofResponse),
      conn,
      pull.drain()
    )
  }
}

module.exports = {
  libp2pConfig: { // libp2p config
    peerDiscovery: {},
    relay: { // Circuit Relay options
      enabled: false,
      hop: { enabled: false, active: false }
    },
    // Enable/Disable Experimental features
    EXPERIMENTAL: { pubsub: false, dht: false }
  },
  template: { // template for config creation
    swarm: {
      addrs: [
        '/ip4/0.0.0.0/tcp/25892'
      ]
    },
    proof: {
      key: 'Add private proof key here'
    }
  },
  create: (node, config) => new ProofService(node, config)
}
