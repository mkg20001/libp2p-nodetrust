#!/usr/bin/env node

'use strict'

/* eslint-disable no-console */

const fs = require('fs')
const Id = require('peer-id')
const Server = require('./')

const die = (...msg) => {
  console.error('ERROR: ' + msg.shift(), ...msg)
  process.exit(2)
}

const createCommand = (serviceName) => {
  const Service = require('./' + serviceName)

  return {
    command: serviceName + ' <config>',
    desc: 'Run the nodetrust ' + serviceName + ' service',
    builder: y => y,
    handler: (argv) => {
      if (argv.create) {
        if (fs.existsSync(argv.config)) {
          return die('Config %s already exists!', argv.config)
        }

        console.log('Creating config...')
        Id.create({bits: 4096}, (err, id) => {
          if (err) { return die('Couldn\'t create id', err) }
          const config = Service.template
          config.swarm.id = id.toJSON()
          fs.writeFileSync(argv.config, Buffer.from(JSON.stringify(config, null, 2)))
          console.log('Written config to %s!', argv.config)
        })

        return
      }

      const config = JSON.parse(String(fs.readFileSync(argv.config)))

      const Raven = require('raven')
      Raven.config().install()

      Id.createFromJSON(config.swarm.id, (err, id) => {
        if (err) { return die('Config ID parse error', err) }
        config.swarm.id = id

        const server = new Server(Service, serviceName, config)
        server.start().then(() => {
          server.swarm.peerInfo.multiaddrs.toArray().map(a => a.toString()).forEach(addr => {
            server.swarm.log.info({type: 'listen', addr}, 'Listening on %s', addr)
          })
        }, (err) => die('Starting server failed: %s', err.stack))
      })
    }
  }
}

require('yargs') // eslint-disable-line no-unused-expressions
  .option('config', {
    desc: 'Config file',
    type: 'string',
    required: true
  })
  .option('create', {
    desc: 'Create config file',
    type: 'boolean',
    default: false
  })
  .command(createCommand('dns'))
//  .command(createCommand('issue'))
  .command(createCommand('proof'))
  .demandCommand()
  .help()
  .argv
