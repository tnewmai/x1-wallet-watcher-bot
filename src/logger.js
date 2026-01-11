"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
exports.createLogger = createLogger;
// Production-grade structured logging with Winston
var winston_1 = __importDefault(require("winston"));
// Define log levels
var levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define colors for each level
var colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
winston_1.default.addColors(colors);
// Define format for console output
var consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(function (info) { return "".concat(info.timestamp, " [").concat(info.level, "]: ").concat(info.message).concat(info.context ? " | ".concat(JSON.stringify(info.context)) : ''); }));
// Define format for file output
var fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// Get log level from environment variable directly (avoid circular dependency with config)
var getLogLevel = function () {
    return process.env.LOG_LEVEL || 'info';
};
// Ensure logs directory exists
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
// Create the logger instance with lazy log level resolution
var logger = winston_1.default.createLogger({
    level: getLogLevel(),
    levels: levels,
    format: fileFormat,
    defaultMeta: { service: 'x1-wallet-watcher-bot' },
    transports: [
        // Console output (colorized)
        new winston_1.default.transports.Console({
            format: consoleFormat,
        }),
        // Error log file
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Combined log file
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    // Handle uncaught exceptions and rejections
    exceptionHandlers: [
        new winston_1.default.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({ filename: 'logs/rejections.log' }),
    ],
});
// Logger helper class for structured logging
var Logger = /** @class */ (function () {
    function Logger(context) {
        this.context = context;
    }
    Logger.prototype.formatMessage = function (message, meta) {
        return {
            message: message,
            context: __assign({ module: this.context }, meta),
        };
    };
    Logger.prototype.error = function (message, error, meta) {
        if (error instanceof Error) {
            logger.error(message, __assign(__assign({}, this.formatMessage(message, meta)), { error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                } }));
        }
        else {
            logger.error(message, this.formatMessage(message, __assign(__assign({}, meta), { error: error })));
        }
    };
    Logger.prototype.warn = function (message, meta) {
        logger.warn(message, this.formatMessage(message, meta));
    };
    Logger.prototype.info = function (message, meta) {
        logger.info(message, this.formatMessage(message, meta));
    };
    Logger.prototype.http = function (message, meta) {
        logger.http(message, this.formatMessage(message, meta));
    };
    Logger.prototype.debug = function (message, meta) {
        logger.debug(message, this.formatMessage(message, meta));
    };
    // Convenience method for timing operations
    Logger.prototype.startTimer = function (operation) {
        var _this = this;
        var start = Date.now();
        return function () {
            var duration = Date.now() - start;
            _this.debug("".concat(operation, " completed"), { durationMs: duration });
        };
    };
    return Logger;
}());
exports.Logger = Logger;
// Create logger factory
function createLogger(context) {
    return new Logger(context);
}
// Export default logger instance
exports.default = logger;
