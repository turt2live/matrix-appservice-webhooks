var emojione = require("emojione");
var cheerio = require("cheerio");

emojione.emojiSize = '128';

module.exports = (webhook, matrix) => {
    if (!matrix.sender.avatarUrl && webhook.icon_emoji) {
        // HACK: We really shouldn't have to do this element -> url conversion

        var imgElement = emojione.shortnameToImage(webhook.icon_emoji);
        if (imgElement == webhook.icon_emoji) return;

        var srcUrl = cheerio(imgElement).attr('src');
        matrix.sender.avatarUrl = srcUrl;
    }
};