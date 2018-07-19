'use strict'

const debug = require('debug')
const log = debug('nodetrust:server:issue:dns-client')
const promisify = require('promisify-es6')

const pull = require('pull-stream')
const ppb = require('pull-protocol-buffers')
const Pushable = require('pull-pushable')
const {DNS01Request, DNS01Response} = require('../proto')
const once = require('once')

class DNS {
  constructor (pi, swarm) {
    this.pi = pi
    this.swarm = swarm
  }

  async connect () {
    log('connecting')
    const conn = await promisify(cb => this.swarm.dialProtocol(this.pi, '/p2p/nodetrust/dns-01/1.0.0', cb))()

    const source = Pushable()

    let cbs = []
    let online = true

    log('doing rpc')
    pull(
      source,
      ppb.encode(DNS01Request),
      conn,
      ppb.decode(DNS01Response),
      pull.drain((res) => {
        log('got res %o', res)
        let cb
        if (typeof (cb = cbs.shift()) === 'function') {
          log('res has cb')
          cb(null, res)
        }
      }, () => {
        log('disconnected')
        online = false
        cbs.forEach(cb => cb(new Error('Disconnected')))
        cbs = null
      })
    )

    return {
      rpc: promisify((req, cb) => {
        log('sending rpc %o', req)
        cb = once(cb)
        setTimeout(() => cb(new Error('Timeout')), 10 * 1000)
        cbs.push(cb)
        source.push(req)
      }),
      online: () => online
    }
  }

  async setDNS01 (fqdn, value) {
    log('sending add %s %s', fqdn, value)
    if (!this.rpc || !this.rpc.online()) { this.rpc = await this.connect() }
    const resp = await this.rpc.rpc({fqdn, value})
    if (resp.error) throw new Error('DNS Error: ' + resp.error)
  }

  async start () {
    if (!this.rpc || !this.rpc.online()) { this.rpc = await this.connect() }
  }
}

module.exports = DNS
