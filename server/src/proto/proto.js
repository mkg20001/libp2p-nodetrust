'use strict'

const protons = require('protons')

module.exports = protons(`

message CertResponse {
  required bool error = 1;
  // param from https://www.npmjs.com/package/greenlock#useful-example
  string privKey = 2;
  string cert = 3;
  string chain = 4;
  int64 issuedAt = 5;
  int64 expiresAt = 6;
  repeated string altnames = 7;
}

`)
