'use strict'

const named = require('named')
const TYPE = named.Protocol.queryTypes
const debug = require('debug')
const log = debug('nodetrust:server:dns:named')
const multiaddr = require('multiaddr')
const promisify = require('promisify-es6')

const ip4re = /^(\d{1,3}\.){3,3}\d{1,3}$/
const ip6re = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i

const alphanum = require('base-x')('abcdefghijklmnopqrstuvwxyz0123456789')
const bs58 = require('bs58')

function decodeAddr (addr, type) {
  let ip
  switch (addr.substr(0, 3)) {
    case 'ip4':
      ip = addr.substr(3).replace(/-/g, '.')
      if (!ip.match(ip4re) || type !== 'A') return false
      return ip
    case 'ip6':
      ip = addr.substr(3).replace(/-/g, ':')
      if (!ip.match(ip6re) || type !== 'AAAA') return false
      return ip
    default:
      return false
  }
}

function encodeAddr (ip) {
  switch (true) {
    case Boolean(ip.match(ip4re)):
      return 'ip4' + ip.replace(/\./g, '-')
    case Boolean(ip.match(ip6re)):
      return 'ip6' + ip.replace(/:/g, '-')
    default:
      return false
  }
}

module.exports = class DNSServer {
  constructor (logger, config) {
    this.log = logger
    this.address = multiaddr(config.addr).nodeAddress()
    this.ttl = config.ttl
    this.txtttl = config.txtttl
    this.myNS = config.ns
    this.server = named.createServer()
    this.server.on('query', q => this._handle.bind(this)(q, this.server.send.bind(this.server)))
    this.dns01 = {}
    this.dns01TO = {}
  }
  start () {
    log('starting')
    return promisify(this.server.listen.bind(this.server))(this.address.port, this.address.address)
  }
  stop () {
    log('stopping')
    for (const domain in this.dns01TO) { // clear dns01 timeouts
      clearTimeout(this.dns01TO[domain])
    }

    this.dns01 = {}
    this.dns01TO = {}

    return promisify(this.server.close.bind(this.server))()
  }
  _handle (query, send) { // TODO: legitify the dns response
    const domain = query.name().toLowerCase() //  [78.47.119.230:15900#8530] V8-8-8-8.iP.liBp2P-NODETrusT.tk, this is why
    let value
    let response

    const questionType = TYPE[query._question.type]
    const id = query._client.address + ':' + query._client.port + '#' + query.id

    if (questionType === 'ANY') {
      // TODO: respond with 'IN HINFO "ANY obsoleted" "See draft-ietf-dnsop-refuse-any"'
      response = 'ANY OBSOLETED'
    } else if (questionType === 'TXT' && (value = this.dns01[domain])) {
      query.addAnswer(domain, new named.TXTRecord(value), this.txtttl)
      response = 'ACME DNS-01'
    } else if (questionType === 'TXT' && domain.startsWith('p')) {
      let b58 = bs58.encode(alphanum.decode(domain.split('.')[0].substr(1)))
      query.addAnswer(domain, new named.TXTRecord('id=' + b58), this.ttl)
      response = 'ID0'
    } else if ((value = decodeAddr(domain.split('.')[0], questionType))) {
      query.addAnswer(domain, new named[questionType + 'Record'](value), this.ttl)
      response = 'DNS2IP'
    } else if (questionType === 'NS') {
      query.addAnswer(domain, new named.NSRecord(this.myNS))
      response = 'NS'
    } else {
      // TODO: behave like a normal dns server
      response = 'NONE'
    }

    this.log.info({domain, id, questionType, response})
    send(query)
  }
  setDNS01 (domain, value) {
    log('add dns-01 %s value %s', domain, value)
    clearTimeout(this.dns01TO[domain]) // clear existing timeout, if any
    this.dns01[domain] = value // set record
    this.dns01TO[domain] = setTimeout(() => { // set timeout for deletion
      log('delete dns-01 %s via timeout', domain)
      delete this.dns01[domain]
    }, this.txtttl)
  }
}

module.exports.decodeAddr = decodeAddr
module.exports.encodeAddr = encodeAddr
