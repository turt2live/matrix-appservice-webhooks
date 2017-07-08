var Bridge = require("matrix-appservice-bridge").Bridge;
var LogService = require("./LogService");
var AdminRoom = require("./matrix/AdminRoom");
var util = require("./utils");
var WebhookStore = require("./storage/WebhookStore");
var Promise = require('bluebird');
var _ = require('lodash');

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

    /**
     * Determines if a user is a bridge user (either the bot or virtual)
     * @param {string} userId the user ID to check
     * @return {boolean} true if the user ID is a bridge user, false otherwise
     */
    isBridgeUser(userId) {
        var isVirtualUser = userId.indexOf("@_webhook_") === 0 && userId.endsWith(":" + this._bridge.opts.domain);
        return isVirtualUser || userId == this._bridge.getBot().getUserId();
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

        WebhookStore.getBotAccountData().then(botProfile => {
            var avatarUrl = botProfile.avatarUrl;
            if (!avatarUrl || avatarUrl !== desiredAvatarUrl) {
                util.uploadContentFromUrl(this._bridge, desiredAvatarUrl, botIntent).then(mxcUrl => {
                    LogService.verbose("WebhookBridge", "Avatar MXC URL = " + mxcUrl);
                    LogService.info("WebhookBridge", "Updating avatar for bridge bot");
                    botIntent.setAvatarUrl(mxcUrl);
                    botProfile.avatarUrl = desiredAvatarUrl;
                    WebhookStore.setBotAccountData(botProfile);
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
     * @return {Promise<>} resolves when processing is complete
     * @private
     */
    _processRoom(roomId) {
        LogService.info("WebhookBridge", "Request to bridge room " + roomId);
        return this._bridge.getBot().getJoinedMembers(roomId).then(members => {
            var roomMemberIds = _.keys(members);
            var botIdx = roomMemberIds.indexOf(this._bridge.getBot().getUserId());

            if (roomMemberIds.length == 2) {
                var otherUserId = roomMemberIds[botIdx == 0 ? 1 : 0];
                this._adminRooms[roomId] = new AdminRoom(roomId, this);
                LogService.verbose("WebhookBridge", "Added admin room for user " + otherUserId);
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
        }

        // Default
        return Promise.resolve();
    }
}

module.exports = WebhookBridge;