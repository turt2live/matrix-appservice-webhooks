var Promise = require("bluebird");
var emoji = require('node-emoji');

module.exports = (webhook, matrix) => {
    if (webhook.emoji !== false) {
        matrix.event.body = emoji.emojify(matrix.event.body, /*onMissing=*/null);
        matrix.sender.displayName = emoji.emojify(matrix.sender.displayName, /*onMissing=*/null);
    }

    return Promise.resolve();
};