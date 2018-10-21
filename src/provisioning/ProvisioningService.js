const WebhookStore = require("../storage/WebhookStore");
const Promise = require("bluebird");
const LogService = require("matrix-js-snippets").LogService;

class ProvisioningService {

    constructor() {
        this.PERMISSION_ERROR_MESSAGE = "User does not have permission to manage webhooks in this room";
    }

    /**
     * Sets the intent object to use for permission checking
     * @param {Intent} intent the intent to use
     */
    setClient(intent) {
        LogService.verbose("ProvisioningService", "Received intent. Using account " + intent.getClient().credentials.userId);
        this._intent = intent;
    }

    /**
     * Gets the bot user ID for the bridge
     * @return {string} the bot user ID
     */
    getBotUserId() {
        return this._intent.getClient().credentials.userId;
    }

    /**
     * Creates a new webhook for a room
     * @param {string} roomId the room ID the webhook belongs to
     * @param {string} userId the user trying to create the webhook
     * @param {String|null} label optional label for the webhook
     * @returns {Promise<Webhook>} resolves to the created webhook
     */
    createWebhook(roomId, userId, label) {
        LogService.info("ProvisioningService", "Processing create hook request for " + roomId + " by " + userId);
        return this.hasPermission(userId, roomId)
            .then(async () => {
                await this._intent.join(roomId);
                return WebhookStore.createWebhook(roomId, userId, label)
            }, () => Promise.reject(this.PERMISSION_ERROR_MESSAGE));
    }

    /***
     * Updates a webhook's properties
     * @param {string} roomId the room ID the webhook belongs to
     * @param {string} userId the user trying to update the webhook
     * @param {string} hookId the webhook ID
     * @param {String|null} newLabel optional new label for the webhook
     * @returns {Promise<Webhook>} resolves to the updated webhook
     */
    updateWebhook(roomId, userId, hookId, newLabel) {
        LogService.info("ProvisioningService", "Processing webhook update request for " + roomId + " by " + userId);
        return this.hasPermission(roomId, userId)
            .then(async () => {
                const webhook = await WebhookStore.getWebhook(hookId);
                if (webhook.roomId !== roomId) return Promise.reject(this.PERMISSION_ERROR_MESSAGE);

                let changed = false;
                if (webhook.label !== newLabel) {
                    webhook.label = newLabel;
                    changed = true;
                }

                if (changed) await webhook.save();
                return webhook;
            }, () => Promise.reject(this.PERMISSION_ERROR_MESSAGE));
    }

    /**
     * Gets a webhook
     * @param {string} roomId the room ID to search in
     * @param {string} userId the user trying to view the room's webhook
     * @param {string} hookId the webhook ID
     * @returns {Promise<Webhook>} resolves to the found webhook
     */
    getWebhook(roomId, userId, hookId) {
        LogService.info("ProvisioningService", "Processing get hook request for " + roomId + " by " + userId);
        return this.hasPermission(userId, roomId)
            .then(async () => {
                const webhook = await WebhookStore.getWebhook(hookId);
                if (webhook.roomId !== roomId) return Promise.reject(this.PERMISSION_ERROR_MESSAGE);
                return webhook;
            }, () => Promise.reject(this.PERMISSION_ERROR_MESSAGE));
    }

    /**
     * Gets a list of all webhooks in a room
     * @param {string} roomId the room ID to search in
     * @param {string} userId the user trying to view the room's webhooks
     * @returns {Promise<Webhook[]>} resolves to the list of webhooks
     */
    getWebhooks(roomId, userId) {
        LogService.info("ProvisioningService", "Processing list hooks request for " + roomId + " by " + userId);
        return this.hasPermission(userId, roomId)
            .then(() => WebhookStore.listWebhooks(roomId), () => Promise.reject(this.PERMISSION_ERROR_MESSAGE));
    }

    /**
     * Gets a list of all webhooks in a room
     * @param {string} roomId the room ID to search in
     * @param {string} userId the user trying to view the room's webhooks
     * @param {string} hookId the webhook ID
     * @returns {Promise<*>} resolves when deleted
     */
    deleteWebhook(roomId, userId, hookId) {
        LogService.info("ProvisioningService", "Processing delete hook (" + hookId + ") request for " + roomId + " by " + userId);

        return this.hasPermission(userId, roomId)
            .then(async () => {
                const webhooks = await WebhookStore.listWebhooks(roomId);
                if (webhooks.length === 1 && webhooks[0].id === hookId) {
                    await this._intent.leave(roomId);
                }
                return WebhookStore.deleteWebhook(roomId, hookId)
            }, () => Promise.reject(this.PERMISSION_ERROR_MESSAGE));
    }

    /**
     * Checks to see if a user has permission to manage webhooks in a given room
     * @param {string} userId the user trying to manage webhooks
     * @param {string} roomId the room they are trying to manage webhooks in
     * @returns {Promise<*>} resolves if the user has permission, rejected otherwise
     */
    hasPermission(userId, roomId) {
        LogService.verbose("ProvisioningService", "Checking permission for " + userId + " in " + roomId);
        if (!this._intent) {
            LogService.warn("ProvisioningService", "Unable to check permission for " + userId + " in " + roomId + " because there is no Intent assigned to this service");
            return Promise.reject();
        }
        return this._intent.getClient().getStateEvent(roomId, "m.room.power_levels", "").then(powerLevels => {
            if (!powerLevels) {
                LogService.warn("ProvisioningService", "Unable to check permission for " + userId + " in " + roomId + " because there is no powerlevel information in the room");
                return Promise.reject();
            }

            const userPowerLevels = powerLevels['users'] || {};

            let powerLevel = userPowerLevels[userId];
            if (!powerLevel) powerLevel = powerLevels['users_default'];
            if (!powerLevel) powerLevel = 0; // default

            let statePowerLevel = powerLevels["state_default"];
            if (!statePowerLevel) {
                LogService.warn("ProvisioningService", "Unable to check permission for " + userId + " in " + roomId + " because the powerlevel requirement is missing for state_default");
                return Promise.reject();
            }

            const hasPermission = statePowerLevel <= powerLevel;

            LogService.verbose("ProvisioningService", "User " + userId + " in room " + roomId + " has permission? " + hasPermission + " (required powerlevel = " + statePowerLevel + ", user powerlevel = " + powerLevel + ")");

            return hasPermission ? Promise.resolve() : Promise.reject();
        });
    }
}

module.exports = new ProvisioningService();