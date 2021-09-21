const emojione = require("emojione");
const cheerio = require("cheerio");

emojione.emojiSize = '128';

module.exports = (webhook, matrix) => {
    if (!matrix.sender.avatar_url && webhook.icon_emoji) {
        // HACK: We really shouldn't have to do this element -> url conversion

        const imgElement = emojione.shortnameToImage(webhook.icon_emoji);
        if (imgElement == webhook.icon_emoji) return;

        const srcUrl = cheerio.load(imgElement).attr('src');
        matrix.sender.avatar_url = srcUrl;
    }
};
