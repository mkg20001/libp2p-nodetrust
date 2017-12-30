'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const {createServer, createClient} = require('./utils')
const {parallel} = require('async')
const path = require('path')

/* eslint-env mocha */

describe('csr-ca', () => {
  let server
  let client
  let swarm

  it('should start the server', cb => {
    server = createServer({
      'zone': 'node.libp2p',
      'ca': {
        'provider': 'forge',
        'key': path.join('server', 'cakey'),
        'ca': path.join('server', 'cacert')
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
      cb()
    })
  })

  after(cb => parallel([server.stop.bind(server), client.disable.bind(client), swarm.stop.bind(swarm)], cb))
})
