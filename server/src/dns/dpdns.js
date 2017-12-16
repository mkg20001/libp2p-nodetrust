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

  _doRequest(url, method, cb) {
    url = this.config.api + url + '?format=json&apiKey='
    let post = false
    if (!method) method = 'GET'
    if (typeof method === 'function') {
      cb = method
      method = 'GET'
    }
    if (typeof method === 'object') {
      post = method
      method = 'POST'
    }

    log('doRequest %s %s %s', method, url + '[secret]', JSON.stringify(post))

    url += this.config.key

    const cbb = (err, res, body) => {
      if (err) return cb(err)
      let resp
      try {
        resp = body ? JSON.parse(body) : {success: true}
        if (resp.error) throw new Error(resp.error)
        if (res.statusCode - (res.statusCode % 100) !== 200) throw new Error('Status not ok: ' + res.statusCode)
      } catch(err) {
        return cb(err)
      }
      cb(null, resp)
    }

    if (post) {
      request({
        url,
        method,
        form: post
      }, cbb)
    } else {
      request({
        url,
        method
      }, cbb)
    }
  }

  removeNames (names, cb) {
    log('removing names', names)
    this.getNames(err => {
      if (err) return cb(err)
      delete this.last_name_get
      const rem = this.names.filter(n2 => names.filter(n => n.name === n2.name && n.type === n2.type)[0])
      forEach(rem, (name, cb) => this._doRequest('record/' + name.id, 'DELETE', cb), cb)
    })
  }

  addNames (names, cb) {
    this.removeNames(names, err => { // clears them up beforehand so we don't get duplicates
      if (err) return cb(err)
      log('adding names', names)
      forEach(names.map(n => {
        let nn = n.name.split('.')
        nn.pop()
        nn.pop()
        return {
          id: 0,
          name: nn.join('.'),
          type: n.type,
          content: n.value,
          prio: 0,
          ttl: 60
        }
      }), (name, cb) => this._doRequest('get-records', name, cb), cb)
    })
  }

  clearDomain(domain, cb) {
    this.removeNames(this.names.filter(n => n.name === domain), cb)
  }

  _getNames (cb) {
    log('getting names')
    this._doRequest('get-records', (err, names) => {
      if (err) return cb(err)
      const fqdn = names.filter(n => n.type === 'SOA')[0].name
      this.names = names.map(n => {
        n.value = n.content
        if (n.name !== fqdn) n.name += '.' + fqdn
        return n
      })
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
