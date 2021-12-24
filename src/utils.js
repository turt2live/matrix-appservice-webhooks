// File based on the following implementation of utils.js in matrix-appservice-twitter by Half-Shot:
// https://github.com/Half-Shot/matrix-appservice-twitter/blob/6fc01588e51a9eb9a32e14a6b0338abfd7cc32ea/src/util.js

const https = require('https');
const http = require('http');
const Buffer = require("buffer").Buffer;
const mime = require('mime');
const parseDataUri = require("parse-data-uri");
const LogService = require("matrix-js-snippets").LogService;

/**
 Utility module for regularly used functions.
 */

/**
 * uploadContentFromUrl - Upload content from a given URL to the homeserver
 * and return a MXC URL.
 *
 * @param  {Bridge} bridge the bridge object of this application
 * @param  {string} url the URL to be downloaded from.
 * @param  {string|Intent} [id] either the ID of the uploader, or a Intent object - optional.
 * @param  {string} [name] name of the file. Will use the URL filename otherwise - optional.
 * @return {Promise<string>} Promise resolving with a MXC URL.
 */
function uploadContentFromUrl(bridge, url, id, name) {
    LogService.verbose("utils", "Downloading image from " + url);
    let contenttype;
    id = id || null;
    name = name || null;
    return new Promise((resolve, reject) => {

        const ht = url.startsWith("https") ? https : http;

        ht.get((url), (res) => {
            if (res.headers.hasOwnProperty("content-type")) {
                contenttype = res.headers["content-type"];
            } else {
                LogService.info("utils", "No content-type given by server, guessing based on file name.");
                contenttype = mime.getType(url);
            }

            if (name == null) {
                const parts = url.split("/");
                name = parts[parts.length - 1];
            }
            let size = parseInt(res.headers["content-length"]);
            if (isNaN(size)) {
                LogService.warn("UploadContentFromUrl", "Content-length is not valid. Assuming 512kb size");
                size = 512 * 1024;
            }
            let buffer;
            if (Buffer.alloc) {//Since 5.10
                buffer = Buffer.alloc(size);
            } else {//Deprecated
                buffer = new Buffer(size);
            }

            let bsize = 0;
            res.on('data', (d) => {
                d.copy(buffer, bsize);
                bsize += d.length;
            });
            res.on('error', () => {
                reject("Failed to download.");
            });
            res.on('end', () => {
                resolve(buffer);
            });
        })
    }).then((buffer) => {
        if (typeof id === "string" || id == null) {
            id = bridge.getIntent(id);
        }
        return id.getClient().uploadContent({
            stream: buffer,
            name: name,
            type: contenttype
        });
    }).then((response) => {
        const content_uri = JSON.parse(response).content_uri;
        LogService.info("UploadContent", "Media uploaded to " + content_uri);
        return content_uri;
    }).catch(function (reason) {
        LogService.error("UploadContent", "Failed to upload content:\n" + reason)
    });
}

/**
 * Uploads the content contained in a data uri string to the homeserver
 *
 * @param  {Bridge} bridge the bridge object of this application
 * @param  {string} uri the data URI to upload
 * @param  {string} id either the ID of the uploader
 * @param  {string} [name] name of the file. Defaults to 'file'.
 * @return {Promise<string>} Promise resolving with a MXC URL.
 */
function uploadContentFromDataUri(bridge, id, uri, name) {
    if (!name || typeof(name) !== "string") name = "file";
    const parsed = parseDataUri(uri);
    return bridge.getIntent(id).getClient().uploadContent({
        stream: parsed.data,
        name: name,
        type: parsed.mimeType
    }).then(response=> {
        const content_uri = JSON.parse(response).content_uri;
        LogService.info("uploadContentFromDataUri", "Media uploaded to " + content_uri);
        return content_uri;
    }).catch(function (reason) {
        LogService.error("UploadContent", "Failed to upload content:\n" + reason)
    });
}

module.exports = {
    uploadContentFromUrl: uploadContentFromUrl,
    uploadContentFromDataUri: uploadContentFromDataUri,
};
