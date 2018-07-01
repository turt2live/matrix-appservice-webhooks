const emoji = require('node-emoji');

module.exports = (webhook, matrix) => {
    if (webhook.emoji !== false && matrix.sender.displayName) {
        matrix.sender.displayName = emoji.emojify(matrix.sender.displayName, /*onMissing=*/null, /*format=*/null);
    }
};