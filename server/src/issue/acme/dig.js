'use strict'

const cp = require('child_process')

module.exports = (query) => new Promise((resolve, reject) => { // the nodeJS dns module seems to be buggy sometimes. use real dig.
  try {
    let records = cp.spawnSync('dig', ['+short', query.name, query.type, '@8.8.8.8'], {stdio: 'pipe'})
      .stdout.toString().split('\n').filter(s => Boolean(s.trim())).map(v => JSON.parse(v))
    resolve({ answer: records.map(data => { return { data: [data] } }) })
  } catch (e) {
    reject(e)
  }
})
