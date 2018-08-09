issue: nodemon -i ./server/src/letsencrypt -x DEBUG=nodetrust*,acme*,libp2p*,!libp2p:secio node ./server/src/bin.js issue ./server/config.dev.issue.json | bunyan -l 0
dns: nodemon -i ./server/src/letsencrypt -x DEBUG=nodetrust*,libp2p*,!libp2p:secio node ./server/src/bin.js dns ./server/config.dev.dns.json | bunyan -l 0
proof: nodemon -i ./server/src/letsencrypt -x DEBUG=nodetrust*,libp2p*,!libp2p:secio node ./server/src/bin.js proof ./server/config.dev.proof.json | bunyan -l 0
client: sleep 2s && nodemon -d 2 -x USE_LOCAL=1 DEBUG=nodetrust*,libp2p*,!libp2p:secio* node test-client.js
