var Bridge = require("matrix-appservice-bridge").Bridge;
var LogService = require("./LogService");
var AdminRoom = require("./matrix/AdminRoom");
var util = require("./utils");
var WebhookStore = require("./storage/WebhookStore");
var Promise = require('bluebird');
var _ = require('lodash');
var PubSub = require("pubsub-js");
var WebService = require("./WebService");
var emoji = require('node-emoji');
var striptags = require("striptags");

class WebhookBridge {
    constructor(config, registration) {
        LogService.info("WebhookBridge", "Constructing bridge");

        this._config = config;
        this._registration = registration;
        this._adminRooms = {}; // { roomId: AdminRoom }

        this._bridge = new Bridge({
            registration: this._registration,
            homeserverUrl: this._config.homeserver.url,
            domain: this._config.homeserver.domain,
            controller: {
                onEvent: this._onEvent.bind(this),
                // none of these are used because the bridge doesn't allow users to create rooms or users
                // onUserQuery: this._onUserQuery.bind(this),
                // onAliasQuery: this._onAliasQuery.bind(this),
                // onAliasQueried: this._onAliasQueried.bind(this),
                onLog: (line, isError) => {
                    var method = isError ? LogService.error : LogService.verbose;
                    method("matrix-appservice-bridge", line);
                }
            },
            suppressEcho: false,
            queue: {
                type: "none",
                perRequest: false
            },
            intentOptions: {
                clients: {
                    dontCheckPowerLevel: true
                },
                bot: {
                    dontCheckPowerLevel: true
                }
            }
        });

        PubSub.subscribe("incoming_webhook", this._postMessage.bind(this));
    }

    run(port) {
        LogService.info("WebhookBridge", "Starting bridge");
        return this._bridge.run(port, this._config)
            .then(() => this._updateBotProfile())
            .then(() => this._bridgeKnownRooms())
            .catch(error => LogService.error("WebhookBridge", error));
    }

    /**
     * Gets the bridge bot powering the bridge
     * @return {AppServiceBot} the bridge bot
     */
    getBot() {
        return this._bridge.getBot();
    }

    /**
     * Gets the bridge bot as an intent
     * @return {Intent} the bridge bot
     */
    getBotIntent() {
        return this._bridge.getIntent(this._bridge.getBot().getUserId());
    }

    /**
     * Gets the intent for an Webhook virtual user
     * @param {string} handle the Webhook username
     * @return {Intent} the virtual user intent
     */
    getWebhookUserIntent(handle) {
        return this._bridge.getIntentFromLocalpart("_webhook_" + handle);
    }

    getOrCreateAdminRoom(userId) {
        var roomIds = _.keys(this._adminRooms);
        for (var roomId of roomIds) {
            if (!this._adminRooms[roomId]) continue;
            if (this._adminRooms[roomId].owner === userId)
                return Promise.resolve(this._adminRooms[roomId]);
        }

        return this.getBotIntent().createRoom({
            createAsClient: false, // use bot
            options: {
                invite: [userId],
                is_direct: true,
                preset: "trusted_private_chat",
                visibility: "private",
                initial_state: [{content: {guest_access: "can_join"}, type: "m.room.guest_access", state_key: ""}]
            }
        }).then(room => {
            var newRoomId = room.room_id;
            return this._processRoom(newRoomId, /*adminRoomOwner=*/userId).then(() => {
                var room = this._adminRooms[newRoomId];
                if (!room) throw new Error("Could not create admin room for " + userId);
                return room;
            });
        });
    }

    /**
     * Updates the bridge bot's appearance in matrix
     * @private
     */
    _updateBotProfile() {
        LogService.info("WebhookBridge", "Updating appearance of bridge bot");

        var desiredDisplayName = this._config.webhookBot.appearance.displayName || "Webhook Bridge";
        var desiredAvatarUrl = this._config.webhookBot.appearance.avatarUrl || "http://i.imgur.com/IDOBtEJ.png"; // webhook icon

        var botIntent = this.getBotIntent();

        WebhookStore.getAccountData('bridge').then(botProfile => {
            var avatarUrl = botProfile.avatarUrl;
            if (!avatarUrl || avatarUrl !== desiredAvatarUrl) {
                util.uploadContentFromUrl(this._bridge, desiredAvatarUrl, botIntent).then(mxcUrl => {
                    LogService.verbose("WebhookBridge", "Avatar MXC URL = " + mxcUrl);
                    LogService.info("WebhookBridge", "Updating avatar for bridge bot");
                    botIntent.setAvatarUrl(mxcUrl);
                    botProfile.avatarUrl = desiredAvatarUrl;
                    WebhookStore.setAccountData('bridge', botProfile);
                });
            }
            botIntent.getProfileInfo(this._bridge.getBot().getUserId(), 'displayname').then(profile => {
                if (profile.displayname != desiredDisplayName) {
                    LogService.info("WebhookBridge", "Updating display name from '" + profile.displayname + "' to '" + desiredDisplayName + "'");
                    botIntent.setDisplayName(desiredDisplayName);
                }
            });
        });
    }

    /**
     * Updates a webhook bot's appearance in matrix
     * @private
     */
    _updateHookProfile(intent, desiredDisplayName, desiredAvatarUrl) {
        LogService.info("WebhookBridge", "Updating appearance of " + intent.getClient().credentials.userId);

        return WebhookStore.getAccountData(intent.getClient().credentials.userId).then(botProfile => {
            var promises = [];

            var avatarUrl = botProfile.avatarUrl;
            if ((!avatarUrl || avatarUrl !== desiredAvatarUrl) && desiredAvatarUrl) {
                promises.push(util.uploadContentFromUrl(this._bridge, desiredAvatarUrl, this.getBotIntent()).then(mxcUrl => {
                    LogService.verbose("WebhookBridge", "Avatar MXC URL = " + mxcUrl);
                    LogService.info("WebhookBridge", "Updating avatar for " + intent.getClient().credentials.userId);
                    return intent.setAvatarUrl(mxcUrl).then(() => {
                        botProfile.avatarUrl = desiredAvatarUrl;
                        WebhookStore.setAccountData(intent.getClient().credentials.userId, botProfile);
                    });
                }));
            }

            promises.push(intent.getProfileInfo(intent.getClient().credentials.userId, 'displayname').then(profile => {
                if (profile.displayname != desiredDisplayName) {
                    LogService.info("WebhookBridge", "Updating display name from '" + profile.displayname + "' to '" + desiredDisplayName + "' on " + intent.getClient().credentials.userId);
                    intent.setDisplayName(desiredDisplayName);
                }
            }));

            return Promise.all(promises);
        });
    }

    /**
     * Updates the bridge information on all rooms the bridge bot participates in
     * @private
     */
    _bridgeKnownRooms() {
        this._bridge.getBot().getJoinedRooms().then(rooms => {
            for (var roomId of rooms) {
                this._processRoom(roomId);
            }
        });
    }

    /**
     * Attempts to determine if a room is a bridged room or an admin room, based on the membership and other
     * room information. This will categorize the room accordingly and prepare it for it's purpose.
     * @param {string} roomId the matrix room ID to process
     * @param {String} [adminRoomOwner] the owner of the admin room. If provided, the room will be forced as an admin room
     * @return {Promise<>} resolves when processing is complete
     * @private
     */
    _processRoom(roomId, adminRoomOwner = null) {
        LogService.info("WebhookBridge", "Request to bridge room " + roomId);
        return this._bridge.getBot().getJoinedMembers(roomId).then(members => {
            var roomMemberIds = _.keys(members);
            var botIdx = roomMemberIds.indexOf(this._bridge.getBot().getUserId());

            if (roomMemberIds.length == 2 || adminRoomOwner) {
                var otherUserId = roomMemberIds[botIdx == 0 ? 1 : 0];
                this._adminRooms[roomId] = new AdminRoom(roomId, this, otherUserId || adminRoomOwner);
                LogService.verbose("WebhookBridge", "Added admin room for user " + (otherUserId || adminRoomOwner));
            } // else it is just a regular room
        });
    }

    /**
     * Tries to find an appropriate admin room to send the given event to. If an admin room cannot be found,
     * this will do nothing.
     * @param {MatrixEvent} event the matrix event to send to any reasonable admin room
     * @private
     */
    _tryProcessAdminEvent(event) {
        var roomId = event.room_id;

        if (this._adminRooms[roomId]) this._adminRooms[roomId].handleEvent(event);
    }

    /**
     * Destroys an admin room. This will not cause the bridge bot to leave. It will simply de-categorize it.
     * The room may be unintentionally restored when the bridge restarts, depending on the room conditions.
     * @param {string} roomId the room ID to destroy
     */
    removeAdminRoom(roomId) {
        this._adminRooms[roomId] = null;
    }

    /**
     * Bridge handler for generic events
     * @private
     */
    _onEvent(request, context) {
        var event = request.getData();

        this._tryProcessAdminEvent(event);

        if (event.type === "m.room.member" && event.content.membership === "invite" && event.state_key === this.getBot().getUserId()) {
            LogService.info("WebhookBridge", event.state_key + " received invite to room " + event.room_id);
            return this._bridge.getIntent(event.state_key).join(event.room_id).then(() => this._processRoom(event.room_id));
        } else if (event.type === "m.room.message" && event.sender !== this.getBot().getUserId()) {
            return this._processMessage(event);
        }

        // Default
        return Promise.resolve();
    }

    _processMessage(event) {
        var message = event.content.body;
        if (!message.startsWith("!webhook")) return;

        var parts = message.split(" ");
        var room = event.room_id;

        if (parts[1]) room = parts[1];

        this._hasPermission(event.sender, room).then(permission => {
            if (!permission) {
                this.getBotIntent().sendMessage(event.room_id, {
                    msgtype: "m.notice",
                    body: "Sorry, you don't have permission to create webhooks for " + (event.room_id === room ? "this room" : room)
                });
            } else return this._newWebhook(room, event.sender).then(sentRoomId => {
                if (event.room_id === sentRoomId) return;
                this.getBotIntent().sendMessage(event.room_id, {
                    msgtype: "m.notice",
                    body: "I've sent you a direct message with your webhook URL."
                });
            });
        }).catch(error => {
            LogService.error("WebhookBridge", error);

            if (error.errcode === "M_GUEST_ACCESS_FORBIDDEN") {
                this.getBotIntent().sendMessage(event.room_id, {
                    msgtype: "m.notice",
                    body: "Room is not public or not found"
                });
            } else {
                this.getBotIntent().sendMessage(event.room_id, {
                    msgtype: "m.notice",
                    body: "There was an error processing your command."
                });
            }
        });
    }

    _hasPermission(sender, roomId) {
        return this.getBotIntent().getClient().getStateEvent(roomId, "m.room.power_levels", "").then(powerLevels => {
            if (!powerLevels) return false;

            var userPowerLevels = powerLevels['users'] || {};

            var powerLevel = userPowerLevels[sender];
            if (!powerLevel) powerLevel = powerLevels['users_default'];
            if (!powerLevel) powerLevel = 0; // default

            var statePowerLevel = powerLevels["state_default"];
            if (!statePowerLevel) return false;

            return statePowerLevel <= powerLevel;
        });
    }

    _newWebhook(roomId, userId) {
        return this.getOrCreateAdminRoom(userId)
            .then(room => WebhookStore.createWebhook(roomId, userId).then(webhook => [webhook, room]))
            .then(result => {
                var url = WebService.getHookUrl(result[0].id);
                return this.getBotIntent().sendMessage(result[1].roomId, {
                    // TODO: Use an HTML stripper to come up with the plain text version
                    msgtype: "m.notice",
                    body: "Here's your webhook URL for " + roomId + ": " + url + "\n\nTo send a message, POST the following JSON to that URL:\n\n{\n" +
                    "    \"text\": \"Hello world!\",\n" +
                    "    \"format\": \"plain\",\n" +
                    "    \"displayName\": \"My Cool Webhook\",\n" +
                    "    \"avatarUrl\": \"http://i.imgur.com/IDOBtEJ.png\"\n" +
                    "}\n\nIf you run into any issues, visit #webhooks:t2bot.io for help.",
                    format: "org.matrix.custom.html",
                    formatted_body: "Here's your webhook url for " + roomId + ": <a href=\"" + url + "\">" + url + "</a><br>To send a message, POST the following JSON to that URL:" +
                    "<pre><code>" +
                    "{\n" +
                    "    \"text\": \"Hello world!\",\n" +
                    "    \"format\": \"plain\",\n" +
                    "    \"displayName\": \"My Cool Webhook\",\n" +
                    "    \"avatarUrl\": \"http://i.imgur.com/IDOBtEJ.png\"\n" +
                    "}" +
                    "</code></pre>" +
                    "If you run into any issues, visit <a href=\"https://matrix.to/#/#webhooks:t2bot.io\">#webhooks:t2bot.io</a>"
                }).then(() => result[1].roomId); // make last promise return the admin room the notification was sent to
            });
    }

    _postMessage(event, webhookEvent) {
        var displayName = webhookEvent.payload.username || "Incoming Webhook";

        var convertedMessage = webhookEvent.payload.text;
        if (webhookEvent.payload.emoji !== false) {
            convertedMessage = emoji.emojify(convertedMessage, /*onMissing=*/null);
            displayName = emoji.emojify(displayName, /*onMissing=*/null);
        }

        var avatarUrl = webhookEvent.payload.avatarUrl || null;
        var localpart = (webhookEvent.hook.roomId + "_" + displayName).replace(/[^a-zA-Z0-9]/g, '_');
        var intent = this.getWebhookUserIntent(localpart);

        var msgContent = {
            msgtype: "m.text",
            body: convertedMessage
        };

        if (webhookEvent.payload.format === "html") {
            msgContent.format = "org.matrix.custom.html";
            msgContent.formatted_body = convertedMessage;
            msgContent.body = striptags(convertedMessage);
        }

        var postFn = () => intent.sendMessage(webhookEvent.hook.roomId, msgContent);

        this._updateHookProfile(intent, displayName, avatarUrl)
            .then(() => {
                return intent.join(webhookEvent.hook.roomId).then(postFn, err => {
                    LogService.error("WebhookBridge", err);
                    return this.getBotIntent().invite(webhookEvent.hook.roomId, intent.getClient().credentials.userId).then(postFn);
                });
            }).catch(error => LogService.error("WebhookBridge", error));
    }
}

module.exports = WebhookBridge;