var striptags = require("striptags");

module.exports = (webhook, matrix) => {
    if (webhook.format === "html") {
        matrix.event.format = "org.matrix.custom.html";
        matrix.event.formatted_body = matrix.event.body;
        matrix.event.body = striptags(matrix.event.formatted_body);
    }
};
