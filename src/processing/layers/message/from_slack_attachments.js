const COLOR_MAP = {
    danger: "#d9534f",
    warning: "#f0ad4e",
    good: "#5cb85c",
};

module.exports = (webhook, matrix) => {
    if (!webhook.attachments) return;

    let combinedHtml = "";
    for (let attachment of webhook.attachments) {
        let color = "#f7f7f7";
        if (attachment.color) color = attachment.color;
        if (COLOR_MAP[attachment.color]) color = COLOR_MAP[attachment.color];

        // Pretext
        if (attachment.pretext) {
            combinedHtml += attachment.pretext + "<br/>";
        }

        // Start the attachment block
        combinedHtml += "<blockquote data-mx-border-color='" + color + "'>";

        // Process the author
        if (attachment.author_name) {
            combinedHtml += "<small>";
            if (attachment.author_icon) combinedHtml += "<img src='" + attachment.author_icon + "' height='16' width='16' />";
            if (attachment.author_link) combinedHtml += "<a href='" + attachment.author_link + "'>" + attachment.author_name + "</a>";
            else combinedHtml += attachment.author_name;
            combinedHtml += "</small><br/>";
        }

        // Title
        if (attachment.title) {
            combinedHtml += "<h4>";
            if (attachment.title_link) {
                combinedHtml += "<a href='" + attachment.title_link + "'>" + attachment.title + "</a>";
            } else combinedHtml += attachment.title;
            combinedHtml += "</h4>";
        }

        // Text
        if (attachment.text) {
            combinedHtml += attachment.text + "<br/>";
        }

        // Fields
        if (attachment.fields) {
            for (let field of attachment.fields) {
                combinedHtml += "<b>" + field.title + "</b><br/>" + field.value + "<br/>";
            }
        }

        // Image
        if (attachment.image) {
            combinedHtml += "<img src='" + attachment.image + "'><br/>";
        }
        // TODO: Support thumb_url

        // Footer
        if (attachment.footer) {
            combinedHtml += "<small>";
            if (attachment.footer_icon) combinedHtml += "<img src='" + attachment.footer_icon + "' height='16' width='16'>";
            combinedHtml += attachment.footer + "</small><br/>";
        }

        combinedHtml += "</blockquote>";
    }

    webhook.format = "html"; // to force the HTML layer to process it
    if (matrix.event.body) combinedHtml = matrix.event.body + combinedHtml;
    matrix.event.body = combinedHtml;
};
