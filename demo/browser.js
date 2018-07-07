'use strict'

/* eslint-env browser */
/* eslint-disable no-console */

localStorage.debug = 'libp2p*'

global.process = process

const Raven = require('raven')

if (window.location.host === 'libp2p-nodetrust.tk' || window.location.host.endsWith('github.io')) {
  console.log('Raven error reporting enabled!')
  Raven.config('https://6378f3d56e7a41faae3058d3b9dfefef@sentry.zion.host/10').install()
}

let running = false

window.debug = require('debug')
const pull = require('pull-stream')

window.onerror = function (messageOrEvent, source, lineno, colno, error) {
  console.error('%c' + (messageOrEvent === 'Script Error.' ? messageOrEvent : error.stack), 'color: red')
}

const $ = window.$ = require('jquery')
const moment = require('moment')

const Libp2p = require('libp2p')
const WS = require('libp2p-websockets')
const Peer = require('peer-info')
const Id = require('peer-id')
const NodeTrust = require('../src/browser')

const SPDY = require('libp2p-spdy')
const MPLEX = require('libp2p-mplex')
const SECIO = require('libp2p-secio')

const COLSTART = 'ȵ'
const COLEND = 'ȶ'
const COLRESET = 'ȷ'
const MAX_KEEP = 500
let cHist = []

let ntPeer

if (window.location.host === 'localhost:3000') { // ifdev
  console.log('Using dev!')
  ntPeer = new Peer(Id.createFromB58String('QmNnMDsFRCaKHd8Tybhui1eVuN7xKMMqRZobAEtgKBJU5t'))
  ntPeer.multiaddrs.add('/ip4/127.0.0.1/tcp/8877/ws/ipfs/QmNnMDsFRCaKHd8Tybhui1eVuN7xKMMqRZobAEtgKBJU5t')
}

function consoleParse (t) {
  let rr = t.slice(1)
  const n = t[0].replace(/%[a-z]/g, function (str) {
    const r = rr.shift()
    if (r == null) {
      return r
    }
    if (str.toLowerCase() === '%c') {
      return COLSTART + r + COLEND
    }
    return r
  })
  return [n].concat(rr)
}

function cssProcess (rules) {
  return rules.split(';').map(r => r.split(':').map(r => r.trim())).filter(v => v.length === 2)
}

$(document).ready(() => (function () {
  function addToLog () {
    const d = moment(new Date()).format('HH:mm:ss.SSS[Z]')
    let t = [...arguments]
    if (typeof t[0] === 'string') {
      t.unshift('[' + d + '] ' + t.shift())
      t = consoleParse(t)
    } else {
      t.unshift('[' + d + ']')
    }
    let css = ''
    let iscol = false
    let lc = ''
    let cc = ''
    t = t.join(COLRESET + ' ').split('\n')
    t.forEach(t => {
      const d = $('<p></p>')
      let p = false
      t.split('').forEach(c => {
        lc = cc
        cc = c
        if (c === COLSTART) {
          return (iscol = true)
        } else if (c === COLEND) {
          return (iscol = false)
        } else if (c === COLRESET && lc !== COLEND) {
          return (css = '')
        }
        if (iscol) return (css += c)
        const e = $('<span></span>')
        if (c !== ' ') p = true
        if (!p) e.css('margin-left', '9px')
        cssProcess(css).forEach(r => e.css(r[0], r[1])) // eslint-disable-line
        if (c === ' ') p = false
        e.text(c)
        d.append(e)
      })
      cHist.push(d)
      $('#logfield').append(d)
      while (cHist.length >= MAX_KEEP) [cHist.shift()].forEach(r => $(r).remove())
    })
  }

  ['log', 'error', 'warn', 'info'].forEach(d => {
    const o = console[d].bind(console)
    console[d] = function console () {
      addToLog.apply(window, arguments)
      o.apply(console, arguments)
    }
  })

  console.log('%c[swarm]%c Preparing to launch...', 'font-weight: bold', 'color: inherit')
  $('#swarm-state').text('Preparing...')

  Id.create((err, id) => {
    if (err) {
      Raven.captureException(err)
      throw err
    }
    console.log('%c[swarm]%c Ready to launch', 'font-weight: bold', 'color: inherit')

    const nodetrust = window.nodetrust = new NodeTrust({ node: ntPeer })
    const {discovery} = nodetrust

    function connectToServer () {
      if (!swarm._switch.muxedConns[nodetrust.node.id.toB58String()]) {
        $('#connection-state').text('Connection to Server: Establishing...')
        console.log('%c[swarm]%c Connecting to server...', 'font-weight: bold', 'color: inherit')
        nodetrust.start(err => {
          if (err) {
            $('#connection-state').text('Connection to Server: Failed!')
            console.log('%c[swarm]%c Connection to server failed: %s', 'font-weight: bold', 'color: inherit', err)
            Raven.captureException(err)
            throw err
          } else {
            $('#connection-state').text('Connection to Server: Established!')
            console.log('%c[swarm]%c Connection to server succeeded', 'font-weight: bold', 'color: inherit')
          }
        })
      }
    }

    const peer = new Peer(id)

    const swarm = new Libp2p({
      peerInfo: peer, // The Identity of your Peer
      modules: {
        transport: [WS],
        streamMuxer: [SPDY, MPLEX],
        connEncryption: [SECIO],
        peerDiscovery: [discovery]
      },
      config: { // The config object is the part of the config that can go into a file, config.json.
        peerDiscovery: {
          nodetrust: {
            enabled: true
          }
        },
        relay: { // Circuit Relay options
          enabled: true,
          hop: { enabled: true, active: false }
        },
        // Enable/Disable Experimental features
        EXPERIMENTAL: { pubsub: true, dht: false }
      }
    })

    nodetrust.__setSwarm(swarm)

    window.swarm = swarm
    $('#swarm-state').text('Node: Offline (Click to launch)')
    $('#swarm-state').click(() => {
      if (running) return
      running = true
      $('#swarm-state').text('Node: Starting...')
      swarm.start(err => {
        if (err) {
          $('#swarm-state').text('Node: Error')
          Raven.captureException(err)
          throw err
        }
        $('#swarm-state').text('Node: Online')
        $('#connection-state').click(connectToServer)
        discovery.start()
        connectToServer()
        setInterval(() => connectToServer(), 10 * 1000) // eslint-disable-line
        $('#connection-state').fadeIn('fast')
        console.log('%c[swarm]%c Online', 'font-weight: bold', 'color: inherit')
      })
    })

    swarm.on('peer:disconnect', pi => {
      if (pi.id.toB58String() === nodetrust.node.id.toB58String()) {
        console.log('%c[swarm]%c Connection to server lost', 'font-weight: bold', 'color: inherit')
        connectToServer()
      }
    })

    const pi2html = (pi, i) => $('<div id="' + i + pi.id.toB58String() + '" class="peer ipfs-style">Id: <tt>' + pi.id.toB58String() + '</tt><br>Multiaddr(s): ' + pi.multiaddrs.toArray().map(a => a.toString()).map(a => '<tt>' + a + '</tt>').join(' ') + '</div>')

    // Discovery

    discovery.on('peer', pi => {
      const id = pi.id.toB58String()
      if (swarm._switch.muxedConns[id]) return
      $('#p' + pi.id.toB58String()).remove()
      $('#peers').append(pi2html(pi, 'p'))
      swarm.dialProtocol(pi, '/messages/1.0.0', (err, conn) => {
        if (err) return console.error(err)
        pull(
          pull.values([]),
          conn,
          pull.map(m => m.indexOf('>') !== -1 || m.indexOf('<') !== -1 ? console.warn('Got an XSS\'d message') : $('#messages').append($('<p>' + m + '</p>'))),
          pull.drain()
        )
      })
    })
    swarm.on('peer:connect', pi => {
      $('#c' + pi.id.toB58String()).remove()
      $('#conns').append(pi2html(pi, 'c'))
    })
  })
}()))
