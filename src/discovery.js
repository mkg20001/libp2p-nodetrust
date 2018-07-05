'use strict'

const protons = require('protons')
const {Announce} = protons('message Announce { repeated bytes addr = 1; }')
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
  constructor () {
    super()
    this.tag = 'nodetrust'
  }

  start (cb) {
    log('starting')
    cb = once(cb || noop)
    cb()

    setTimeout(() => { // HACK: pubsub not started yet, need to do this async. more chicken&egg
      cb = noop
      this.pubsub.subscribe(CHANNEL, this._handle.bind(this), cb)
    }, 1000)
  }

  stop (cb) {
    log('stopping')
    cb = once(cb || noop)
    this.pubsub.unsubscribe(CHANNEL, cb)
  }

  _handle (data) {
    try {
      const peer = new Peer(Id.createFromB58String(data.from))
      data = Announce.decode(data.data)
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
    this.pubsub.publish(CHANNEL, Announce.encode({ addr: peer.multiaddrs.toArray().map(a => a.buffer) }), cb)
  }

  __setSwarm (swarm) {
    this.pubsub = swarm.pubsub
  }
}
