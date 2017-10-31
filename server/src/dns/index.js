'use strict'

const protos = require('../protos')

const debug = require('debug')
const log = debug('nodetrust:dns')
const {
  waterfall
} = require('async')

const toDNS = {
  ip4: 'A',
  ip6: 'AAAA'
}

module.exports = (swarm, config) => {
  let dns
  try {
    const DNS = require('./' + config.provider)
    dns = new DNS(swarm, config)
  } catch (e) {
    e.stack = 'Failed to load DNS provider ' + config.provider + ': ' + e.stack
    throw e
  }

  let dnsprov = dns

  swarm.handle('/nodetrust/dns/1.0.0', (protocol, conn) => {
    protos.server(conn, protos.dns, (data, respond) => {
      const cb = err => {
        if (err) {
          log(err)
          respond({
            success: false
          })
        }
      }
      waterfall([
        cb => conn.getPeerInfo(cb),
        (cb, pi) => {
          const id = pi.id
          const time = new Date().getTime()
          if (data.time > time + 10000 || data.time < time - 10000) return cb(new Error('Timestamp too old/new'))
          id.pubKey.verify(data.time.toString(), data.signature, (err, ok) => {
            if (err || !ok) return cb(err || true)
            return cb(null, id)
          })
        },
        (cb, id) => {
          swarm.getCN(id, (err, dns) => {
            if (err) return cb(err)
            dns += '.'
            cb(null, dns)
          })
        },
        (cb, dns) => {
          conn.getObservedAddrs((err, addr) => {
            if (err) return cb(err)
            const ips = addr.map(addr => addr.toString()).filter(addr => addr.startsWith('/ip')).map(addr => {
              const s = addr.split('/')
              return {
                dns,
                type: toDNS[s[1]],
                value: s[2]
              }
            })
            cb(null, dns, ips)
          })
        },
        (cb, dns, ips) => {
          dnsprov.clearAllForDomain(dns, err => {
            if (err) return cb(err)
            dnsprov.addNames(ips, err => {
              if (err) return cb(err)
              return respond({
                success: true
              })
            })
          })
        }
      ], cb)
    })
  })
}
