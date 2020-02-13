############################################################
#
# base stage
FROM node:10-alpine AS base

RUN apk upgrade --no-cache
RUN apk add --no-cache ca-certificates


############################################################
#
# build stage - just build the app
FROM base AS build

COPY . /srv/matrix-appservice-webhooks

ENV NODE_ENV=development
RUN apk add --no-cache \
    make gcc g++ python libc-dev wget git dos2unix
WORKDIR /srv/matrix-appservice-webhooks
RUN npm install
RUN dos2unix docker-start.sh
RUN chmod +x docker-start.sh


############################################################
#
# final stage - put it all together
FROM base AS final

ENV NODE_ENV=production
ENV WEBHOOKS_USER_STORE_PATH=/data/user-store.db
ENV WEBHOOKS_ROOM_STORE_PATH=/data/room-store.db
ENV WEBHOOKS_DB_CONFIG_PATH=/data/database.json
ENV WEBHOOKS_ENV=docker

COPY --from=build /srv/matrix-appservice-webhooks/* /

WORKDIR /
CMD /docker-start.sh

EXPOSE 9000
VOLUME ["/data"]
