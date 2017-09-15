# Running with Docker

Setting up Docker support for the webhooks bridge is somewhat involved due to how Synapse and the bridge need to interact. The first important part is that **port 9000 must never leave the host**. This port is used by Synapse to send events to the bridge, and it does so in an insecure way.

During setup, if your container running the bridge doesn't appear to be working then the container name may need changing. This is the case if you're seeing errors like this:
```
synapse.appservice.api - 228 - WARNING - - push_bulk to http://matrix_webhooks_1:9000/transactions/1 threw exception invalid hostname: matrix_webhooks_1
```

You'll need to generate the registration file and let synapse have access to it. The approach here is to generate it with a temporary container and a [bind mount](https://docs.docker.com/engine/admin/volumes/bind-mounts/) so the file is accessible on the host and can be copied to the homeserver.

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
  -p 9000 -c config/other_config.yaml
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