'use strict'

const lp = require('pull-length-prefixed')
const ppb = require('pull-protocol-buffers')
const Pushable = require('pull-pushable')
const pull = require('pull-stream')
const debug = require('debug')
const log = debug('nodetrust:protocol')
const forge = require('forge')
const {pki} = forge

const {decodeAddr} = require('../dns')

const {Info, CertRequest, CertResponse} = require('./proto')

/*
Protocol tl;dr

C: connects
S: sends Info
C: determines own ip, generates csr, sends CertRequest
S: performs letencrypt magic via dns, obtains cert, send cert back

NOTE: after info the client can send as many certrequests as needed (client may have multiple ips)

TODO: rate limit

*/

class RPC {
  constructor (opt) {
    this.opt = opt
    this.source = Pushable()
    this.sink = this.sink.bind(this)
  }
  sink (read) {
    const next = (err, data) => {
      if (err) {
        this.source.end()
        return read(err, next)
      }
      const cb = (err, cert) => {
        if (err) {
          log(err)
          return this.source.push(CertResponse.encode({
            error: true
          }))
        }
        return this.source.push(CertResponse.encode({
          error: false,
          cert
        }))
      }
      const d = decodeAddr(data.sub)
      if (!d.length) return cb(new Error('Invalid subdomain'))
      let csr
      try {
        csr = pki.certificationRequestToPem(forge.util.encodeUtf8(data.csr))
        // TODO: check if CN matches
      } catch (e) {
        return cb(e)
      }
      this.opt.le.handleRequest(data, d, csr)
    }
    read(null, next)
  }
  setup (conn, cb) {
    conn.getObservedAddrs((err, addr) => {
      if (err) return cb(err)
      this.source.push(Info.encode({
        zone: this.opt.zone,
        remoteAddr: addr.map(a => a.buffer)
      }))
      pull(
        conn,
        ppb.decode(CertRequest),
        this,
        lp.encode(),
        conn
      )
      return cb()
    })
  }
}
