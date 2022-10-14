module.exports = (webhook, matrix) => {
    if (!matrix.sender.avatar_url && webhook.icon_url)
        matrix.sender.avatar_url = webhook.icon_url;
};
