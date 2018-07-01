var ProvisioningService = require("./ProvisioningService");
var LogService = require("matrix-js-snippets").LogService;
var WebService = require("../WebService");
var striptags = require("striptags");

/**
 * An in-chat way to create and manage webhooks
 */
class InteractiveProvisioner {
    constructor() {
    }

    /**
     * Sets the bridge to interact with
     * @param {WebhookBridge} bridge the bridge to use
     */
    setBridge(bridge) {
        LogService.verbose("InteractiveProvisioner", "Received bridge. Using default bot intent");
        this._bridge = bridge;
        this._intent = this._bridge.getBotIntent();
    }

    /**
     * Processes a request to create a webhook
     * @param {string} userId the user ID requesting the webhook
     * @param {string} roomId the room ID the webhook is for
     * @param {string} inRoomId the room ID the request started in
     */
    createWebhook(userId, roomId, inRoomId) {
        ProvisioningService.createWebhook(roomId, userId).then(webhook => {
            return this._bridge.getOrCreateAdminRoom(userId).then(adminRoom => {
                var url = WebService.getHookUrl(webhook.id);
                var htmlMessage = "Here's your webhook url for " + roomId + ": <a href=\"" + url + "\">" + url + "</a><br>To send a message, POST the following JSON to that URL:" +
                    "<pre><code>" +
                    "{\n" +
                    "    \"text\": \"Hello world!\",\n" +
                    "    \"format\": \"plain\",\n" +
                    "    \"displayName\": \"My Cool Webhook\",\n" +
                    "    \"avatarUrl\": \"http://i.imgur.com/IDOBtEJ.png\"\n" +
                    "}" +
                    "</code></pre>" +
                    "If you run into any issues, visit <a href=\"https://matrix.to/#/#webhooks:t2bot.io\">#webhooks:t2bot.io</a>";

                return this._intent.sendMessage(adminRoom.roomId, {
                    msgtype: "m.notice",
                    body: striptags(htmlMessage),
                    format: "org.matrix.custom.html",
                    formatted_body: htmlMessage
                }).then(() => {
                    if (adminRoom.roomId !== inRoomId) {
                        return this._intent.sendMessage(inRoomId, {
                            msgtype: "m.notice",
                            body: "I've sent you a private message with your hook information"
                        });
                    }
                });
            });
        }).catch(error => {
            if (error === ProvisioningService.PERMISSION_ERROR_MESSAGE) {
                return this._intent.sendMessage(inRoomId, {
                    msgtype: "m.notice",
                    body: "Sorry, you don't have permission to create webhooks for " + (inRoomId === roomId ? "this room" : roomId)
                });
            }

            LogService.error("InteractiveProvisioner", error);

            if (error.errcode === "M_GUEST_ACCESS_FORBIDDEN") {
                this._intent.sendMessage(inRoomId, {
                    msgtype: "m.notice",
                    body: "Room is not public or not found"
                });
            } else {
                this._intent.sendMessage(inRoomId, {
                    msgtype: "m.notice",
                    body: "There was an error processing your command."
                });
            }
        });
    }
}

module.exports = new InteractiveProvisioner();