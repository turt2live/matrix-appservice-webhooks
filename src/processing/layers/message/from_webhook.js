module.exports = (webhook, matrix) => {
    if (!matrix.event.body)
        matrix.event.body = webhook.text;

    return Promise.resolve();
};