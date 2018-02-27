'use strict'

const ppb = require('pull-protocol-buffers')
const Pushable = require('pull-pushable')
const pull = require('pull-stream')
const debug = require('debug')
const log = debug('nodetrust:protocol')

const {encodeAddr} = require('../dns')

const {CertResponse} = require('./proto')

/*
Protocol tl;dr

C: connects
S: determines client ip, builds list of subdomains, requests cert for them, responds with cert
C: uses cert

TODO: rate limit

*/

class RPC {
  constructor (opt) {
    this.opt = opt
    this.source = Pushable()
    this.sink = this.sink.bind(this)
  }
  sink (read) {
    const cb = (err, res) => {
      if (err) {
        log(err)
        this.source.push({ error: true })
      } else {
        this.source.push(Object.assign({ error: false }, res))
      }

      this.source.end()

      // read(true, () => {}) // we will never read from the client TODO: disable until issue is resolved
    }
    const ips = this.addr.map(a => a.toString()).filter(a => a.startsWith('/ip')).map(a => a.split('/')[2]) // TODO: filter unique
    const domains = ips.map(ip => encodeAddr(ip)).filter(Boolean).map(sub => sub + '.' + this.opt.zone)
    log('cert for %s', domains.join(', '))
    this.opt.le.handleRequest(domains, cb)
  }
  setup (conn, cb) {
    conn.getObservedAddrs((err, addr) => {
      if (err) return cb(err)
      this.addr = addr
      pull(
        conn,
        this,
        ppb.encode(CertResponse),
        conn
      )
      return cb()
    })
  }
}

module.exports = (opt) => {
  opt.swarm.handle('/nodetrust/2.0.0', (proto, conn) => {
    const rpc = new RPC(opt)
    rpc.setup(conn, err => {
      if (err) return log(err)
    })
  })
}
