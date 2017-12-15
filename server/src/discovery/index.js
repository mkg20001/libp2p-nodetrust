'use strict'

const protos = require('../protos')

const debug = require('debug')
const log = debug('nodetrust:discovery')

module.exports = (swarm) => {
  const {db, discoveryDB} = swarm

  db.on('evict', ({key}) => {
    discoveryDB.remove(key)
    discoveryDB.emit('evict', {key})
  })

  swarm.handle('/nodetrust/discovery/1.0.0', (protocol, conn) => {
    protos.server(conn, protos.discovery, (data, respond) => {
      const cb = err => {
        if (err) log(err)
        respond({
          success: false
        })
      }
      conn.getPeerInfo((err, pi) => {
        if (err) return cb(err)
        const id = pi.id.toB58String()
        if (!db.get(id)) return cb(new Error(id + ' has not requested a certificate! Rejecting discovery...'))
        log('discovery from %s want=%s', id, data.numPeers)
        discoveryDB.set(id, data.multiaddr)
        if (data.numPeers < 0) data.numPeers = 0
        if (data.numPeers > 100) data.numPeers = 100
        let randItem = Math.floor(Math.random() * discoveryDB.length)
        const numPeers = data.numPeers
        while (randItem + numPeers > discoveryDB.length) randItem--
        if (randItem < 0) randItem = 0
        const peers = discoveryDB.keys.slice(0, numPeers).filter(i => i !== id).map(id => {
          return {
            id,
            multiaddr: discoveryDB.peek(id)
          }
        })
        return respond({
          peers,
          success: true
        })
      })
    })
  })
}
