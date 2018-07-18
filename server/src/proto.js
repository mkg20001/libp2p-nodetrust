'use strict'

const protons = require('protons')

module.exports = protons(`

// errors

enum Error {
  OK               = 0;
  E_RATE_LIMIT     = 1; // rate limit error (letsencrypt or server)
  E_INVALID_PROOF  = 2; // proof signature error or proof expired
  E_NOT_AUTHORIZED = 3; // used in dns-01
  E_OTHER          = 9; // internal server error
}

// types

enum AddressType {
  IPv4 = 1;
  IPv6 = 2;
}

message Address {
  required AddressType type = 1;
  required string address = 2; // TODO: maybe binary encode?
}

message Proof {
  required bytes id = 1; // id for which this proof has been generated
  required int64 timestamp = 2; // time at which this proof has been generated (validity: +/- 1min)
  repeated Address addrs = 3; // addresses that get proven
}

message ProofWrapper {
  required Proof proof = 1;
  required bytes signature = 2;
}

// /p2p/nodetrust/proof/1.0.0

message ProofResponse {
  required Error error = 1;
  optional ProofWrapper proof = 2;
}

// /p2p/nodetrust/issue/1.0.0

message IssueRequest {
  repeated ProofWrapper proofs = 1;
}

message IssueResponse {
  required Error error = 1;
  bytes cert = 2; // cert + ca = fullchain
  bytes ca = 3;
  bytes key = 4; // private key
  string cn = 5; // this makes the client's life easier because the client does not have to somehow extract the cn & altnames itself
  repeated string altnames = 6;
  // NOTE: it is assumed that cn is id0 and altnames are all ipN addrs
}

// /p2p/nodetrust/dns-01/1.0.0

message DNS01Request {
  required string fqdn = 1; // _acme_challenge. gets appended server side
  required string value = 2;
}

message DNS01Response {
  required Error error = 1;
}

`)
