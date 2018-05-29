'use strict'

/* eslint-env mocha */

const Utils = require('../utils')

describe('server', () => {
  let server
  before((done) => {
    server = Utils.createServer(Utils.serverConfig({}), done)
  })

  // TODO: add tests

  after((done) => server.stop(done))
})
