cp ../server/wildcert.pem cert.pem
cp ../server/wild.crt cert.crt
npm run dist
rm -rf dist
mkdir dist
mv bundle.min.js{,.map} dist
cp {index.html,cert{.pem,.crt},page.css} dist
sed "s|bundle.js|bundle.min.js|g" -i dist/index.html
ipfs add -r dist
