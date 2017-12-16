'use strict'

const EE = require('events').EventEmitter

class DB extends EE {
  constructor (opt) {
    super()
    this.data = {}
    this.maxAge = opt.maxAge
    this.last_used = {}
    setInterval(this._loop.bind(this), 100)
  }
  get (key) {
    if (!this.data[key]) return false
    this.last_used[key] = new Date().getTime()
    return this.data[key]
  }
  get keys() {
    return Object.keys(this.data)
  }
  peek (key) {
    return this.data[key] || false
  }
  set (key, value) {
    this.data[key] = value
    this.last_used[key] = new Date().getTime()
  }
  remove (key) {
    delete this.last_used[key]
    return delete this.data[key]
  }
  _loop () {
    const curTime = new Date().getTime()
    const evictTime = curTime - this.maxAge
    for (const key in this.data) {
      if (this.last_used[key] <= evictTime) {
        this.emit('evict', {key, value: this.data[key]})
        this.remove(key)
      }
    }
  }
}

module.exports = DB
