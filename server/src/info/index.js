'use strict'

const protos = require('../protos')

/* const debug = require('debug')
const log = debug('nodetrust:info') */

module.exports = (swarm, config) => {
  swarm.handle('/nodetrust/info/1.0.0', (protocol, conn) => {
    protos.server(conn, protos.info, (data, respond) => {
      respond({
        zone: config.zone,
        type: swarm.catype
      })
    })
  })
}
