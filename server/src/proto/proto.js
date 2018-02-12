'use strict'

const protons = require('protons')

module.exports = protons(`

message Info {
  required string zone = 1; // the domain we are responsible for (ex: node.libp2p.io)
  repeated bytes remoteAddr = 2; // Multiaddr[] - allows the client to easily find out it's own ip
}

message CertRequest {
  required string sub = 1;
  required bytes csr = 2;
}

message CertResponse {
  required bool error = 1;
  bytes cert = 2;
}

`)
