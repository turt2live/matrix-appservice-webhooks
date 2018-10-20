module.exports = (webhook, matrix) => {
    // Reference: https://api.slack.com/docs/message-formatting#linking_to_urls
    // Slack also accepts e.g. <example.com|DISPLAY_STR> but that results in a relative path

    const linkRegex = /<([a-zA-Z]+):\/\/([^|>]+?)\|([^|>]+?)>/g; // Match <PROTOCOL://REST_OF_URL|DISPLAY_STR>
    const linkRegex2 = /<([a-zA-Z]+):\/\/([^|>]+?)>/g; // Match <PROTOCOL://REST_OF_URL>
    const mailtoRegex = /<mailto:([^|>]+?)\|([^|>]+?)>/g; // Match <mailto:ADDRESS|DISPLAY_STR>
    const mailtoRegex2 = /<mailto:([^|>]+?)>/g; // Match <mailto:ADDRESS>

    // Apply regex'es
    const before = matrix.event.body;
    matrix.event.body = matrix.event.body.replace(linkRegex, "<a href='$1://$2'>$3</a>");
    matrix.event.body = matrix.event.body.replace(linkRegex2, "<a href='$1://$2'>$1://$2</a>");
    matrix.event.body = matrix.event.body.replace(mailtoRegex, "<a href='mailto:$1'>$2</a>");
    matrix.event.body = matrix.event.body.replace(mailtoRegex2, "<a href='mailto:$1'>mailto:$1</a>");

    if (before !== matrix.event.body) {
        webhook.format = "html"; // to force the HTML layer to process it
    }
};
