'use strict'

// This is a tiny script to test nodetrust's dns server as standalone
// Use $ dig -p 4500 @localhost DOMAIN to query it

const DNS = require('./')

const dnsServer = new DNS({
  port: 4500,
  ttl: 2
})
dnsServer.start(console.log)
dnsServer.addRecords('nodetrust.debug', [['TXT', 'true']])
