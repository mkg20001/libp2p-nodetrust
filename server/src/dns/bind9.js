'use strict'

const fs = require('fs')
const debug = require('debug')
const log = debug('nodetrust:dns:bind9')

function negativeSpace(len, str) {
  return ' '.repeat(len - str.toString().length) + str
}

function ZoneFile(opt, names) {
  let out = []
  //comment header
  out.push('; ' + opt.comment, ';')
  //ttl
  out.push(['$TTL', opt.ttl])
  //header
  out.push(['@', 'IN', 'SOA', opt.zone_ns + ' ' + opt.zone_hostmaster + ' ('])
  out.push('\t\t\t' + negativeSpace(7, opt.serial) + '\t\t; Serial')
  out.push('\t\t\t' + negativeSpace(7, opt.refresh) + '\t\t; Refresh')
  out.push('\t\t\t' + negativeSpace(7, opt.retry) + '\t\t; Retry')
  out.push('\t\t\t' + negativeSpace(7, opt.expire) + '\t\t; Expire')
  out.push('\t\t\t' + negativeSpace(7, opt.negative_cache_ttl) + '\t)\t; Negative Cache TTL')
  out.push(';')
  names.forEach(name => out.push([name.dns, 'IN', name.type, name.value]))

  return out.reduce((a, b) => Array.isArray(b) ? a + '\n' + b.join('\t') : a + '\n' + b, ';') + '\n'
}

/*console.log(ZoneFile({
  comment: 'BIND data file for local loopback interface',
  ttl: 604800,
  zone_ns: 'localhost.',
  zone_hostmaster: 'root.localhost.',
  serial: 2,
  refresh: 604800,
  retry: 86400,
  expire: 2419200,
  negative_cache_ttl: 604800
}, [{
    dns: '@',
    type: 'NS',
    value: 'localhost.'
  },
  {
    dns: '@',
    type: 'A',
    value: '127.0.0.1'
  },
  {
    dns: '@',
    type: 'AAAA',
    value: '::1'
  }
]))*/

module.exports = class Bind9DNS {
  constructor(swarm, config) {
    this.swarm = swarm
    this.config = config
    this.zoneopt = config.zone_opt
    this.zoneopt.serial = 0
    this.names = config.extra_names || []
    this.zonefile = config.zone_file
    if (fs.existsSync(this.zonefile)) {
      const serial = fs.readFileSync(this.zonefile).toString().split('\n').filter(l => l.endsWith('; Serial')).shift()
      if (serial) this.zoneopt.serial = parseInt(serial.match(/([0-9]+)/)[1], 10)
    }
  }

  clearAllForDomain(domain, cb) {
    log('clearing domain', domain)
    this.names = this.names.filter(d => d.dns !== domain)
    this._writeZoneFile(cb)
  }

  addNames(names, cb) {
    log('adding names', names)
    this.names = this.names.concat(names)
    this._writeZoneFile(cb)
  }

  _writeZoneFile(cb) {
    log('writing zone file', this.zonefile)
    this.zoneopt.serial++
    fs.writeFile(this.zonefile, Buffer.from(ZoneFile(this.zoneopt, this.names)), cb)
  }

}
