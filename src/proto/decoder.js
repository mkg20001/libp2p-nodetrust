'use strict'

const {CertificateResponse, CertificateEncodingType, KeyEncodingType, KeyType} = require('./proto')

const forge = require('node-forge')
const {pki} = forge

function unknownEncoding (name, type) {
  throw new Error('Encoding: ' + name + ' Encoding ' + type + ' is unknown')
}

function m (orig, add) { // copy orig and merge with add
  return Object.assign(Object.assign({}, orig), add)
}

function certificate (obj) {
  switch (obj.encoding) {
    case CertificateEncodingType.PEM:
      return m(obj, pki.certificateFromPem(obj.certificate.toString()))
    default:
      unknownEncoding('Certificate', obj.encoding)
  }
}

function privateKey (obj) {
  switch (obj.encoding) {
    case KeyEncodingType.PEM_RSA:
      if (obj.type !== KeyType.RSA) throw new Error('Key encoded as PEM_RSA but is not RSA!')
      return m(obj, {})
    default:
      unknownEncoding('Private Key', obj.encoding)
  }
}

function certificateWithKey (obj) {
  return {
    certificate: certificate(obj.certificate),
    key: privateKey(obj.key)
  }
}

let ETABLE = {
  0: false,
  1: 'Ratelimit exceeded',
  9: 'Internal Server Error'
}

function errDecode (e) {
  return new Error('NodeTrust: ' + ETABLE[e])
}

function decode (obj, cb) {
  try {
    obj = CertificateResponse.decode(obj)
  } catch (e) {
    return cb(e)
  }
  if (obj.error) return cb(errDecode(obj.error))

  let res
  try {
    res = {cert: certificateWithKey(obj.cert), ca: certificate(obj.ca)}
    res.expiresAt = res.cert.certificate.validity.notAfter.getTime()
    res.altnames = res.cert.certificate.getExtension('subjectAltName').altNames.filter(a => (a.type === 2 && a.value !== res.cert.certificate.subject.getField('CN').value) || process.env.NODETRUST_IGNORE_ID_FILTER).map(a => a.value)
  } catch (e) {
    return cb(e)
  }
  return cb(null, res)
}

module.exports = decode
