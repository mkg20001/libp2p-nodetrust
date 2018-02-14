'use strict'

/* eslint-env mocha */

describe('libp2p nodetrust', () => {
  // load all ids in before hook
  require('./load-ids')

  require('./certificate')
  require('./server')
})
