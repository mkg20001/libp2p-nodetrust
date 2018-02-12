'use strict'

const named = require('named')
const TYPE = named.Protocol.queryTypes
const debug = require('debug')
const log = debug('nodetrust:dns')

const ip4re = /^(\d{1,3}\.){3,3}\d{1,3}$/
const ip6re = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i

function decodeAddr (addr) {
  let ip
  switch (addr.substr(0, 2)) {
    case 'v4':
      ip = addr.substr(2).replace(/-/g, '.')
      if (!ip.match(ip4re)) return []
      return [['A', ip]]
      break
    case 'v6':
      ip = addr.substr(2).replace(/-/g, ':')
      if (!ip.match(ip6re)) return []
      return [['AAAA', ip]]
      break
    default:
      return []
  }
}

module.exports = class DNSServer {
  constructor (opt) {
    this.opt = opt || {}
    this.port = opt.port || 53
    this.host = opt.host || '127.0.0.1'
    this.ttl = opt.ttl || 3600
    this.server = named.createServer()
    this.server.on('query', q => this._handle.bind(this)(q, this.server.send.bind(this.server)))
    this._db = {}
  }
  start (cb) {
    this.server.listen(this.port, this.host, cb)
    cb()
  }
  _handle (query, send) { // TODO: legitify the dns response
    const domain = query.name()
    const res = decodeAddr(domain.split('.')[0]).concat(this._db[domain] || [])
    const id = query._client.address + ':' + query._client.port + '#' + query.id
    res.forEach(r => {
      const [type, value] = r
      if (TYPE[query._question.type] === type || TYPE[query._question.type] === 'ANY') { // only answer things we should answer
        log('[%s]\t%s\t=>\t[%s]\t%s', id, domain, type, value)
        query.addAnswer(domain, new named[type + 'Record'](value), this.ttl)
      }
    })
    if (!res.length) log('[%s]\t%s\t=>\t×', id, domain)
    send(query)
  }
  addRecords (domain, records) {
    this._db[domain] = records
  }
  deleteRecords (domain) {
    delete this._db[domain]
  }
}

module.exports.decodeAddr = decodeAddr
