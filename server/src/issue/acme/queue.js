'use strict'

const {map} = require('async')
const once = require('once')

const debug = require('debug')
const log = debug('nodetrust:letsencrypt:acme:queue')

class Queue {
  constructor () {
    this.tasks = {}
    this.domains = {}
  }
  aquireDomainLock (domain, task, cb) {
    if (!this.domains[domain]) {
      log('lock domain %s for %s', domain, task)
      const T = this.domains[domain] = { queue: [], task } // lock
      cb(null, () => { // unlock function
        log('unlock domain %s', domain)
        delete this.domains[domain] // unlock
        T.queue.forEach(el => this.aquireDomainLock(domain, ...el)) // and requeue if any items are queued
      })
    } else {
      log('queue %s for domain %s', task, domain)
      this.domains[domain].queue.push([task, cb])
    }
  }
  aquireLock (task, domains, exec, cb) {
    if (!this.tasks[task]) {
      log('execute task %s', task)
      const T = this.tasks[task] = { queue: [cb] } // lock task
      map(domains, (domain, cb) => this.aquireDomainLock(domain, task, cb), (err, unlock) => {
        if (err) return cb(err)
        cb = once((err, res) => {
          log('finished task %s', task)
          T.queue.concat(unlock).forEach((cb) => setImmediate(() => cb(err, res))) // send result to queue
          delete this.tasks[task] // delete lock
        })
        setTimeout(() => cb(new Error('Timeout')), 20 * 1000) // max of 20s for execution
        exec(cb)
      })
    } else {
      log('queue task %s', task)
      this.tasks[task].queue.push(cb) // queue for result
    }
  }
}

module.exports = Queue
