module.exports = (webhook, matrix) => {
    if (webhook.msgtype == 'notice' || webhook.msgtype == 'emote')
        matrix.event.msgtype = "m." + webhook.msgtype;
};
