module.exports = (webhook, matrix) => {
    if (!matrix.sender.avatarUrl)
        matrix.sender.avatarUrl = webhook.icon_url;

    return Promise.resolve();
};