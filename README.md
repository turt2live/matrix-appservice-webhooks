# matrix-appservice-webhooks

[![TravisCI badge](https://travis-ci.org/turt2live/matrix-appservice-webhooks.svg?branch=master)](https://travis-ci.org/turt2live/matrix-appservice-webhooks)
[![Targeted for next release](https://badge.waffle.io/turt2live/matrix-appservice-webhooks.png?label=sorted&title=Targeted+for+next+release)](https://waffle.io/turt2live/waffle-matrix?utm_source=badge)
[![WIP](https://badge.waffle.io/turt2live/matrix-appservice-webhooks.png?label=wip&title=WIP)](https://waffle.io/turt2live/waffle-matrix?utm_source=badge)
[![API Documentation](https://img.shields.io/badge/api%20documentation-Postman-blue.svg)](https://documenter.getpostman.com/view/1707443/matrix-webhooks/6fYShpU)

[![Run in Postman](https://run.pstmn.io/button.svg)](https://app.getpostman.com/run-collection/803b1c8e7f6fad521390)

Slack-compatible webhooks for Matrix. Talk about it on Matrix: [#webhooks:t2bot.io](https://matrix.to/#/#webhooks:t2bot.io)

# Requirements

* [NodeJS](https://nodejs.org/en/) (Node 6 or higher recommended)
* A [Synapse](https://github.com/matrix-org/synapse) server

# Installation

**Before you begin:** A Synapse server is required. The instructions here assume that Synapse server is a default setup.

1. Clone this repository and install the dependencies
   ```
   git clone http://github.com/turt2live/matrix-appservice-webhooks
   cd matrix-appservice-webhooks
   npm install
   ```

2. Copy `config/sample.yaml` to `config/config.yaml` and fill in the appropriate fields
3. Generate the registration file
   ```
   node index.js -r -u "http://localhost:9000" -c config/config.yaml
   ```
   *Note:* The default URL to run the appservice is `http://localhost:9000`. If you have other appservices, or other requirements, pick an appropriate hostname and port.

4. Copy/symlink the registration file to your Synapse directory
   ```
   cd ~/.synapse
   ln -s ../matrix-appservice-webhooks/appservice-registration-webhooks.yaml appservice-registration-webhooks.yaml
   ```

5. Add the registration file to your `homeserver.yaml`
   ```
   ...
   app_service_config_files: ["appservice-registration-webhooks.yaml"]
   ...
   ```

6. Restart Synapse (`synctl restart`, for example)

# Running

Using the port specified during the install (`9000` by default), use `node index.js -p 9000 -c config/config.yaml` from the repository directory.

The bridge should start working shortly afterwards.

# Usage

Invite the webhook bridge to your room (`@_webhook:t2bot.io`) and send the message `!webhook`. The bridge bot will then send you a link to send messages to in a private message. You must be able to configure the room in order to set up webhooks.

# JSON Body (for posting messages)

```
{
  "text": "Hello world!",
  "format": "plain",
  "displayName": "My Cool Webhook",
  "avatarUrl": "http://i.imgur.com/IDOBtEJ.png"
}
```

Format can be `plain` or `html`. Emoji will be converted automatically(`:heart:` becomes ❤); set the `emoji` property to `false` to disable this conversion.
To send a notice or emote, add `"msgtype" : "notice"` or `"msgtype" : "emote"` resp.

# Running with Docker

There are two gotchas when running with Docker.

First of all the appservice needs to communicate with synapse. To do this, create a docker network and set the urls accordingly. Using `localhost:9000` as the url for appservice won't work because synapse has it's "own" localhost. Make sure you [don't expose the appservice port](https://github.com/turt2live/matrix-appservice-webhooks/pull/24#discussion_r138083936) outside the host.

If the sync homeserver -> appservice isn't working check your logs for something like this and change the name of the appservice container so that synapse accepts it, ie `webhooks`, `matrix-webhooks` or similar.

```
synapse.appservice.api - 228 - WARNING - - push_bulk to http://matrix_webhooks_1:9000/transactions/1 threw exception invalid hostname: matrix_webhooks_1
```

Secondly, you need to generate the registration file and let synapse (or whatever server you're using) have access to it. The approach here is to generate it with a temporary container and a [bind mount](https://docs.docker.com/engine/admin/volumes/bind-mounts/) so the file is accessible on the host and can be copied to the homeserver.

Below are a few example of how do achieve this. There is also a `docker-compose.example.yaml`.


### Build the image
```
# Feel free to change the tag
docker build -t matrix-webhooks-image .
```

### Generating registration file
```
# The host in the URL depends on what you later name the container
docker run --rm -v "$(pwd)":/app matrix-webhooks-image \
  -r -u "http://matrixwebhooks:9000" -c config/config.yaml
cp appservice-registration-webhooks.yaml /path/to/synapse/
```

All the arguments after the image name (`matrix-webhooks-image`) will be passed to `node`, so you can use another config file if you wish.


### Running the container with default arguments

```
# Port is 9000 and config is config/config.yaml as per the Dockerfile CMD
docker run -p 4501:4501 -d --name matrixwebhooks -v $(pwd):/app/ matrix-webhooks-image
```

### Running the container with custom arguments

```
# Using 127.0.0.1 means the port won't be exposed outside the host, so you'd have to reverse proxy it
docker run -p 127.0.0.1:4501:4501  -d --name matrixwebhooks -v $(pwd):/app/ matrix-webhooks-image \
  -p 9001 -c config/other_config.yaml
```

### Update config.yaml
If you want to use the internal network you need to set the URL to synapse to the name of the container.

```
homeserver:
  # The domain for the client-server API calls.
  url: "http://synapse:8008"
```

### Creating a network to connect the containers
```
docker network create matrix-network
docker network connect matrix-network [your_synapse_container]
docker network connect matrix-network matrixwebhooks
```

Now restart your containers and you should be good to go!
