var winston = require("winston");
var chalk = require("chalk");
var fs = require('fs');
var moment = require('moment');

try {
    fs.mkdirSync('logs')
} catch (err) {
    if (err.code !== 'EEXIST') throw err
}

const TERM_COLORS = {
    error: "red",
    warn: "yellow",
    info: "blue",
    verbose: "white",
    silly: "grey",
};

function winstonColorFormatter(options) {
    options.level = chalk[TERM_COLORS[options.level]](options.level);
    return winstonFormatter(options);
}

function winstonFormatter(options) {
    return options.timestamp() + ' ' + options.level + ' ' + (options.message ? options.message : '') +
        (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '' );
}

function getTimestamp() {
    return moment().format('MMM-D-YYYY HH:mm:ss.SSS Z');
}

var log = null;

function doLog(level, module, messageOrObject) {
    if (typeof(messageOrObject) === 'object' && !(messageOrObject instanceof Error))
        messageOrObject = JSON.stringify(messageOrObject);

    if (messageOrObject instanceof Error) {
        var err = messageOrObject;
        messageOrObject = err.message + "\n" + err.stack;
    }

    var message = "[" + module + "] " + messageOrObject;
    log.log(level, message);
}

class LogService {
    static info(module, message) {
        doLog('info', module, message);
    }

    static warn(module, message) {
        doLog('warn', module, message);
    }

    static error(module, message) {
        doLog('error', module, message);
    }

    static verbose(module, message) {
        doLog('verbose', module, message);
    }

    static silly(module, message) {
        doLog('silly', module, message);
    }

    static init(config) {
        var transports = [];
        transports.push(new (winston.transports.File)({
            json: false,
            name: "file",
            filename: config.logging.file,
            timestamp: getTimestamp,
            formatter: winstonFormatter,
            level: config.logging.fileLevel,
            maxsize: config.logging.rotate.size,
            maxFiles: config.logging.rotate.count,
            zippedArchive: false
        }));

        if (config.logging.console) {
            transports.push(new (winston.transports.Console)({
                json: false,
                name: "console",
                timestamp: getTimestamp,
                formatter: winstonColorFormatter,
                level: config.logging.consoleLevel
            }));
        }

        log = new winston.Logger({
            transports: transports,
            levels: {
                error: 0,
                warn: 1,
                info: 2,
                verbose: 3,
                silly: 4
            }
        });
    }
}

module.exports = LogService;