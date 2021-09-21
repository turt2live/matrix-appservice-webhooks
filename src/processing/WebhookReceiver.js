const LogService = require("matrix-js-snippets").LogService;
const PubSub = require("pubsub-js");
const Promise = require("bluebird");

class WebhookReceiver {
    constructor() {
        PubSub.subscribe("incoming_webhook", this._postMessage.bind(this));
    }

    _getLayers() {
        if (!this._layers) {
            this._layers = [
                // Avatar
                require("./layers/avatar/from_webhook"),
                require("./layers/avatar/slack_icon_url"),
                require("./layers/avatar/slack_icon_emoji"),
                require("./layers/avatar/default"),

                // Display Name
                require("./layers/displayName/from_webhook"),
                require("./layers/displayName/slack"),
                require("./layers/displayName/default"),
                require("./layers/displayName/emoji"),

                // Message
                require("./layers/message/from_webhook"),
                require("./layers/message/from_slack_attachments"),
                require("./layers/message/emoji"),
                require("./layers/message/slack_links"),
                require("./layers/message/html"),
                require("./layers/message/slack_fallback"),
                require("./layers/message/html_fallback"),

                // Misc
                require("./layers/message/msgtype"),

                // Post-processing
                require("./layers/postprocess/upload_images"),
            ];
        }

        return this._layers;
    }

    /**
     * Sets the bridge to interact with
     * @param {WebhookBridge} bridge the bridge to use
     */
    setBridge(bridge) {
        LogService.verbose("WebhookReceiver", "Received bridge.");
        this._bridge = bridge;
    }

    _postMessage(event, webhookEvent) {
        // Note: The payload is intentionally blank. This is for IDE autocomplete. The values will be populated by the layers.
        const matrixPayload = {
            event: {
                body: null,
                msgtype: "m.text",
            },
            sender: {
                displayName: null,
                avatar_url: null,
            }
        };

        // Apply filtering on the content
        let layerChain = Promise.resolve();
        this._getLayers().forEach(a => layerChain = layerChain.then(() => a(webhookEvent.payload, matrixPayload)));

        layerChain.then(() => {
            const localpart = (webhookEvent.hook.roomId + "_" + matrixPayload.sender.displayName).replace(/[^a-zA-Z0-9]/g, '_');
            const intent = this._bridge.getWebhookUserIntent(localpart);

            // Update profile, try join, fall back to invite, and try to send message
            const postFn = () => intent.sendMessage(webhookEvent.hook.roomId, matrixPayload.event);
            this._bridge.updateHookProfile(intent, matrixPayload.sender.displayName, matrixPayload.sender.avatar_url)
                .then(() => {
                    return intent.join(webhookEvent.hook.roomId).then(postFn, err => {
                        LogService.error("WebhookReceiver", err);
                        return this._bridge.getBotIntent().invite(webhookEvent.hook.roomId, intent.getClient().credentials.userId).then(postFn);
                    });
                }).catch(error => LogService.error("WebhookReceiver", error));
        });
    }

}

module.exports = new WebhookReceiver();
