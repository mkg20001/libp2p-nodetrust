#!/usr/bin/env node

'use strict'

/* eslint-disable no-console */

const Server = require('./')
const config = require(process.argv[2])
const Id = require('peer-id')
Id.createFromJSON(config.id, (err, id) => {
  if (err) throw err
  config.id = id
  const s = new Server(config)
  s.start(err => {
    if (err) throw err
    s.swarm.peerInfo.multiaddrs.toArray().map(a => a.toString()).forEach(a => console.log('Listening on', a))
    console.log('Ready to accept requests!')
  })
})
