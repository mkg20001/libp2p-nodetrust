'use strict'

const debug = require('debug')
const log = debug('nodetrust:client')

const promy = (fnc) => new Promise((resolve, reject) => fnc((err, res) => err ? reject(err) : resolve(res)))
const ppb = require('pull-protocol-buffers')
const pull = require('pull-stream')
const {IssueInfo, IssueRequest, IssueResponse, ProofResponse} = require('./proto.js')

const Peer = require('peer-info')
const Id = require('peer-id')

module.exports = async (swarm, node) => {
  log('getting cert from %s', node.id.toB58String())

  const conn = await promy(cb => swarm.dialProtocol(node, '/p2p/nodetrust/issue/info/1.0.0', cb))
  const infoPacket = await promy(cb => pull(pull.values([]), conn, ppb.decode(IssueInfo), pull.collect(cb)))
  const info = infoPacket[0]
  if (!info) { throw new Error('Got no info!') }
  log('cert domain is %s', info.domain)

  log('aquiring %s proof(s)', info.proofs.length)

  let proofs = await Promise.all(info.proofs.map(async (server) => {
    try {
      const pi = new Peer(new Id(server.id))
      server.addrs.forEach(addr => pi.multiaddrs.add(addr))
      log('aquire proof:%s from %s', server.display, pi.id.toB58String())
      const conn = await promy(cb => swarm.dialProtocol(pi, '/p2p/nodetrust/proof/1.0.0', cb))
      const proof = await promy(cb => pull(pull.values([]), conn, ppb.decode(ProofResponse), pull.collect(cb)))
      if (!proof[0]) { throw new Error('Got no proof!') }
      if (proof[0].error) { throw new Error('Proof error: ' + proof[0].error) }
      log('aquired proof:%s for %s', server.display, proof[0].proof.proof.addrs.map(a => a.address).join(', '))
      return proof[0].proof
    } catch (err) {
      log('failed to get proof:%s %s', server.display, err.stack)
      return false
    }
  }))
  proofs = proofs.filter(Boolean)

  log('aquired %s proof(s)', proofs.length)

  if (!proofs.length) { throw new Error('Could not aquire a single proof!') }

  log('aquire cert')

  const conn2 = await promy(cb => swarm.dialProtocol(node, '/p2p/nodetrust/issue/1.0.0', cb))
  const cert = await promy(cb => pull(pull.values([{proofs, supportedCryptos: [1]}]), ppb.encode(IssueRequest), conn2, ppb.decode(IssueResponse), pull.collect(cb)))
  if (!cert[0]) { throw new Error('Got no response!') }
  if (cert[0].error) { throw new Error('Issue error: ' + cert[0].error) }

  log('cert successfully aquired!')

  return cert[0]
}
