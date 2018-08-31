module.exports = (webhook, matrix) => {
    // Reference: https://api.slack.com/docs/message-formatting#linking_to_urls
    // Slack also accepts e.g. <example.com|DISPLAY_STR> but that results in a relative path

    // Match <PROTOCOL://REST_OF_URL|DISPLAY_STR>
    const linkRegex = /<([a-zA-Z]+):\/\/([^|>]+?)\|([^|>]+?)>/g;
    // Match <PROTOCOL://REST_OF_URL>
    const linkRegex2 = /<([a-zA-Z]+):\/\/([^|>]+?)>/g;
    // Match <mailto:ADDRESS|DISPLAY_STR>
    const mailtoRegex = /<mailto:([^|>]+?)\|([^|>]+?)>/g;
    // Match <mailto:ADDRESS>
    const mailtoRegex2 = /<mailto:([^|>]+?)>/g;

    // Apply regex'es
    matrix.event.body = matrix.event.body.replace(linkRegex, "<a href='$1://$2'>$3</a>");
    matrix.event.body = matrix.event.body.replace(linkRegex2, "<a href='$1://$2'>$1://$2</a>");
    matrix.event.body = matrix.event.body.replace(mailtoRegex, "<a href='mailto:$1'>$2</a>");
    matrix.event.body = matrix.event.body.replace(mailtoRegex2, "<a href='mailto:$1'>mailto:$1</a>");

    // TODO: Put this somewhere else
    // Handle Slack Multiline Messages
    matrix.event.body = matrix.event.body.replace('\n', '<br>');
};
