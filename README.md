# libp2p-nodetrust

Why not give every libp2p node an `IP.ip.libp2p.io` address and certificate?

# Why

Currently the browser communicates over ONE signalling server and a few bootstrapper nodes (which then get used as releays for all the other TCP nodes)

When a large number of browser nodes using the default configuration joins the network those nodes and the server get overloaded pretty quickly.
Additionally they can be all blocked by some malicious government (china, russia, ...) thus creating a single point of failure.

The only solution would be to make the browser connect to some other websocket-capable nodes.

Problem: HTTP on HTTPS is disabled due to security

Solution: HTTPS enabled websocket nodes

# How

A libp2p node (the "server") will run a special dns server that resolves ips encoded in subdomains to real ips. Example: `ip48-8-8-8.ip.libp2p-nodetrust.tk => [A] 8.8.8.8`

This server will additionally offer letsencrypt certificates for the domain over the `/nodetrust/2.0.0` protocol which requires the client to connect over tcp in order to determine it's ip address.

Nodes will then announce themselves over floodsub in the `_nodetrust_discovery_v2` channel. Those messages will get relayed by the server.

Additionally the clients will relay each others floodsub messages so there is no single point of failure after the certificate has been obtained.

# Development

## Client
Run `USE_LOCAL=1 nodemon test-client.js -d 1`

## Server

### Certificate

You need a certificate for `ip4127-0-0-1.ip.libp2p-nodetrust.tk` to use the server-stub. You can either generate a self-signed using `server/gencert.sh` or request a valid one from me at mkg20001 at gmail dot com.

### Usage
Run `nodemon src/bin.js ./config.dev.json` in the `server/` directory
