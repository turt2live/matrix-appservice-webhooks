var LogService = require("../LogService");
var PubSub = require("pubsub-js");
var Promise = require("bluebird");
var ImageUploader = require("./ImageUploader")

class WebhookReceiver {
    constructor() {
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
            require("./layers/message/emoji"),
            require("./layers/message/from_slack_attachments"),
            require("./layers/message/html"),
            require("./layers/message/slack_fallback"),
        ];

        PubSub.subscribe("incoming_webhook", this._postMessage.bind(this));
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
        var matrixPayload = {
            event: {
                body: null,
                msgtype: "m.text",
            },
            sender: {
                displayName: null,
                avatarUrl: null,
            }
        };

        // Apply filtering on the content
        var layerChain = Promise.resolve();

        // Upload (optional) Slack attachments
        var uploader = new ImageUploader(this._bridge)
        var attachments = webhookEvent.payload.attachments
        if (attachments && attachments.length > 0)
            attachments.map(attm => layerChain = layerChain.then(() => uploader.uploadImages(attm)));

        this._layers.map(a => layerChain = layerChain.then(() => a(webhookEvent.payload, matrixPayload)));

        layerChain.then(() => {
            var localpart = (webhookEvent.hook.roomId + "_" + matrixPayload.sender.displayName).replace(/[^a-zA-Z0-9]/g, '_');
            var intent = this._bridge.getWebhookUserIntent(localpart);

            // Update profile, try join, fall back to invite, and try to send message
            var postFn = () => intent.sendMessage(webhookEvent.hook.roomId, matrixPayload.event);
            this._bridge.updateHookProfile(intent, matrixPayload.sender.displayName, matrixPayload.sender.avatarUrl)
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
