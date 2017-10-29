'use strict'

const protos = require('../protos')

const debug = require('debug')
const log = debug('nodetrust:discovery')

module.exports = (swarm, config) => {
  let discoveryDB = {}
  let peerIDs = []
  let lastUpdate = {}

  const expire = config.expire || 5 * 60 * 1000

  function updateDB() {
    const time = new Date().getTime()
    let deleteId = []
    for (const id in lastUpdate) {
      const expireTime = lastUpdate[id]
      if (expireTime < time) {
        log('%s has expired, removing', id)
        delete discoveryDB[id]
        deleteId.push(id)
      }
    }
    peerIDs = peerIDs.filter(id => deleteId.indexOf(id) == -1)
  }

  setInterval(updateDB, 5000)

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
        if (peerIDs.indexOf(id) == -1) {
          log('adding %s', id)
          peerIDs.push(id)
        }
        lastUpdate[id] = new Date().getTime() + expire
        discoveryDB[id] = data.multiaddr
        if (data.numPeers < 0) data.numPeers = 0
        if (data.numPeers > 100) data.numPeers = 100
        let randItem = Math.floor(Math.random() * peerIDs.length)
        const numPeers = data.numPeers
        while (randItem + numPeers > peerIDs.length) randItem--
          if (randItem < 0) randItem = 0
        const peers = peerIDs.slice(0, numPeers).filter(i => i != id).map(id => {
          return {
            id,
            multiaddr: discoveryDB[id]
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
