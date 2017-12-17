'use strict'

const fs = require('fs')
const read = (file, desc) => {
  if (!fs.existsSync(file)) {
    throw new Error('Unable to find ' + desc + ' file ' + JSON.stringify(file))
  }
  return fs.readFileSync(file).toString()
}
const debug = require('debug')
const log = debug('nodetrust:ca:forge')

module.exports = class ForgeCA {
  constructor (swarm, config) {
    this.swarm = swarm
    this.config = config
    this.cert = read(config.cert, 'Certificate')
    this.key = read(config.key, 'Certificate Private Key')
    this.type = 'drop-wildcard'
  }

  getWildcard (id, cb) {
    log('dropping wildcard to %s', id.toB58String())
    cb(null, this.cert, this.key, this.cert)
  }
}
