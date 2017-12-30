'use strict'

const request = require('request')
const debug = require('debug')
const log = debug('nodetrust:dns:dpdns')
let recTypes = ['A', 'AAAA']

module.exports = class PDNS {
  constructor (swarm, config) {
    this.swarm = swarm
    this.config = config
    this.last_name_get = 0
  }

  _doRequest (url, method, cb) {
    url = this.config.api + url
    let post = false
    if (!method) method = 'GET'
    if (typeof method === 'function') {
      cb = method
      method = 'GET'
    }
    if (typeof method === 'object') {
      post = method
      method = 'PATCH'
    }

    log('doRequest %s %s %s', method, url, JSON.stringify(post))

    const cbb = (err, res, body) => {
      if (err) return cb(err)
      let resp
      try {
        if (body.match(/^[a-z0-9 ]+$/mi)) throw new Error('PowerDNS: ' + body)
        resp = body ? JSON.parse(body) : {success: true}
        if (resp.error) throw new Error(resp.error)
        if (res.statusCode - (res.statusCode % 100) !== 200) throw new Error('Status not ok: ' + res.statusCode)
      } catch (err) {
        return cb(err)
      }
      cb(null, resp)
    }

    if (post) {
      request({
        url,
        method,
        headers: {
          'X-API-Key': this.config.key
        },
        form: JSON.stringify(post)
      }, cbb)
    } else {
      request({
        url,
        method,
        headers: {
          'X-API-Key': this.config.key
        }
      }, cbb)
    }
  }

  _postUpdate (cb) {
    return (err, res) => {
      if (err) return cb(err)
      if (typeof res === 'object' && res.success === undefined) return this._getNames(cb, res)
      return cb(err, res)
    }
  }

  removeNames (names, cb) {
    log('removing names', names)
    delete this.last_name_get
    let req = {rrsets: []}
    names.forEach(name => {
      name += '.'
      recTypes.forEach(type => {
        req.rrsets.push({
          name,
          type,
          ttl: 60,
          changetype: 'REPLACE',
          records: []
        })
      })
    })
    this._doRequest('', req, this._postUpdate(cb))
  }

  addNames (names, cb) {
    log('adding names', names)
    let name2rec = {}
    names.forEach(n => {
      let id = n.name + '.' + '|' + n.type
      if (!name2rec[id]) name2rec[id] = []
      name2rec[id].push(n.value)
    })
    let req = {
      rrsets: Object.keys(name2rec).map(id => {
        const [name, type] = id.split('|')
        return {
          name,
          type,
          ttl: 60,
          changetype: 'REPLACE',
          records: name2rec[id].map(content => { return {content, disabled: false} })
        }
      })
    }
    this._doRequest('', req, this._postUpdate(cb))
  }

  clearDomain (domain, cb) {
    this.removeNames([domain], cb)
  }

  _getNames (cb, data) {
    log('getting names');
    (data ? (_, cb) => cb(null, data) : this._doRequest.bind(this))('', (err, names) => {
      if (err) return cb(err)
      this.names = []
      names.rrsets.forEach(rrset => {
        rrset.records.forEach(record => {
          this.names.push({
            name: rrset.name.replace(/\.$/, ''),
            type: rrset.type,
            ttl: rrset.ttl,
            value: record.content,
            disable: record.disabled
          })
        })
      })
      this.last_name_get = new Date().getTime()
      return cb(null, this.names)
    })
  }

  getNames (cb) {
    if (this.last_name_get) {
      log('using cache')
      cb(null, this.names)
    } else {
      this._getNames(cb)
    }
  }
}
