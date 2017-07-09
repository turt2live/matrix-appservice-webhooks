var express = require("express");
var bodyParser = require("body-parser");
var LogService = require("./LogService");
var PubSub = require('pubsub-js');
var WebhookStore = require("./storage/WebhookStore");

class WebService {
    constructor() {
        this._app = express();
        this._app.use(bodyParser.json());

        // Logging incoming requests
        this._app.use((req, res, next) => {
            LogService.verbose("WebService", "Incoming: " + req.method + " " + req.url);
            next();
        });

        this._app.post("/api/v1/matrix/hook/:hookId", this._postWebhook.bind(this));
    }

    _postWebhook(request, response) {
        response.setHeader("Content-Type", "application/json");

        var hookInfo = request.body;
        if (!hookInfo || !hookInfo["text"]) {
            LogService.error("WebService [Hook " + request.params.hookId + "]", "Invalid message: missing text");
            response.status(400).send({error: 'Missing message text', success: false});
            return;
        }

        WebhookStore.getWebhook(request.params.hookId).then(hook => {
            if (!hook) {
                LogService.error("WebService [Hook " + request.params.hookId + "]", "Invalid hook ID");
                response.status(400).send({error: 'Invalid hook ID', success: false});
                return;
            }

            LogService.info("WebService [Hook " + request.params.hookId + "]", "Publishing webhook request for processing");
            PubSub.publish("incoming_webhook", {
                hookId: request.params.hookId,
                hook: hook,
                payload: hookInfo
            });
            response.status(200).send({success: true, queued: true});
        }).catch(error => {
            LogService.error("WebService [Hook " + request.params.hookId + "]", error);
            response.status(500).send({error: 'Unknown error processing webhook', success: false});
        });
    }

    start(bindAddress, port, baseAddress) {
        this._baseAddress = baseAddress;
        this._app.listen(port, bindAddress);
        LogService.info("WebService", "API now listening on " + bindAddress + ":" + port);
    }

    getHookUrl(hookId) {
        if (this._baseAddress.endsWith("/"))
            this._baseAddress = this._baseAddress.substring(0, this._baseAddress.length - 1);
        return this._baseAddress + "/api/v1/matrix/hook/" + hookId;
    }
}

module.exports = new WebService();