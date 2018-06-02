'use strict'

const ACME = require('./acme')
const { URLS } = ACME
const Storage = require('./storage')
const prom = require('promisify-es6')
const idPrefix = prom(require('./idPrefix'))

const debug = require('debug')
const log = debug('nodetrust:letsencrypt')

class Letsencrypt {
  constructor (opt) {
    let serverUrl = URLS[(opt.env || 'staging')] || opt.env
    let storage = this.storage = new Storage(opt.storageDir)
    let acmeConf = {
      email: opt.email,
      serverUrl,
      storage,
      challenge: {
        type: 'dns-01',
        set: (auth) => opt.dns.addRecords('_acme-challenge.' + auth.identifier.value, [['TXT', auth.dnsAuthorization]]),
        remove: (auth) => opt.dns.deleteRecords('_acme-challenge.' + auth.identifier.value)
      }
    }
    this.acme = new ACME(acmeConf)
    this.opt = opt
  }

  start (cb) {
    log('start')
    this.gcIntv = setInterval(() => this.gc(), this.opt.gcIntv || 60 * 60 * 1000)
    this.acme.init()
      .then(() => {
        this.gc()
        cb()
      }, cb)
  }

  stop (cb) {
    log('stop')
    clearInterval(this.gcIntv)
    cb()
  }

  handleRequest (id, zone, domains, cb) {
    idPrefix(id, zone)
      .then(prefix => {
        domains.unshift(prefix)
        return this.acme.getCertificate(id, domains)
      }, cb)
      .then(cert => cb(null, cert), cb)
  }

  gc () { // TODO: make this async
    let log = debug('nodetrust:letsencrypt:gc')
    log('running gc')

    const store = this.storage
    let now = Date.now()

    let certStores = store.ls('.')
      .filter(file => file.startsWith('@'))
      .filter(certStore => {
        let files = store.ls(certStore)
          .filter(cert => {
            if (now > store.readJSON(certStore, cert).validity) {
              log('remove old cert %s from %s', cert, certStore)
              store.rm(certStore, cert)
            } else {
              return true
            }
          })
        if (files.length) {
          return true
        }
        log('remove empty store %s', certStore)
        store.rmdir(certStore)
      })
    store.ls('key')
      .filter(file => file.startsWith('@'))
      .filter(key => certStores.indexOf(key) === -1)
      .forEach(key => {
        log('remove unused key %s', key)
        store.rm('key', key)
      })

    log('gc took %sms', Date.now() - now)
  }
}

module.exports = Letsencrypt
