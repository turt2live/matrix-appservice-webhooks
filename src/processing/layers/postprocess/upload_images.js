const cheerio = require("cheerio");
const util = require("../../../utils");
const WebhookBridge = require("../../../WebhookBridge");
const Promise = require("bluebird");

module.exports = (webhook, matrix) => {
    if (matrix.event.format !== "org.matrix.custom.html") return;

    const ev = cheerio.load(matrix.event.formatted_body);
    let images = ev("img");
    if (!images) return;

    const promises = [];
    images.each((i, elem) => {
        const image = ev(elem);

        let src = image.attr("src");
        if (!src || src.startsWith("mxc://")) return;

        promises.push(util.uploadContentFromUrl(WebhookBridge, src, WebhookBridge.getBotIntent()).then(mxc => {
            image.attr('src', mxc);
        }));
    });

    return Promise.all(promises).then(() => {
        matrix.event.formatted_body = ev("body").html();
    });
};

