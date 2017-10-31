'use strict'

const protos = require('../protos')

const debug = require('debug')
const log = debug('nodetrust:ca')

module.exports = (swarm, config) => {
  let ca
  try {
    const CA = require('./' + config.provider)
    ca = new CA(swarm, config)
  } catch (e) {
    e.stack = 'Failed to load CA provider ' + config.provider + ': ' + e.stack
    throw e
  }

  swarm.handle('/nodetrust/ca/1.0.0', (protocol, conn) => {
    protos.server(conn, protos.ca, (data, respond) => {
      const cb = err => {
        if (err) log(err)
        respond({
          success: false
        })
      }
      conn.getPeerInfo((err, pi) => {
        if (err) return cb(err)
        const id = pi.id
        log('incomming certificate request from', pi.id.toB58String())
        id.pubKey.verify(data.certRequest, data.signature, (err, ok) => {
          if (err || !ok) return cb(err)
          swarm.getCN(id, (err, cn) => {
            if (err) return cb(err)
            ca.doCertRequest(data.certRequest, id, cn, data.signature, (err, certificate, fullchain) => {
              if (err) return cb(err)
              return respond({
                success: true,
                certificate,
                fullchain
              })
            })
          })
        })
      })
    })
  })
}
