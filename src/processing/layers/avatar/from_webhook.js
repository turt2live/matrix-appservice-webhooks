module.exports = (webhook, matrix) => {
    if (!matrix.sender.avatarUrl && webhook.avatarUrl)
        matrix.sender.avatarUrl = webhook.avatarUrl;
};