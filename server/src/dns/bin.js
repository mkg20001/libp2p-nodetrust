'use strict'

// This is a tiny script to test nodetrust's dns server as standalone
// Use $ dig -p 4500 @localhost DOMAIN to query it

const d = require('./')

const i = new d({
  port: 4500,
  ttl: 2
})
i.start(console.log)
i.addRecords('nodetrust.debug', [['TXT', 'true']])
