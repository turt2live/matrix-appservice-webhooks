module.exports = (webhook, matrix) => {
    if (!matrix.sender.displayName)
        matrix.sender.displayName = "Incoming Webhook";
};