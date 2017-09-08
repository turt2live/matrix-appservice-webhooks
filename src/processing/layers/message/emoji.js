var emoji = require('node-emoji');

module.exports = (webhook, matrix) => {
    if (webhook.emoji !== false && matrix.event.body) {
        matrix.event.body = emoji.emojify(matrix.event.body, /*onMissing=*/null, /*format=*/null);
    }
};