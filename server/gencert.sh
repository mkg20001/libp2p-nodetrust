#!/bin/bash

openssl req -x509 -newkey rsa:4096 -keyout key.pem -nodes -subj '/CN=*.ip.libp2p-nodetrust.tk' -out cert.pem -days 365
