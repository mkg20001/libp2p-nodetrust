'use strict'

const protobuf = require('protons')
const pull = require('pull-stream')
const debug = require('debug')
const log = debug('nodetrust:error')
const once = require('once')
const multihashing = require('multihashing-async')
const base32Encode = require('base32-encode')

module.exports = {
  info: protobuf('message Request { } message Result { required string zone = 1; }'),
  ca: protobuf('message Request { required bytes certRequest = 1; required bytes signature = 2; } message Result { required bool success = 1; bytes certificate = 2; bytes fullchain = 3; }'),
  dns: protobuf('message Request { required int64 time = 1; required bytes signature = 2; } message Result { required bool success = 1; }'),
  discovery: protobuf('message Request { required int32 numPeers = 1; repeated bytes multiaddr = 2; } message Peer { required string id = 1; repeated bytes multiaddr = 2; } message Result { required bool success = 1; repeated Peer peers = 2; }'),
  server: (conn, def, cb) => {
    pull(
      conn,
      pull.collect((err, res) => {
        if (err) return log(err)
        try {
          cb(def.Request.decode(Buffer.concat(res)), data => {
            pull(
              pull.values([def.Result.encode(data)]),
              conn
            )
          })
        } catch (e) {
          log(e)
        }
      })
    )
  },
  client: (conn, def, data, cb) => {
    cb = once(cb)
    setTimeout(() => cb(new Error('Timeout')), 10 * 1000)
    pull(
      pull.values([def.Request.encode(data)]),
      conn,
      pull.collect((err, res) => {
        if (err) return cb(err)
        try {
          res = def.Result.decode(Buffer.concat(res))
          if (!res) throw new Error('Empty result')
        } catch (e) {
          cb(err)
        }
        cb(null, res)
      })
    )
  },
  buildCN: (id, zone, cb) => {
    multihashing(Buffer.from(id), 'sha2-256', (err, digest) => {
      if (err) return cb(err)
      id = base32Encode(digest, 'RFC4648').replace('=', '').toLowerCase()
      cb(null, id + '.' + zone)
    })
  }
}
