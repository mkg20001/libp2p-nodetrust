'use strict'

const alphanum = require('base-x')('abcdefghijklmnopqrstuvwxyz0123456789')

module.exports = function idPrefix (id, suf) {
  let pref = 'id0'
  id = alphanum.encode(id).substr(0, 64 - pref.length - suf.length)
  return pref + id + suf
}
