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

  const catype = swarm.catype = ca.type

  let typeHandler

  switch (catype) {
    case 'csr-ca':
      typeHandler = (protocol, conn, data, respond) => {
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
          (pi, cb) => {
            const id = pi.id
            id.pubKey.verify(data.certRequest, data.signature, (err, ok) => {
              if (err || !ok) return cb(err || true)
              cb(null, id)
            })
          },
          (id, cb) => {
            swarm.getCN(id, (err, cn) => {
              if (err) return cb(err)
              cb(null, cn, id)
            })
          },
          (cn, id, cb) => {
            ca.doCertRequest(data.certRequest, id, cn, data.signature, (err, certificate, fullchain) => {
              if (err) return cb(err)
              swarm.db.set(id.toB58String(), true)
              return respond({
                success: true,
                certificate,
                fullchain
              })
            })
          }
        ], cb)
      }
      break
    case 'drop-wildcard':
      typeHandler = (protocol, conn, data, respond) => {
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
          (pi, cb) => {
            ca.getWildcard(pi.id, (err, certificate, key, fullchain) => {
              if (err) return cb(err)
              swarm.db.set(pi.id.toB58String(), true)
              return respond({
                success: true,
                certificate,
                key,
                fullchain
              })
            })
          }
        ], cb)
      }
      break
    default:
      throw new Error('Invalid CA-TYPE: ' + catype)
  }

  swarm.handle('/nodetrust/ca/1.0.0', (protocol, conn) => {
    protos.server(conn, protos.ca, (data, respond) => typeHandler(protocol, conn, data, respond))
  })
}
