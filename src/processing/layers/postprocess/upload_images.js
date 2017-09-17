var cheerio = require("cheerio");
var util = require("../../../utils");
var WebhookBridge = require("../../../WebhookBridge");
var Promise = require("bluebird");

module.exports = (webhook, matrix) => {
    if (matrix.event.format !== "org.matrix.custom.html") return;

    var ev = cheerio.load(matrix.event.formatted_body);
    var images = ev("img");
    if (!images) return;

    var promises = [];
    images.each((i, elem) => {
        var image = ev(elem);

        var src = image.attr("src");
        if (!src || src.startsWith("mxc://")) return;

        promises.push(util.uploadContentFromUrl(WebhookBridge, src, WebhookBridge.getBotIntent()).then(mxc => {
            image.attr('src', mxc);
        }));
    });

    return Promise.all(promises).then(() => {
        matrix.event.formatted_body = ev("body").html();
    });
};

