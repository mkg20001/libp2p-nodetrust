'use strict'

/* eslint-env mocha */

const Utils = require('../utils')
const {parallel} = require('async')

describe('client', () => {
  let server
  let clientSwarm
  let client

  before((done) => {
    parallel([
      cb => {
        server = Utils.createServer(Utils.serverConfig({}), cb)
      },
      cb => {
        let cl = Utils.createClient({}, cb)
        clientSwarm = cl[0]
        client = cl[1]
      }
    ], done)
  })

  const getCl = () => { return {server, client, clientSwarm} }

  require('./certificate')(getCl)
  require('./wss-server')(getCl)

  after((done) => parallel([server, client, clientSwarm].map(o => cb => o.stop(cb)), done))
})
