'use strict'

module.exports = {
  create: () => {
    return {
      loopback: function (opts, domain, token, cb) { return cb() },
      getOptions: () => { return {} },
      set: function (opts, domain, token, keyAuthorization, cb) { return cb() },
      remove: function (opts, domain, token, cb) { return cb() },
      test: function (opts, domain, token, keyAuthorization, cb) { return cb() } 
    }
  }
}
