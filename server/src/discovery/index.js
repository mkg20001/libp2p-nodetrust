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

  swarm.handle('/nodetrust/announce/1.0.0', (protocol, conn) => {
    protos.server(conn, protos.announce, (data, respond) => {
      const cb = err => {
        if (err) log(err)
        respond({
          success: false
        })
      }
      conn.getPeerInfo((err, pi) => {
        if (err) return cb(err)
        const id = pi.id.toB58String()
        if (!db.get(id)) return cb(new Error(id + ' has not requested a certificate! Rejecting announce...'))
        log('announce from %s', id)
        discoveryDB.set(id, data.multiaddr)
        return respond({
          success: true
        })
      })
    })
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
        const {numPeers} = data
        let randItem = Math.floor(Math.random() * discoveryDB.length)
        while (randItem + numPeers > discoveryDB.length) randItem--
        const from = randItem
        const to = randItem + numPeers
        log('discovery from %s want=%s give=(%s=>%s)/%s', id, data.numPeers, from, to, discoveryDB.length)
        const peers = discoveryDB.keys.slice(from, to).filter(i => i !== id).map(id => {
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
