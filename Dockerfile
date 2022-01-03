############################################################
#
# base stage
FROM node:12-alpine AS base

RUN apk upgrade --no-cache
RUN apk add --no-cache ca-certificates


############################################################
#
# build stage - just build the app
FROM base AS build

ENV NODE_ENV=development

RUN apk add --no-cache \
    make gcc g++ python3 libc-dev wget git dos2unix

WORKDIR /srv/matrix-appservice-webhooks

COPY package.json ./
COPY package-lock.json ./
COPY index.js ./
COPY src ./src
COPY config ./config
COPY migrations ./migrations

RUN ln -s /usr/bin/python3 /usr/bin/python && \
        npm install -g npm && \
        npm install
#RUN npm audit fix

############################################################
#
# final stage - put it all together
FROM base AS final

ENV NODE_ENV=production
ENV WEBHOOKS_USER_STORE_PATH=/data/user-store.db
ENV WEBHOOKS_ROOM_STORE_PATH=/data/room-store.db
ENV WEBHOOKS_DB_CONFIG_PATH=/data/database.json
ENV WEBHOOKS_ENV=docker

WORKDIR /

COPY --from=build /srv/matrix-appservice-webhooks ./
COPY docker-entrypoint.sh /usr/local/bin/
RUN mkdir -p ./db

ENTRYPOINT [ "/usr/local/bin/docker-entrypoint.sh" ]
CMD [ "node", "index.js", "-p", "9000", "-c", "/data/config.yaml", "-f", "/data/appservice-registration-webhooks.yaml" ]

EXPOSE 9000
VOLUME ["/data"]
