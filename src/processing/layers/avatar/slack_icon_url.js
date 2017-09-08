module.exports = (webhook, matrix) => {
    if (!matrix.sender.avatarUrl && webhook.icon_url)
        matrix.sender.avatarUrl = webhook.icon_url;
};