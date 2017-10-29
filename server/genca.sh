#!/bin/sh

openssl req -subj '/' -new -nodes -x509 -days 3650 -extensions v3_ca -keyout cakey.pem -out cacert.pem
