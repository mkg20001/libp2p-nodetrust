'use strict'

const protos = require('../protos')

const debug = require('debug')
const log = debug('nodetrust:ca')
const {
  waterfall
} = require('async')

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
        if (err) {
          log(err)
          respond({
            success: false
          })
        }
      }
      waterfall([
        cb => conn.getPeerInfo(cb),
        (cb, pi) => {
          const id = pi.id
          id.pubKey.verify(data.certRequest, data.signature, (err, ok) => {
            if (err || !ok) return cb(err || true)
            cb(null, id)
          })
        },
        (cb, id) => {
          swarm.getCN(id, (err, cn) => {
            if (err) return cb(err)
            cb(null, cn, id)
          })
        },
        (cb, cn, id) => {
          ca.doCertRequest(data.certRequest, id, cn, data.signature, (err, certificate, fullchain) => {
            if (err) return cb(err)
            return respond({
              success: true,
              certificate,
              fullchain
            })
          })
        }
      ], cb)
    })
  })
}
