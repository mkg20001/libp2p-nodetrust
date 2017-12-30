'use strict'

/* eslint-env mocha */

describe('libp2p nodetrust', () => {
  // tasks
  require('./load-ids')

  // type tests
  require('./csr-ca')
  require('./drop-wildcard')

  // TODO: dns tests
})
