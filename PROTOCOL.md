# Libp2p Nodetrust Specification

## Servers and Clients

### Client
A libp2p-nodetrust client that wants to obtain a certificate

### Proof Server
A server that issues proofs for the addresses a client used to connect to it

The proof is a signed protobuf document that contains a timestamp, the client peerID and the address(es).
It is valid for 5 minutes

### DNS Server
The DNS server serves the following record types:

- DNS2IP
  - IP4: `ip4<IPv4 address with dots replaced by dashes>[.<domain...>]`

    Example: `ip4127-0-0-1.ip.libp2p-nodetrust.tk` => `A 127.0.0.1`
  - IP6: `ip6<IPv6 address with dots replaced by dashes>[.<domain...>]`

    Example: `ip6--1.ip.libp2p-nodetrust.tk` => `AAAA ::1`

- ID0

  A TXT record that represents a peerID: `p<alphanum encoded peerID>[.<domain...>]`

  Example: `pw4t9mvzh6onnp01f80botcm2pek713h2prwjb3qx6j9bnak4a4o8.nt.lp2p.tk` => `TXT "id=QmfVDYD9Du7fNR4DKooPXZnRUoArR3FBRR3udbhZAT9m2H"`

- DNS-01

  ACME DNS-01 challenge proofs

  Can be added by the issue server using the `/p2p/nodetrust/dns-01/1.0.0` protocol

### Issue Server
The issue server issues the letsencrypt certificates for the IPs that haven been proven to belong to a certain client using the proof server(s)

## Example flow of client obtaining certificate

- Client connects to issue server using `/p2p/nodetrust/issue/info/1.0.0` to obtain information about the available proofs and proof servers
- In parallel the client connects to every proof server to obtain a proof
  - If the connection succeeds the client stores the proof in memory
  - If the connection fails the client ignores that proof
- If the client failed to aquire any proofs it throws an error
- Client connects to issue server using `/p2p/nodetrust/issue/1.0.0` and sends both the proofs and a list of the cryptographical algorhithms the client supports to the server
  - Issue server verifies every proof, throws if there are none or any is invalid
  - Issue server calculates which algorithms the client and server both support, throws if none
  - Issue server aquires challenge from letsencrypt via ACME v2
  - Issue server connects to DNS server via `/p2p/nodetrust/dns-01/1.0.0` and adds the challenge to DNS
  - Issue server runs authrization and if succesfull obtains cert
- Client recieves cert or throws if response had an error value
- Client launches a WebSocketsSecure server
- Client starts to periodically broadcast PeerInfo via pubsub channel `nodetrust_discovery_v2`
