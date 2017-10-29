'use strict'

const protos = require('./protos')
const Id = require('peer-id')
const Peer = require('peer-info')
const defaultNode = new Peer(Id.fromB58String('Qm')) //TODO: add the official node

module.exports = class NodeTrust {
  constructor(swarm, config) {
    this.swarm = swarm
    this.config = config || {}
    this.id = this.swarm.peerInfo.id
    this.node = config.node || defaultNode

    this.swarm.nodetrust = this
  }
  enable(cb) {

  }

  // Certificate

  getCert(cb) {
    this._getCertRequest(this.id, (err, request) => {
      if (err) return cb(err)
      this.id.sign(request, (err, sign) => {
        if (err) return cb(err, sign)
        this._getCert(request, sign, cb)
      })
    })
  }
  _getCert(certRequest, signature, cb) {
    this.swarm.dial(this.node, '/nodetrust/ca/1.0.0', (err, conn) => {
      if (err) return cb(err)
      protos.client(conn, protos.ca, {
        certRequest,
        signature
      }, (err, res) => {
        if (err) return cb(err)
        if (!res.success || !res.certificate || !res.certificate.length) return cb(new Error('Server did not complete certificate request'))
        cb(null, res.certificate)
      })
    })
  }
  _getCertRequest(id, cb) {

  }

  // DNS

  renewDNS(cb) {
    const time = new Date().getTime()
    this.id.sign(time.toString(), (err, signature) => {
      if (err) return cb(err)

      this.swarm.dial(this.node, '/nodetrust/dns/1.0.0', (err, conn) => {
        if (err) return cb(err)
        protos.client(conn, protos.ca, {
          time,
          signature
        }, (err, res) => {
          if (err) return cb(err)
          if (!res.success) return cb(new Error('Server did not complete certificate request'))
          cb()
        })
      })
    })
  }
}
