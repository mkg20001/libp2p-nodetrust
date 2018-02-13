/* eslint-env mocha */
'use strict'

const {
  map
} = require('async')
const PeerId = require('peer-id')

before(function (cb) {
  map(require('./ids.json'), PeerId.createFromJSON, (e, ids) => {
    if (e) return cb(e)
    global.id = ids[0]
    global.ids = ids
    cb()
  })
})
