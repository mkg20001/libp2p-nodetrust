FROM node:8
RUN wget -O /usr/local/bin/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 && chmod +x /usr/local/bin/dumb-init
COPY . /app
WORKDIR /app
RUN npm i --production
WORKDIR /app/demo
RUN npm i
ENTRYPOINT ["/usr/local/bin/dumb-init", "node", "."]
ENV PRODUCTION 1
ENV DEBUG libp2p*
EXPOSE 5285
