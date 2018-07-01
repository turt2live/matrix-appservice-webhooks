FROM node:alpine

COPY . /

ENV NODE_ENV=development
RUN apk add --no-cache -t build-deps make gcc g++ python libc-dev wget git \
    && apk add --no-cache ca-certificates \
    && cd / \
    && npm install \
    && apk del build-deps

ENV NODE_ENV=production
ENV WEBHOOKS_USER_STORE_PATH=/data/user-store.db
ENV WEBHOOKS_ROOM_STORE_PATH=/data/room-store.db
ENV WEBHOOKS_DB_CONFIG_PATH=/data/database.json

CMD node index.js -p 9000 -c /data/config.yaml -f /data/appservice-webhooks-registration.yaml

EXPOSE 9000
VOLUME ["/data"]
