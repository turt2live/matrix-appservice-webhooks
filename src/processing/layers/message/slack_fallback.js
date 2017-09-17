module.exports = (webhook, matrix) => {
    if (!webhook.attachments) return;
    var text = "";
    text = webhook.attachments.map(a => { return a.fallback });
    // Fallback is required but let's remove additional newlines just in case
    text = text.join("\n").trim().replace(/\n{2,}/g, "\n");
    matrix.event.body = text;
};
