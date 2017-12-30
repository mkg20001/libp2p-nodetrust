/* eslint-env mocha */
'use strict'

const {
  map
} = require('async')
const PeerId = require('peer-id')
const cp = require('child_process')
const fs = require('fs')
const path = require('path')

before(function (cb) {
  map(require('./ids.json'), PeerId.createFromJSON, (e, ids) => {
    if (e) return cb(e)
    global.id = ids[0]
    global.ids = ids
    if (!fs.existsSync(path.join('server/wildcert.pem'))) {
      cp.execSync('bash server/genca.sh')
    }
    cb()
  })
})
