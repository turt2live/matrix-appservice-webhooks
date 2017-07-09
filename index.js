var LogService = require("./src/LogService");
var Cli = require("matrix-appservice-bridge").Cli;
var AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;
var path = require("path");
var WebhookStore = require("./src/storage/WebhookStore");
var WebhookBridge = require("./src/WebhookBridge");
var WebService = require("./src/WebService");

new Cli({
    registrationPath: "appservice-registration-webhooks.yaml",
    enableRegistration: true,
    enableLocalpart: true,
    bridgeConfig: {
        affectsRegistration: true,
        schema: path.join(__dirname, "config/schema.yml"),
        defaults: {
            homeserver: {
                url: "http://localhost:8008",
                mediaUrl: "http://localhost:8008",
                domain: "localhost"
            },
            webhookBot: {
                appearance: {
                    displayName: "Webhook Bridge",
                    avatarUrl: "http://i.imgur.com/IDOBtEJ.png" // webhook bridge icon
                }
            },
            web: {
                bind: "0.0.0.0",
                port: 4501
            },
            logging: {
                file: "logs/webhook.log",
                console: true,
                consoleLevel: 'info',
                fileLevel: 'verbose',
                rotate: {
                    size: 52428800,
                    count: 5
                }
            }
        }
    },
    generateRegistration: function (registration, callback) {
        registration.setId(AppServiceRegistration.generateToken());
        registration.setHomeserverToken(AppServiceRegistration.generateToken());
        registration.setAppServiceToken(AppServiceRegistration.generateToken());
        registration.setRateLimited(false); // disabled because Instagram can get spammy

        if (!registration.getSenderLocalpart()) {
            registration.setSenderLocalpart("_webhook");
        }

        registration.addRegexPattern("users", "@_webhook.*", true);
        registration.addRegexPattern("aliases", "#_webhook.*", true);

        callback(registration);
    },
    run: function (port, config, registration) {
        LogService.init(config);
        LogService.info("index", "Preparing database...");
        WebhookStore.prepare()
            .then(() => {
                LogService.info("index", "Preparing bridge...");
                var bridge = new WebhookBridge(config, registration);
                return bridge.run(port);
            })
            .then(() => WebService.start(config.web.bind, config.web.port))
            .catch(err => {
                LogService.error("Init", "Failed to start bridge");
                throw err;
            });
    }
}).run();