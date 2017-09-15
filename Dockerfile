FROM node:8.4.0

RUN mkdir /app
WORKDIR /app

# See http://jdlm.info/articles/2016/03/06/lessons-building-node-app-docker.html
# and https://github.com/dockersamples/example-voting-app/blob/7629961971ab5ca9fdfeadff52e7127bd73684a5/result-app/Dockerfile#L8

ADD package.json /app/package.json
RUN npm install && npm ls
RUN mv /app/node_modules /node_modules

ADD . /app

EXPOSE 9000
ENTRYPOINT ["node", "index.js"]
CMD ["-p", "9000", "-c", "config/config.yaml"]
