#!/bin/bash

set -e

rm -rf dist
npm run build
ipfs add -r dist
