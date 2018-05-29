'use strict'

const ppb = require('pull-protocol-buffers')
const pull = require('pull-stream')
const {Update, Response, ErrorType} = require('./proto')
const debug = require('debug')
const log = debug('nodetrust:dns:remote')

module.exports = (opt, access) => {
  log('remote DNS service started: %o', access)
  opt.swarm.handle('/nodetrust/_internal/dns/1.0.0', (proto, conn) => {
    conn.getPeerInfo((err, pi) => {
      if (err) return log(err)
      let id = pi.id.toB58String()
      let hasPermissions = access.indexOf(id) !== -1
      log('connection from %s (perm=%s)', id, hasPermissions)
      pull(
        conn,
        ppb.decode(Update),
        pull.map(req => {
          if (!hasPermissions) return {error: ErrorType.UNAUTHORIZED}
          let records = req.value.map(r => [r.type, r.value])
          if (!records.length) {
            log('%s: del %s', id, req.name)
            opt.dns.deleteRecords(req.name)
          } else {
            log('%s: add %s %o', id, req.name, records)
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
