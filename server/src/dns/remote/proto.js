'use strict'

const protons = require('protons')

module.exports = protons(`

enum ErrorType {
  NONE          = 0;
  UNAUTHORIZED  = 1;
  OTHER         = 9;
}

message Update {
  required string name = 1;
  repeated Record value = 2; // if this field has 0 elements it removes the name completly from db
}

message Record {
  required string type = 1;
  required string value = 2;
}

message Response {
  required ErrorType error = 1;
}

`)
