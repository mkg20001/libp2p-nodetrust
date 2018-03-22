'use strict'

const protons = require('protons')

module.exports = protons(`

enum ErrorType {
  NONE          = 0;
  RATELIMIT     = 1; // can be either letsencrypt rate limit or internal rate limit
  OTHER         = 9;
}

enum CertificateEncodingType {
  PEM = 1;
}

enum KeyEncodingType {
  PEM_RSA = 1;
}

enum KeyType {
  RSA = 1;
}

message Certificate {
  required bytes certificate = 1;
  required CertificateEncodingType encoding = 2;
  required KeyType keyType = 3;
}

message PrivateKey {
  required bytes key = 1;
  required KeyEncodingType encoding = 2;
  required KeyType type = 3;
}

message CertificateWithKey {
  required Certificate certificate = 1;
  required PrivateKey key = 2;
}

message CertificateResponse {
  required ErrorType error = 1;
  optional CertificateWithKey cert = 2;
  optional Certificate ca = 3;
}

`)
