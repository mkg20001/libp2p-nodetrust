'use strict'

const ppb = require('pull-protocol-buffers')
const pull = require('pull-stream')
const {Update, Response, ErrorType} = require('./proto')

module.exports = (opt, access) => {
  opt.swarm.handle('/nodetrust/_internal/dns/1.0.0', (proto, conn) => {
    conn.getPeerInfo((err, pi) => {
      let id = pi.id.toB58String()
      let hasPermissions = access.indexOf(id) !== -1
      pull(
        conn,
        ppb.decode(Update),
        pull.map(req => {
          if (!hasPermissions) return {error: ErrorType.UNAUTHORIZED}
          let records = req.value.map(r => [r.type, r.value])
          if (!records.length) {
            opt.dns.deleteRecords(req.name)
          } else {
            opt.dns.addRecords(req.name, records)
          }
          return {error: 0}
        }),
        ppb.encode(Response),
        conn
      )
    })
  })
}
