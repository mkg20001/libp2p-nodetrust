'use strict'

const ppb = require('pull-protocol-buffers')
const Pushable = require('pull-pushable')
const pull = require('pull-stream')
const debug = require('debug')
const log = debug('nodetrust:protocol')

const {encodeAddr} = require('../dns')

const {ErrorType, CertificateEncodingType, KeyEncodingType, KeyType, CertificateResponse} = require('./proto')

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
      if (err) { // TODO: figure out how to detect le rate limits
        log(err)
        this.source.push({ error: ErrorType.OTHER })
      } else {
        this.source.push(Object.assign({ error: ErrorType.NONE }, res))
      }

      this.source.end()

      // read(true, () => {}) // we will never read from the client TODO: disable until issue is resolved
    }
    const ips = this.addr.map(a => a.toString()).filter(a => a.startsWith('/ip')).map(a => a.split('/')[2]) // TODO: filter unique
    const domains = ips.map(ip => encodeAddr(ip)).filter(Boolean).map(sub => sub + '.' + this.opt.zone)
    log('cert for %s %s', this.pi.id.toB58String(), domains.join(', '))
    this.opt.le.handleRequest(this.pi.id.toB58String(), this.opt.zone, domains, (err, res) => {
      if (err) return cb(err)
      let data = {
        cert: {
          certificate: {
            certificate: res.cert,
            encoding: CertificateEncodingType.PEM,
            keyType: KeyType.RSA
          },
          key: {
            key: res.privkey,
            encoding: KeyEncodingType.PEM_RSA,
            type: KeyType.RSA
          }
        },
        ca: {
          certificate: res.chain,
          encoding: CertificateEncodingType.PEM,
          keyType: KeyType.RSA
        }
      }
      return cb(null, data)
    })
  }
  setup (conn, cb) {
    conn.getObservedAddrs((err, addr) => {
      if (err) return cb(err)
      this.addr = addr
      conn.getPeerInfo((err, pi) => {
        if (err) return cb(err)
        this.pi = pi
        pull(
          conn,
          this,
          ppb.encode(CertificateResponse),
          conn
        )
        return cb()
      })
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
