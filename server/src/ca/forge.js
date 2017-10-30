'use strict'

const fs = require('fs')
const read = (file, desc) => {
  if (!fs.existsSync(file))
    throw new Error("Unable to find " + desc + " file " + JSON.stringify(file))
  return fs.readFileSync(file).toString()
}
const forge = require('node-forge')
const pki = forge.pki
const debug = require('debug')
const log = debug('nodetrust:ca:forge')

module.exports = class ForgeCA {
  constructor(swarm, config) {
    this.swarm = swarm
    this.config = config
    this.cert = read(config.ca, 'Certificate Authority Certification')
    this.key = read(config.key, 'Certificate Authority Private Key')
    this.caKey = pki.privateKeyFromPem(this.key)
    this.caCert = pki.certificateFromPem(this.cert)
  }

  doCertRequest(pem, id, cn, sig, cb) {
    log('reading csr')
    const csr = pki.certificationRequestFromPem(pem.toString())
    if (!csr.verify()) return cb(new Error("Certification request invalid"))
    // const ext = csr.getAttribute({name: 'extensionRequest'})
    const cn_req = csr.subject.getField({
      name: 'commonName'
    }).value
    if (cn != cn_req) return cb(new Error("Rejecting request: commonName (" + cn + ") and requested commonName (" + cn_req + ") do not match!"))
    const cert = pki.createCertificate()

    cert.serialNumber = "0" + new Date().getTime().toString()

    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date()
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)

    cert.setSubject(csr.subject.attributes)

    cert.setIssuer(this.caCert.subject.attributes)

    cert.publicKey = csr.publicKey

    cert.sign(this.caKey)

    log('signing csr for %s', cn)

    const pemout = Buffer.from(pki.certificateToPem(cert))

    return cb(null, pemout, Buffer.concat([pemout, Buffer.from(this.cert)]))
  }
}
