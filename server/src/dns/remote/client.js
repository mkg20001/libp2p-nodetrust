'use strict'

const Peer = require('peer-info')
const Id = require('peer-id')
const Pushable = require('pull-pushable')
const pull = require('pull-stream')
const ppb = require('pull-protocol-buffers')
const {Update, Response} = require('./proto')
const debug = require('debug')
const log = debug('nodetrust:dns:remote:client')

let errorTable = {
  1: 'Unauthorized',
  9: 'Unknown Error'
}

class RPC {
  constructor (conn) {
    this.source = Pushable()
    this.cbs = []

    pull(
      conn,
      ppb.decode(Response),
      this,
      ppb.encode(Update),
      conn
    )

    this.online = true
  }

  sink (read) {
    let next = (end, data) => {
      if (end) {
        log('rpc err %s', end)
        this.online = false
        this.source.end()
        this.cbs.forEach(cb => cb(new Error('Server disconnected')))
        return
      }

      let cb = this.cbs.shift()
      if (!cb) return read(null, next)

      let err

      if (data.error) err = new Error('Server returned error: ' + (errorTable[data.error] || 'N/A'))

      log('got resp: %s', err || 'ok')

      setImmediate(() => cb(err))

      return read(null, next)
    }

    read(null, next)
  }

  exec (param, cb) {
    if (!this.online) return cb(new Error('Server not connected'))
    this.cbs.push(cb)
    this.source.push(param)
  }
}

class Client {
  constructor (opt, main) {
    let addr = opt.addr
    this.swarm = main.swarm
    this.peer = new Peer(Id.createFromB58String(addr.split('ipfs/').pop()))
    this.peer.multiaddrs.add(addr)
  }
  dial (cb) {
    if (this.dialing) return this.dialCBs.push(cb)
    log('dialing')
    this.dialing = true
    this.dialCBs = []
    this.swarm.dialProtocol(this.peer, '/nodetrust/_internal/dns/1.0.0', (err, conn) => {
      let cbs = this.dialCBs
      this.dialing = false
      delete this.dialCBs
      if (err) {
        cb(err)
        return cbs.forEach(() => cb(err))
      }
      this._rpc = new RPC(conn)
      cbs.forEach(() => cb())
      cb()
    })
  }
  rpc (param) {
    return new Promise((resolve, reject) => {
      if (!this._rpc || !this._rpc.online) return this.dial(err => {
        if (err) return reject(err)
        this.rpc(param, cb).then(resolve, reject)
      })
      log('rpc exec %o', param)
      this._rpc.exec(param, e => e ? reject(e) : resolve())
    })
  }
  addRecords (domain, rec) {
    return this.rpc({name: domain, value: rec.map(r => { return { type: r[0], value: r[1] } }) })
  }
  deleteRecords (domain) {
    return this.rpc({name: domain})
  }
  start (cb) {
    this.dial(cb)
  }
  stop (cb) {
    cb()
  }
}

module.exports = Client
