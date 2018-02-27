'use strict'

const protons = require('protons')
const {Announce} = protons('message Announce { required bytes id = 1; repeated bytes addr = 2; }')
const Id = require('peer-id')
const Peer = require('peer-info')
const multiaddr = require('multiaddr')
const debug = require('debug')
const log = debug('libp2p:nodetrust:discovery')
const once = require('once')

const CHANNEL = '_nodetrust_discovery_v2'
const EE = require('events').EventEmitter
const noop = () => {}

module.exports = class Discovery extends EE {
  start (cb) {
    log('starting')
    cb = once(cb || noop)
    this.pubsub.subscribe(CHANNEL, this._handle.bind(this), cb)
  }

  stop (cb) {
    log('stopping')
    cb = once(cb || noop)
    this.pubsub.unsubscribe(CHANNEL, cb)
  }

  _handle (data) {
    try {
      data = Announce.decode(data.data)
      const peer = new Peer(new Id(data.id))
      data.addr.forEach(addr => peer.multiaddrs.add(multiaddr(addr)))
      log('discovered %s', peer.id.toB58String())
      this.emit('peer', peer)
    } catch (e) {
      log(e)
    }
  }

  _broadcast (peer, cb) {
    log('broadcasting')
    cb = once(cb || noop)
    this.pubsub.publish(CHANNEL, Announce.encode({ id: peer.id.toBytes(), addr: peer.multiaddrs.toArray().map(a => a.buffer) }), cb)
  }

  __setSwarm (swarm) {
    this.pubsub = swarm.pubsub
  }
}
