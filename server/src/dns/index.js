const protos = require('../protos')

const debug = require('debug')
const log = debug('nodetrust:dns')

module.exports = (swarm, config) => {
  let dns
  try {
    dns = require("./" + config.provider)
    dns = new dns(swarm, config)
  } catch (e) {
    e.stack = "Failed to load DNS provider " + config.provider + ": " + e.stack
    throw e
  }

  swarm.handle('/nodetrust/dns/1.0.0', (protocol, conn) => {
    protos.server(conn, protos.dns, (data, respond) => {
      const cb = err => {
        if (err) log(err)
        respond({
          success: false
        })
      }
      conn.getPeerInfo((err, pi) => {
        if (err) return cb(err)
        const id = pi.id
        id.verify(data.certRequest, data.signature, (err, ok) => {
          if (err || !ok) return cb(err)
          ca.doCertRequest(data.certRequest, data.signature, (err, certificate) => {
            if (err) return cb(err)
            return respond({
              success: true,
              certificate
            })
          })
        })
      })
    })
  })
}
