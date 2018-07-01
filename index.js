const LogService = require("matrix-js-snippets").LogService;
const Cli = require("matrix-appservice-bridge").Cli;
const AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;
const path = require("path");
const WebhookStore = require("./src/storage/WebhookStore");
const WebhookBridge = require("./src/WebhookBridge");
const WebService = require("./src/WebService");

const cli = new Cli({
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
                localpart: "_webhook",
                appearance: {
                    displayName: "Webhook Bridge",
                    avatarUrl: "http://i.imgur.com/IDOBtEJ.png" // webhook bridge icon
                }
            },
            web: {
                hookUrlBase: 'http://localhost:9000',
            },
            provisioning: {
                secret: 'CHANGE_ME'
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
        registration.setRateLimited(false); // disabled because webhooks can get spammy

        if (!registration.getSenderLocalpart()) {
            const config = cli.getConfig();
            registration.setSenderLocalpart(config.webhookBot.localpart);
        }

        registration.addRegexPattern("users", "@_webhook.*", true);

        callback(registration);
    },
    run: function (port, config, registration) {
        LogService.configure(config.logging);
        LogService.info("index", "Preparing database...");
        let bridge = null;
        WebhookStore.prepare()
            .then(() => {
                LogService.info("index", "Preparing bridge...");
                bridge = WebhookBridge.init(config, registration);
                return WebhookBridge.run(port);
            })
            .then(() => {
                if (config.provisioning.secret !== "CHANGE_ME") WebService.setSharedToken(config.provisioning.secret);
                else LogService.warn("index", "No provisioning API token is set - the provisioning API will not work for this bridge");

                WebService.setApp(bridge.appService.app);
                return WebService.start(config.web.hookUrlBase);
            })
            .catch(err => {
                LogService.error("Init", "Failed to start bridge");
                throw err;
            });
    }
});
cli.run();
