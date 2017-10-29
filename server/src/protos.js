'use strict'

const protobuf = require('protons')
const pull = require('pull-stream')
const debug = require('debug')
const log = debug('error')

module.exports = {
  ca: protobuf('message Request { required bytes certRequest = 1; required bytes signature = 2; } message Result { required bool success = 1; bytes certificate = 2; }'),
  dns: protobuf('message Request { required int time = 1; required bytes signature = 2; } message Result { required bool success = 1; }'),
  discovery: protobuf('message Request { required int numPeers = 1; repeated bytes multiaddr = 2; } message Peer { required string id = 1; repeated bytes multiaddr = 2; } message Result { repeated Peer peers = 1; }'),
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
    pull(
      pull.values([def.Request.encode(data)]),
      conn,
      pull.collect((err, res) => {
        if (err) return cb(err)
        try {
          cb(null, def.Result.decode(Buffer.concat(res)))
        } catch (e) {
          cb(err)
        }
      })
    )
  }
}
