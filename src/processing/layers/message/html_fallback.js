var striptags = require("striptags");

module.exports = (webhook, matrix) => {
    if (webhook.format === "html" && webhook.fallback) {
        matrix.event.body = webhook.fallback;
    }
};
