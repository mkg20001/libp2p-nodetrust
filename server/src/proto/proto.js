'use strict'

const protons = require('protons')

module.exports = protons(`

message Info {
  required string zone = 1; // the domain we are responsible for (ex: node.libp2p.io)
  repeated bytes remoteAddr = 2; // Multiaddr[] - allows the client to easily find out it's own ip
}

message CertRequest {
  required string sub = 1; // the subdomain for which to obtain the certificate (ex: v48-8-8-8)
}

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
