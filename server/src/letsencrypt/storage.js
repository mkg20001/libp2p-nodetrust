'use strict'

const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')

class Storage {
  constructor (path) {
    this.path = path
  }
  locate (...a) {
    if (!a.length) throw new Error('Must specify location')
    return path.join(this.path, ...a)
  }
  store (...a) {
    let data = a.pop()
    let loc = this.locate(...a)
    const dir = path.dirname(loc)
    mkdirp.sync(dir)
    fs.writeFileSync(loc, data)
  }
  exists (...a) {
    return fs.existsSync(this.locate(...a))
  }
  read (...a) {
    if (!this.exists(...a)) return
    return fs.readFileSync(this.locate(...a))
  }
  readJSON (...a) {
    if (!this.exists(...a)) return
    return JSON.parse(String(fs.readFileSync(this.locate(...a))))
  }
  storeJSON (...a) {
    let data = JSON.stringify(a.pop())
    return this.store(...a, data)
  }
}

module.exports = Storage
