'use strict'

const {waterfall} = require('async')
const once = require('once')
const debug = require('debug')
const log = debug('libp2p:nodetrust')
const noop = err => err ? log(err) : false

const Discovery = require('./discovery')
const {defaultNode} = require('./defaults')
const WS = require('libp2p-websockets')

module.exports = class Nodetrust {
  constructor (opt) {
    this.node = opt.node || defaultNode
    this.discovery = new Discovery()
  }
  __setSwarm (swarm) {
    this.discovery.__setSwarm(swarm)
    this.swarm = swarm
    if (!this.swarm.switch.transports.WebSockets) this.swarm.switch.transports.WebSockets = new WS() // HACK: hack in the wss transport for dialing. (needs some way to add transports at runtime)
  }

  start (cb) {
    log('starting')
    cb = once(cb || noop)
    waterfall([
      cb => this.swarm.dial(this.node, cb)
    ], cb)
  }

  stop (cb) {
    log('stopping')
    cb = once(cb || noop)
    cb()
  }
}
