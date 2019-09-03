const Bridge = require("matrix-appservice-bridge").Bridge;
const LogService = require("matrix-js-snippets").LogService;
const AdminRoom = require("./matrix/AdminRoom");
const util = require("./utils");
const WebhookStore = require("./storage/WebhookStore");
const Promise = require('bluebird');
const _ = require('lodash');
const WebService = require("./WebService");
const ProvisioningService = require("./provisioning/ProvisioningService");
const InteractiveProvisioner = require("./provisioning/InteractiveProvisioner");
const WebhookReceiver = require("./processing/WebhookReceiver");

class WebhookBridge {
    constructor() {
        this._adminRooms = {}; // { roomId: AdminRoom }
    }

    init(config, registration) {
        LogService.info("WebhookBridge", "Constructing bridge");

        this._config = config;
        this._registration = registration;

        this._bridge = new Bridge({
            registration: this._registration,
            homeserverUrl: this._config.homeserver.url,
            domain: this._config.homeserver.domain,
            userStore: process.env["WEBHOOKS_USER_STORE_PATH"] || "user-store.db",
            roomStore: process.env["WEBHOOKS_ROOM_STORE_PATH"] || "room-store.db",
            controller: {
                onEvent: this._onEvent.bind(this),
                // none of these are used because the bridge doesn't allow users to create rooms or users
                // onUserQuery: this._onUserQuery.bind(this),
                // onAliasQuery: this._onAliasQuery.bind(this),
                // onAliasQueried: this._onAliasQueried.bind(this),
                onLog: (line, isError) => {
                    const method = isError ? LogService.error : LogService.verbose;
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

        return this._bridge;
    }

    run(port) {
        LogService.info("WebhookBridge", "Starting bridge");
        return this._bridge.run(port, this._config)
        // TODO: There must be a better way to do this
            .then(() => ProvisioningService.setClient(this.getBotIntent()))
            .then(() => InteractiveProvisioner.setBridge(this))
            .then(() => WebhookReceiver.setBridge(this))
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
        const roomIds = _.keys(this._adminRooms);
        for (let roomId of roomIds) {
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
            const newRoomId = room.room_id;
            return this._processRoom(newRoomId, /*adminRoomOwner=*/userId).then(() => {
                let room = this._adminRooms[newRoomId];
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
        // return;
        LogService.info("WebhookBridge", "Updating appearance of bridge bot");

        const desiredDisplayName = this._config.webhookBot.appearance.displayName || "Webhook Bridge";
        const desiredAvatarUrl = this._config.webhookBot.appearance.avatarUrl || "http://i.imgur.com/IDOBtEJ.png"; // webhook icon

        const botIntent = this.getBotIntent();

        WebhookStore.getAccountData('bridge').then(botProfile => {
            let avatarUrl = botProfile.avatarUrl;
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
     */
    updateHookProfile(intent, desiredDisplayName, desiredAvatarUrl) {
        LogService.info("WebhookBridge", "Updating appearance of " + intent.getClient().credentials.userId);

        return WebhookStore.getAccountData(intent.getClient().credentials.userId).then(async botProfile => {
            const promises = [];

            let avatarUrl = botProfile.avatarUrl;
            if ((!avatarUrl || avatarUrl !== desiredAvatarUrl) && desiredAvatarUrl) {
                let uploadPromise = Promise.resolve(desiredAvatarUrl);
                if (!desiredAvatarUrl.startsWith("mxc://"))
                    uploadPromise = util.uploadContentFromUrl(this._bridge, desiredAvatarUrl, this.getBotIntent());

                promises.push(()=>uploadPromise.then(mxcUrl => {
                    LogService.verbose("WebhookBridge", "Avatar MXC URL = " + mxcUrl);
                    LogService.info("WebhookBridge", "Updating avatar for " + intent.getClient().credentials.userId);
                    return intent.setAvatarUrl(mxcUrl).then(() => {
                        botProfile.avatarUrl = desiredAvatarUrl;
                        return WebhookStore.setAccountData(intent.getClient().credentials.userId, botProfile);
                    });
                }));
            }
            
            function waitProfileNameUpdated(){
                return intent.getProfileInfo(intent.getClient().credentials.userId, 'displayname',false)
                .then(profile => {
                    if (profile.displayname != desiredDisplayName) {
                        console.log('not update yet,keep waiting')
                        return Promise.delay(1000).then(waitProfileNameUpdated)
                    }
                });
            }

            promises.push(()=>intent.getProfileInfo(intent.getClient().credentials.userId, 'displayname',false)
                .then(profile => {
                    if (profile.displayname != desiredDisplayName) {
                        LogService.info("WebhookBridge", "Updating display name from '" + profile.displayname + "' to '" + desiredDisplayName + "' on " + intent.getClient().credentials.userId);
                        return intent.setDisplayName(desiredDisplayName).then(waitProfileNameUpdated);
                    }
                }));
            
            
            
            return util.runSerialPromise(promises);
        });
    }

    /**
     * Updates the bridge information on all rooms the bridge bot participates in
     * @private
     */
    _bridgeKnownRooms() {
        this._bridge.getBot().getJoinedRooms().then(rooms => {
            for (let roomId of rooms) {
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
            const roomMemberIds = _.keys(members);
            const botIdx = roomMemberIds.indexOf(this._bridge.getBot().getUserId());

            if (roomMemberIds.length === 2 || adminRoomOwner) {
                const otherUserId = roomMemberIds[botIdx === 0 ? 1 : 0];
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
        const roomId = event.room_id;

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
        const event = request.getData();

        this._tryProcessAdminEvent(event);

        if (event.type === "m.room.member" && event.content.membership === "invite" && event.state_key === this.getBot().getUserId()) {
            LogService.info("WebhookBridge", event.state_key + " received invite to room " + event.room_id);
            const tryJoin = () => this._bridge.getIntent(event.state_key).join(event.room_id).then(() => this._processRoom(event.room_id));
            return tryJoin().catch(err => {
                console.error(err);
                setTimeout(() => tryJoin(), 15000); // try to join the room again later
            });
        } else if (event.type === "m.room.message" && event.sender !== this.getBot().getUserId()) {
            return this._processMessage(event);
        }

        // Default
        return Promise.resolve();
    }

    _processMessage(event) {
        let message = event.content.body;
        if (!message || !message.startsWith("!webhook")) return;

        const parts = message.split(" ");
        let room = event.room_id;
        if (parts[1]) room = parts[1];

        InteractiveProvisioner.createWebhook(event.sender, room, event.room_id);
    }
}

module.exports = new WebhookBridge();
