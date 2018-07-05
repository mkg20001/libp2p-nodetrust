'use strict'

const multihashing = require('multihashing-async')
const domainBase = require('base-x')('abcdefghijklmnopqrstuvwxyz0123456789')

module.exports = function idPrefix (id, zone, cb) { // TODO: maybe refactor/drop this method as it isn't so cryptographically safe
  let pref = 'id0'
  let suf = '.' + zone
  multihashing(Buffer.from(id), 'sha3-224', (err, digest) => {
    if (err) return cb(err)
    id = domainBase.encode(digest).substr(0, 64 - pref.length - suf.length)
    cb(null, pref + id + suf)
  })
}
