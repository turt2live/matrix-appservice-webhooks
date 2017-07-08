// File based on the following implementation of utils.js in matrix-appservice-twitter by Half-Shot:
// https://github.com/Half-Shot/matrix-appservice-twitter/blob/6fc01588e51a9eb9a32e14a6b0338abfd7cc32ea/src/util.js

var https = require('https');
var http = require('http');
var Buffer = require("buffer").Buffer;
var log = require('./LogService');
var mime = require('mime');
var parseDataUri = require("parse-data-uri");
var request = require('request');
var fs = require('fs');
var mkdirp = require('mkdirp');
var uuid = require("uuid");
var path = require('path');

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
    log.verbose("utils", "Downloading image from " + url);
    var contenttype;
    id = id || null;
    name = name || null;
    return new Promise((resolve, reject) => {

        var ht = url.startsWith("https") ? https : http;

        ht.get((url), (res) => {
            if (res.headers.hasOwnProperty("content-type")) {
                contenttype = res.headers["content-type"];
            } else {
                log.info("utils", "No content-type given by server, guessing based on file name.");
                contenttype = mime.lookup(url);
            }

            if (name == null) {
                name = url.split("/");
                name = name[name.length - 1];
            }
            var size = parseInt(res.headers["content-length"]);
            if (isNaN(size)) {
                log.warn("UploadContentFromUrl", "Content-length is not valid. Assuming 512kb size");
                size = 512 * 1024;
            }
            var buffer;
            if (Buffer.alloc) {//Since 5.10
                buffer = Buffer.alloc(size);
            } else {//Deprecated
                buffer = new Buffer(size);
            }

            var bsize = 0;
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
        if (typeof id == "string" || id == null) {
            id = bridge.getIntent(id);
        }
        return id.getClient().uploadContent({
            stream: buffer,
            name: name,
            type: contenttype
        });
    }).then((response) => {
        var content_uri = JSON.parse(response).content_uri;
        log.info("UploadContent", "Media uploaded to " + content_uri);
        return content_uri;
    }).catch(function (reason) {
        log.error("UploadContent", "Failed to upload content:\n" + reason)
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
    var parsed = parseDataUri(uri);
    return bridge.getIntent(id).getClient().uploadContent({
        stream: parsed.data,
        name: name,
        type: parsed.mimeType
    }).then(response=> {
        var content_uri = JSON.parse(response).content_uri;
        log.info("uploadContentFromDataUri", "Media uploaded to " + content_uri);
        return content_uri;
    }).catch(function (reason) {
        log.error("UploadContent", "Failed to upload content:\n" + reason)
    });
}

/**
 * Downloads a file from a web address to the file system
 * @param {string} uri the web resource to download
 * @param {string} path the filesystem path to download to
 * @returns {Promise<boolean>} resolves with true if successful, false otherwise
 */
function downloadFile(uri, path) {
    return new Promise((resolve, reject) => {
        var resolved = false;
        request(uri, (err, response, body) => {
            if (err) {
                resolved = true;
                resolve(false);
            }
        }).pipe(fs.createWriteStream(path)).on('close', () => {
            if (!resolved) resolve(true);
        });
    });
}

/**
 * Downloads a file from a web address to the file system
 * @param {string} uri the web resource to download
 * @param {string} [ext] optional extension for the filename
 * @returns {Promise<string>} resolves to the file path, or null if something went wrong
 */
function downloadFileTemp(uri, ext = '.data') {
    var root = "temp";
    var filename = uuid.v4() + ext;
    var fullpath = path.join(root, filename);

    mkdirp.sync(root);
    return downloadFile(uri, fullpath).then(created => created ? fullpath : null);
}

module.exports = {
    uploadContentFromUrl: uploadContentFromUrl,
    uploadContentFromDataUri: uploadContentFromDataUri,
    downloadFile: downloadFile,
    downloadFileTemp: downloadFileTemp,
};