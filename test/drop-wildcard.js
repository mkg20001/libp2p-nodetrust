'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const {createServer, createClient} = require('./utils')
const {parallel} = require('async')
const fs = require('fs')
const path = require('path')

/* eslint-env mocha */

describe('drop-wildcard', () => {
  let server
  let client
  let swarm

  it('should start the server', cb => {
    server = createServer({
      'zone': 'node.libp2p',
      'ca': {
        'provider': 'wilddrop',
        'key': path.join('server', 'wildkey.pem'),
        'cert': path.join('server', 'wildcert.pem')
      },
      'dns': {
        'provider': 'memory'
      },
      'discovery': {

      }
    }, cb)
  })

  it('should start the client', cb => {
    [swarm, client] = createClient({

    }, cb)
  })

  it('client should aquire cert', cb => {
    client.enable(err => {
      expect(err).to.not.exist()
      expect(client.chain).to.exist()
      expect(client.cert).to.exist()
      expect(client.key).to.exist()
      expect(client.cert.toString()).to.equal(fs.readFileSync(path.join('server', 'wildcert.pem')).toString())
      expect(client.key.toString()).to.equal(fs.readFileSync(path.join('server', 'wildkey.pem')).toString())
      cb()
    })
  })

  after(cb => parallel([server.stop.bind(server), client.disable.bind(client), swarm.stop.bind(swarm)], cb))
})
