var LogService = require("../LogService");
var PubSub = require("pubsub-js");

class WebhookReceiver {
    constructor() {
        this._layers = [
            require("./layers/emoji"),
            require("./layers/html"),
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
        var matrixPayload = {
            event: {
                body: webhookEvent.payload.text,
                msgtype: "m.text",
            },
            sender: {
                // username is slack
                displayName: webhookEvent.payload.username || webhookEvent.payload.displayName || "Incoming Webhook",

                // icon_url is slack
                avatarUrl: webhookEvent.payload.icon_url || webhookEvent.payload.avatarUrl || null,
            }
        };

        // Apply filtering on the content
        this._layers.map(a => a(webhookEvent.payload, matrixPayload));

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
    }

}

module.exports = new WebhookReceiver();