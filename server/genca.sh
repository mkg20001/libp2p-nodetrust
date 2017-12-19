#!/bin/sh

openssl req -subj '/C=US/ST=Oregon/L=Portland/O=Libp2p Nodetrust DEV/OU=Org' -new -nodes -x509 -days 3650 -extensions v3_ca -keyout cakey.pem -out cacert.pem
openssl x509 -in cacert.pem -inform PEM -out ca.crt

openssl req -x509 -newkey rsa:2048 -keyout wildkey.pem -nodes -out wildcert.pem -days 3650 -subj '/C=US/ST=Oregon/L=Portland/O=Libp2p Nodetrust DEV WILDCARD/OU=Org/CN=node.libp2p/subjectAltName=DNS.1=*.node.libp2p'
openssl x509 -in wildcert.pem -inform PEM -out wild.crt

# to install ca
# sudo cp {wild,ca}.crt /usr/share/ca-certificates/extra/
# sudo dpkg-reconfigure ca-certificates
