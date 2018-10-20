#!/bin/sh

# Migrate the registration file if possible
if [ ! -f "/data/appservice-registration-webhooks.yaml" ]; then
    echo "Registration file does not exist - trying to copy old one"
    cp -v /data/appservice-webhooks-registration.yaml /data/appservice-registration-webhooks.yaml
fi

# Actually run the bridge
node index.js -p 9000 -c /data/config.yaml -f /data/appservice-registration-webhooks.yaml