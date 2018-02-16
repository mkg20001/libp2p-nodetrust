# libp2p-nodetrust

Why not give every libp2p node an `ID.node.libp2p.io` address and certificate?

# Why

Currently the browser communicates over ONE signalling server and a few bootstrapper nodes (which then get used as releays for all the other TCP nodes).

When a large number of browser nodes using the default configuration joins the network those nodes and the server get overloaded pretty quickly.
Additionally they can be all blocked by some malicious government (china, russia, ...) thus creating a single point of failure.

The only solution would be to make the browser connect to some other websocket-capable nodes.

Problem: HTTP on HTTPS is disabled due to security.

Solution: HTTPS enabled websocket nodes

# How

A libp2p node (the "server") will run a special dns server that resolves ips encoded in subdomains to real ips. Example: `ip48-8-8-8.ip.libp2p-nodetrust.tk => [A] 8.8.8.8`

This server will additionally offer letsencrypt certificates for the domain over the `/nodetrust/2.0.0` protocol which requires the client to connect over tcp in order to determine it's ip address.

<!-- Additionally /nodetrust/discovery/1.0.0/ can be used to discover other nodes using this service (so the browser can find the wss nodes faster) -->

# Development

## Client
<!-- Run `nodemon test-client.js -d 1` -->
> TODO...

## Server
cd into server

Run `nodemon src/bin.js ./config.dev.json`
