'use strict'

let running = false

require('debug').save('libp2p*')
process.env.INTENSE_DEBUG = '1'
process.env.DEBUG_PACKETS = '1'
window.debug = require('debug')
const pull = require('pull-stream')

window.onerror = function (messageOrEvent, source, lineno, colno, error) {
  console.error('%c' + (messageOrEvent == 'Script Error.' ? messageOrEvent : error.stack), 'color: red')
}

const $ = window.$ = require('jquery')
const moment = require('moment')

const Libp2p = require('libp2p')
const WS = require('libp2p-websockets')
const Peer = require('peer-info')
const Id = require('peer-id')
const multiaddr = require('multiaddr')
const NodeTrust = require('../src')
const disable = bt => bt.css('transition', '.5s').attr('disabled', true)

const SPDY = require('libp2p-spdy')
const MULTIPLEX = require('libp2p-multiplex')
const SECIO = require('libp2p-secio')
const {map} = require('async')

const COLSTART = 'ȵ'
const COLEND = 'ȶ'
const COLRESET = 'ȷ'
const MAX_KEEP = 500
let c_hist = []

let ntPeer

if (window.location.host === 'localhost:3000') { // ifdev
  map(require('../test/ids.json'), Id.createFromJSON, (e, ids) => {
    console.info('Using dev!')
    if (e) throw e
    ntPeer = new Peer(ids[0])
    ntPeer.multiaddrs.add('/ip4/127.0.0.1/tcp/8877/ws/ipfs/' + ids[0].toB58String())
  })
}

function consoleParse (t) {
  let rr = t.slice(1)
  const n = t[0].replace(/%[a-z]/g, function (str) {
    const r = rr.shift()
    if (typeof r == null) {
      return r
    }
    if (str.toLowerCase() == '%c') {
      return COLSTART + r + COLEND
    }
    return r
  })
  return [n].concat(rr)
}

function cssProcess (rules) {
  return rules.split(';').map(r => r.split(':').map(r => r.trim())).filter(v => v.length == 2)
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
        if (c == COLSTART) {
          return (iscol = true)
        } else if (c == COLEND) {
          return (iscol = false)
        } else if (c == COLRESET && lc != COLEND) {
          return (css = '')
        }
        if (iscol) return css += c
        const e = $('<span></span>')
        if (c != ' ') p = true
        if (!p) e.css('margin-left', '9px')
        cssProcess(css).forEach(r => e.css(r[0], r[1]))
        if (c == ' ') p = false
        e.text(c)
        d.append(e)
      })
      c_hist.push(d)
      $('#logfield').append(d)
      while (c_hist.length >= MAX_KEEP) [c_hist.shift()].forEach(r => $(r).remove())
    })
  }

  ['log', 'error', 'warn', 'info'].forEach(d => {
    const o = console[d].bind(console)
    console[d] = function console () {
      addToLog.apply(window, arguments)
      o.apply(console, arguments)
    }
  })

  console.info('%c[swarm]%c Preparing to launch...', 'font-weight: bold', 'color: inherit')
  $('#swarm-state').text('Preparing...')

  Id.create((err, id) => {
    if (err) throw err
    console.info('%c[swarm]%c Ready to launch', 'font-weight: bold', 'color: inherit')

    const discovery = NodeTrust.discovery

    const peer = new Peer(id)

    const swarm = new Libp2p({
      transport: [
        new WS()
      ],
      connection: {
        muxer: [
          MULTIPLEX,
          SPDY
        ],
        crypto: [SECIO],
        discovery: [discovery]
      }
    }, peer)

    window.swarm = swarm
    $('#swarm-state').text('Node: Offline (Click to launch)')
    $('#swarm-state').click(() => {
      if (running) return
      running = true
      $('#swarm-state').text('Node: Starting...')
      swarm.start(err => {
        if (err) {
          $('#swarm-state').text('Node: Error')
          throw err
        } else {
          $('#swarm-state').text('Node: Online')
          $('#discovery').one('click', () => {
            disable($('#discovery'))
            discovery.enableStandalone({
              node: ntPeer,
              swarm
            })
          })
          $('#controls').fadeIn('fast')
          console.info('%c[swarm]%c Online', 'font-weight: bold', 'color: inherit')
        }
      })
    })

    const pi2html = (pi, i) => $('<div id="' + i + pi.id.toB58String() + '" class="peer ipfs-style">Id: <tt>' + pi.id.toB58String() + '</tt><br>Multiaddr(s): ' + pi.multiaddrs.toArray().map(a => a.toString()).map(a => '<tt>' + a + '</tt>').join(' ') + '</div>')

    // Discovery

    let nodes = {}
    discovery.on('peer', pi => {
      const id = pi.id.toB58String()
      if (nodes[id]) return
      nodes[id] = true
      $('#peers').append(pi2html(pi, 'p'))
      swarm.dial(pi, '/messages/1.0.0', (err, conn) => {
        if (err) return console.error(err)
        pull(
          pull.values([]),
          conn,
          pull.map(m => m.indexOf('>') != -1 || m.indexOf('<') != -1 ? console.warn('Got an XSS\'d message') : $('#messages').append($('<p>' + m + '</p>'))),
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
