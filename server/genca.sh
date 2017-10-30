#!/bin/sh

openssl req -subj '/C=US/ST=Oregon/L=Portland/O=Libp2p Nodetrust DEV/OU=Org' -new -nodes -x509 -days 3650 -extensions v3_ca -keyout cakey.pem -out cacert.pem
openssl x509 -in cacert.pem -inform PEM -out ca.crt

# to install ca
# sudo cp ca.crt /usr/share/ca-certificates/extra/nodetrust.crt
# sudo dpkg-reconfigure ca-certificates
