'use strict'

const request = require('request')
const debug = require('debug')
const log = debug('nodetrust:dns:dpdns')
const {forEach} = require('async')

module.exports = class DPDNS {
  constructor (swarm, config) {
    this.swarm = swarm
    this.config = config
    this.last_name_get = 0
  }

  _doRequest(url, post, cb, method) {
    url = this.config.api + url + '?format=json&apiKey='
    if (typeof post == 'function') {
      cb = post
      post = false
    }

    log('doRequest (post=%s, url=%s)', Boolean(post), url + '[secret]')

    url += this.config.key

    if (post) {

    } else {
      request({
        url,
        method: method || 'GET'
      }, (err, res, body) => {
        if (err) return cb(err)
        let resp
        try {
          resp = JSON.parse(body)
          if (resp.error) throw new Error(resp.error)
          if (res.statusCode !== 200) throw new Error('Status not ok: ' + res.statusCode)
        } catch(err) {
          return cb(err)
        }
        cb(null, resp)
      })
    }
  }

  removeNames (names, cb) {
    log('removing names', names)
    this.getNames(err => {
      if (err) return cb(err)
      delete this.last_name_get
      const rem = this.names.filter(n2 => names.filter(n => n.name === n2.name && n.type == n2.type))
      forEach(rem, (name, cb) => this._doRequest('record/' + name.id, false, cb, 'DELETE'), cb)
    })
  }

  addNames (names, cb) {
    this.removeNames(names, err => { // clears them up beforehand so we don't get duplicates
      if (err) return cb(err)
      log('adding names', names)
      forEach(names, (name, cb) => this._doRequest('get-records', name, cb), cb)
    })
  }

  clearDomain(domain, cb) {
    this.removeNames(this.names.filter(n => n.name === domain), cb)
  }

  _getNames (cb) {
    log('getting names')
    this._doRequest('get-records', (err, names) => {
      if (err) return cb(err)
      this.names = names
      this.last_name_get = new Date().getTime()
      return cb(null, this.names)
    })
  }

  getNames(cb) {
    if (this.last_name_get) {
      log('using cache')
      cb(null, this.names)
    } else {
      this._getNames(cb)
    }
  }

}
