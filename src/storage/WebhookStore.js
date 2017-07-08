var DBMigrate = require("db-migrate");
var LogService = require("./../LogService");
var Sequelize = require('sequelize');
var dbConfig = require("../../config/database.json");
var _ = require("lodash");

/**
 * Primary storage for the Webhook Bridge
 */
class WebhookStore {

    /**
     * Creates a new Instagram store. Call `prepare` before use.
     */
    constructor() {
        this._orm = null;
    }

    /**
     * Prepares the store for use
     */
    prepare() {
        var env = process.env.NODE_ENV || "development";
        LogService.info("WebhookStore", "Running migrations");
        return new Promise((resolve, reject)=> {
            var dbMigrate = DBMigrate.getInstance(true, {
                config: "./config/database.json",
                env: env
            });
            dbMigrate.internals.argv.count = undefined; // HACK: Fix db-migrate from using `config/config.yaml` as the count. See https://github.com/turt2live/matrix-appservice-instagram/issues/11
            dbMigrate.up().then(() => {
                var dbConfigEnv = dbConfig[env];
                if (!dbConfigEnv) throw new Error("Could not find DB config for " + env);

                var opts = {
                    host: dbConfigEnv.host || 'localhost',
                    dialect: 'sqlite',
                    storage: dbConfigEnv.filename,
                    pool: {
                        max: 5,
                        min: 0,
                        idle: 10000
                    },
                    logging: i => LogService.verbose("WebhookStore [SQL]", i)
                };

                this._orm = new Sequelize(dbConfigEnv.database || 'webhooks', dbConfigEnv.username, dbConfigEnv.password, opts);
                this._bindModels();
                resolve();
            }, err => {
                LogService.error("WebhookStore", err);
                reject(err);
            }).catch(err => {
                LogService.error("WebhookStore", err);
                reject(err);
            });
        });
    }

    /**
     * Binds all of the models to the ORM.
     * @private
     */
    _bindModels() {
        // Models
        this.__BotAccountData = this._orm.import(__dirname + "/models/bot_account_data");
    }

    /**
     * Gets the account data for the bridge bot
     * @returns {Promise<*>} a json object representing the key/value pairs
     */
    getBotAccountData() {
        return this.__BotAccountData.findAll().then(rows => {
            var container = {};
            for (var row of rows) {
                container[row.key] = row.value;
            }
            return container;
        });
    }

    /**
     * Saves the bridge bot's account data. Takes the value verbatim, expecting a string.
     * @param {*} data the data to save
     * @returns {Promise<>} resolves when complete
     */
    setBotAccountData(data) {
        return this.__BotAccountData.destroy({where: {}, truncate: true}).then(() => {
            var promises = [];

            var keys = _.keys(data);
            for (var key of keys) {
                promises.push(this.__BotAccountData.create({key: key, value: data[key]}));
            }

            return Promise.all(promises);
        });
    }
}

/**
 * Converts a database value to a millisecond timestamp
 * @param {*} val the value from the database
 * @return {number} a millisecond timestamp representing the date
 */
function timestamp(val) {
    if (typeof(val) === 'number') {
        return val;
    } else if (typeof(val) === 'string') {
        return new Date(val).getTime();
    } else if (!val || !val.getTime) {
        return new Date(0).getTime();
    } else return val;
}

/**
 * Converts a database value to a boolean
 * @param {*} val the value from the database
 * @return {boolean} the boolean
 */
function dbToBool(val) {
    return val === 1 || val === true;
}

module.exports = new WebhookStore();