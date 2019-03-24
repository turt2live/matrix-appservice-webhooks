FROM node:10-alpine

COPY . /

ENV NODE_ENV=development
RUN apk add --no-cache -t build-deps make gcc g++ python libc-dev wget git dos2unix \
    && apk add --no-cache ca-certificates \
    && cd / \
    && npm install \
    && dos2unix docker-start.sh \
    && chmod +x docker-start.sh \
    && apk del build-deps \
    && ls

ENV NODE_ENV=production
ENV WEBHOOKS_USER_STORE_PATH=/data/user-store.db
ENV WEBHOOKS_ROOM_STORE_PATH=/data/room-store.db
ENV WEBHOOKS_DB_CONFIG_PATH=/data/database.json
ENV WEBHOOKS_ENV=docker

WORKDIR /
CMD /docker-start.sh

EXPOSE 9000
VOLUME ["/data"]
