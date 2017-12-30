'use strict'

const fs = require('fs')
const debug = require('debug')
const log = debug('nodetrust:dns:memory')

module.exports = class MemoryDNS {
  constructor () {
    log('WARNING: DON\'T USE THIS IN PRODUCTION')
    this.names = []
  }

  removeNames (names, cb) {
    log('removing names', names)
    this.names = this.names.filter(n2 => names.filter(n => n.name === n2.name && n.type === n2.type))
    cb()
  }

  addNames (names, cb) {
    this.removeNames(names, () => {}) // clears them up beforehand so we don't get duplicates
    log('adding names', names)
    this.names = this.names.concat(names)
    cb()
  }

  clearDomain (domain, cb) {
    this.removeNames(this.names.filter(n => n.name === domain), cb)
  }

  getNames (cb) {
    log('getting names')
    return cb(null, this.names)
  }
}
