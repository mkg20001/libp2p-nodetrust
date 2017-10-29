# libp2p-nodetrust

Why not give every libp2p node an `ID.node.libp2p.io` address and certificate?

# Why

Currently the browser communicates over ONE signalling server and a few bootstrapper nodes (which then get used as releays for all the other TCP nodes).

When a large number of browser nodes using the default configuration joins the network those nodes and the server get overloaded pretty quickly.
Additionally they can be all blocked by some malicious government (china, russia, ...).

The only solution would be to make the browser connect to some other websocket-capable nodes.

Problem: HTTP on HTTPS is disabled due to security.

Solution: HTTPS enabled websocket nodes

# How

A main libp2p node (the "server") will have the protocols /nodetrust/ca/1.0.0/, /nodetrust/dns/1.0.0/ and /nodetrust/discovery/1.0.0/
This node will also be given a wildcard certificate for `*.node.libp2p.io` that can also be used to sign certificates for the subdomains.

A node can then dial /nodetrust/ca/1.0.0/ on the server and send a certificate request for the `ID.node.libp2p.io` domain and a signature of this cert request using the private key of the ID.
The server will then respond back with the certificate.

The node then dials /nodetrust/dns/1.0.0/ and sends a signed timestamp. The server then updates the DNS A/AAAA record for `ID.node.libp2p.io` to the current IP of the node.
This has to be done every 5 minutes otherwise the DNS record is removed (so the DNS DB doesn't get filled up with offline nodes)

Additionally /nodetrust/discovery/1.0.0/ can be used to discover other nodes using this service (so the browser can find the wss nodes faster)
