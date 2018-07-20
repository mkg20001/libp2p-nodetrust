'use strict'

const alphanum = require('base-x')('abcdefghijklmnopqrstuvwxyz0123456789')
const assert = require('assert')
const pref = 'p'

module.exports = function idPrefix (id, suf) {
  assert(alphanum.encode(id).length <= 64 - pref.length - suf.length, 'domain not suitable for id0')
  id = alphanum.encode(id).substr(0, 64 - pref.length - suf.length)
  return pref + id + suf
}
