var LogService = require("../src/LogService");
var _ = require('lodash');
var path = require("path");
var fs = require('fs');
var config = require("./config.json");
var sdk = require("matrix-js-sdk");
var Promise = require("bluebird");

LogService.init(config);
LogService.defaultModule("emoji_to_mxc");

LogService.info("Starting converter");
var icons = require("emojione-assets/emoji.json");

var pathsToShortnames = {}; // { filepath: [shortcodes] }
var basePath = path.join(path.dirname(require.resolve("emojione-assets")), "png", "128");
for (var codepoint of _.keys(icons)) {
    var icon = icons[codepoint];

    var validShortcodes = _.concat([icon.shortname], icon.shortname_alternates);
    var iconPath = path.join(basePath, icon.code_points.base + ".png");
    pathsToShortnames[iconPath] = validShortcodes;

    LogService.verbose("Found " + validShortcodes.length + " icons for " + iconPath);
}
LogService.info("Found " + _.keys(pathsToShortnames).length + " total icons to upload");

// Create a matrix client
var client = sdk.createClient({
    baseUrl: config.matrix.baseUrl,
    accessToken: config.matrix.accessToken,
    userId: config.matrix.userId
});

// Start uploading the icons
var resultJson = {}; // { shortcode: mxc }
var chain = Promise.resolve();
var paths = _.keys(pathsToShortnames);
var completed = 0;
_.map(paths, p => {
    chain = chain.then(() => {
        LogService.verbose("Uploading " + p);
        return client.uploadContent({
            stream: fs.readFileSync(p),
            name: path.basename(p),
        }, {rawResponse: false}).then(mxc => {
            mxc = mxc.content_uri;
            LogService.verbose("Got MXC: " + mxc);
            completed++;
            for (var shortcode of pathsToShortnames[p]) {
                resultJson[shortcode] = mxc;
            }
            LogService.info("Upload progress: " + completed +"/" + paths.length);
        });
    });
});

// Write the result
chain.then(() => {
    fs.writeFileSync("src/storage/data/emoji_mxc.json", JSON.stringify(resultJson, null, 4), "utf-8");
    LogService.info("Done!");
});