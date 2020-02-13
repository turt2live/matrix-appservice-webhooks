#!/usr/bin/env sh

set -e

# Migrate the registration file if possible
if [ ! -f "/data/appservice-registration-webhooks.yaml" ] && [ -f "/data/appservice-webhooks-registration.yaml" ]; then
    echo "Registration file does not exist - copy old one"
    cp -v /data/appservice-webhooks-registration.yaml /data/appservice-registration-webhooks.yaml
fi

exec "$@"
