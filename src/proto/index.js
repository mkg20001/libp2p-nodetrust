'use strict'

const ppb = require('pull-protocol-buffers')
const Pushable = require('pull-pushable')
const pull = require('pull-stream')
const {CertResponse} = require('./proto')

/*
Protocol tl;dr

C: connects
S: determines client ip, builds list of subdomains, requests cert for them, responds with cert
C: uses cert

*/

module.exports = class RPC {
  constructor (onCert) {
    this.onCert = onCert
    this.source = Pushable()
    this.source.end() // we will never send something to the server
    this.sink = this.sink.bind(this)
  }
  sink (read) {
    const next = (err, data) => {
      if (err) {
        if (err === true) err = new Error('Server unexpectedly closed the connection!')
        this.onCert(err)
      } else {
        if (data.error) {
          this.onCert(new Error('Server returned an error response!'))
        } else {
          delete data.error
          this.onCert(null, data)
        }
      }

      return read(true, () => {})
    }

    read(null, next)
  }
  setup (conn) {
    pull(
      conn,
      ppb.decode(CertResponse),
      this,
      conn
    )
  }
}
