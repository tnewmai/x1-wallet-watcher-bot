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
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoring = void 0;
var config_1 = require("./config");
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('Monitoring');
var MonitoringService = /** @class */ (function () {
    function MonitoringService() {
        this.logInterval = null;
        this.startTime = new Date();
        this.lastLogTime = new Date();
        this.metrics = {
            rpcCalls: {
                total: 0,
                successful: 0,
                failed: 0,
                rateLimited: 0,
                timeouts: 0,
            },
            watcherCycles: {
                total: 0,
                successful: 0,
                failed: 0,
                averageDuration: 0,
                lastDuration: 0,
            },
            securityScans: {
                total: 0,
                cached: 0,
                successful: 0,
                failed: 0,
                averageDuration: 0,
            },
            notifications: {
                sent: 0,
                failed: 0,
            },
            systemHealth: {
                lastHeartbeat: new Date(),
                uptime: 0,
                memoryUsage: process.memoryUsage(),
                isHealthy: true,
                errors: [],
            },
        };
    }
    // Start periodic logging
    MonitoringService.prototype.startPeriodicLogging = function (intervalMs) {
        var _this = this;
        if (intervalMs === void 0) { intervalMs = 60000; }
        if (!config_1.config.enablePerformanceMetrics)
            return;
        this.logInterval = setInterval(function () {
            _this.logMetricsSummary();
            _this.lastLogTime = new Date();
        }, intervalMs);
    };
    MonitoringService.prototype.stopPeriodicLogging = function () {
        if (this.logInterval) {
            clearInterval(this.logInterval);
            this.logInterval = null;
        }
    };
    // RPC call tracking
    MonitoringService.prototype.recordRpcCall = function (type) {
        if (!config_1.config.enableRpcMetrics)
            return;
        this.metrics.rpcCalls.total++;
        switch (type) {
            case 'success':
                this.metrics.rpcCalls.successful++;
                break;
            case 'failure':
                this.metrics.rpcCalls.failed++;
                break;
            case 'rateLimit':
                this.metrics.rpcCalls.rateLimited++;
                break;
            case 'timeout':
                this.metrics.rpcCalls.timeouts++;
                break;
        }
    };
    // Watcher cycle tracking
    MonitoringService.prototype.recordWatcherCycle = function (durationMs, success) {
        this.metrics.watcherCycles.total++;
        this.metrics.watcherCycles.lastDuration = durationMs;
        if (success) {
            this.metrics.watcherCycles.successful++;
        }
        else {
            this.metrics.watcherCycles.failed++;
        }
        // Update running average
        var totalDuration = this.metrics.watcherCycles.averageDuration * (this.metrics.watcherCycles.total - 1) + durationMs;
        this.metrics.watcherCycles.averageDuration = totalDuration / this.metrics.watcherCycles.total;
    };
    // Security scan tracking
    MonitoringService.prototype.recordSecurityScan = function (durationMs, cached, success) {
        this.metrics.securityScans.total++;
        if (cached) {
            this.metrics.securityScans.cached++;
        }
        if (success) {
            this.metrics.securityScans.successful++;
        }
        else {
            this.metrics.securityScans.failed++;
        }
        // Update running average (only for non-cached scans)
        if (!cached) {
            var totalDuration = this.metrics.securityScans.averageDuration * (this.metrics.securityScans.total - this.metrics.securityScans.cached - 1) + durationMs;
            var scanCount = this.metrics.securityScans.total - this.metrics.securityScans.cached;
            this.metrics.securityScans.averageDuration = scanCount > 0 ? totalDuration / scanCount : 0;
        }
    };
    // Notification tracking
    MonitoringService.prototype.recordNotification = function (success) {
        if (success) {
            this.metrics.notifications.sent++;
        }
        else {
            this.metrics.notifications.failed++;
        }
    };
    // System health tracking
    MonitoringService.prototype.updateSystemHealth = function (isHealthy, error) {
        this.metrics.systemHealth.lastHeartbeat = new Date();
        this.metrics.systemHealth.uptime = Date.now() - this.startTime.getTime();
        this.metrics.systemHealth.memoryUsage = process.memoryUsage();
        this.metrics.systemHealth.isHealthy = isHealthy;
        if (error) {
            this.metrics.systemHealth.errors.push(error);
            // Keep only last 10 errors
            if (this.metrics.systemHealth.errors.length > 10) {
                this.metrics.systemHealth.errors.shift();
            }
        }
    };
    // Get current metrics
    MonitoringService.prototype.getMetrics = function () {
        return __assign({}, this.metrics);
    };
    // Get health status
    MonitoringService.prototype.getHealthStatus = function () {
        var uptimeMs = Date.now() - this.startTime.getTime();
        var memoryMB = this.metrics.systemHealth.memoryUsage.heapUsed / 1024 / 1024;
        var rpcSuccessRate = this.metrics.rpcCalls.total > 0
            ? this.metrics.rpcCalls.successful / this.metrics.rpcCalls.total
            : 1;
        var watcherSuccessRate = this.metrics.watcherCycles.total > 0
            ? this.metrics.watcherCycles.successful / this.metrics.watcherCycles.total
            : 1;
        var checks = {
            rpcAvailability: rpcSuccessRate > 0.5, // At least 50% success rate
            watcherActive: Date.now() - this.metrics.systemHealth.lastHeartbeat.getTime() < 120000, // Active within 2 min
            memoryOk: memoryMB < 200, // Less than 200MB
            errorRate: 1 - watcherSuccessRate,
        };
        var status = 'healthy';
        if (!checks.rpcAvailability || !checks.watcherActive) {
            status = 'unhealthy';
        }
        else if (!checks.memoryOk || checks.errorRate > 0.2) {
            status = 'degraded';
        }
        return {
            status: status,
            uptime: uptimeMs,
            checks: checks,
        };
    };
    // Log metrics summary
    MonitoringService.prototype.logMetricsSummary = function () {
        var health = this.getHealthStatus();
        var rpcSuccessRate = this.metrics.rpcCalls.total > 0
            ? ((this.metrics.rpcCalls.successful / this.metrics.rpcCalls.total) * 100).toFixed(1)
            : '100.0';
        logger.info('\n📊 === MONITORING SUMMARY ===');
        logger.info("\u23F1\uFE0F  Uptime: ".concat(this.formatUptime(health.uptime)));
        logger.info("\uD83D\uDC9A Status: ".concat(health.status.toUpperCase()));
        logger.info("\n\uD83D\uDD0C RPC Calls:");
        logger.info("   Total: ".concat(this.metrics.rpcCalls.total));
        logger.info("   Success Rate: ".concat(rpcSuccessRate, "%"));
        logger.info("   Rate Limited: ".concat(this.metrics.rpcCalls.rateLimited));
        logger.info("   Timeouts: ".concat(this.metrics.rpcCalls.timeouts));
        logger.info("\n\uD83D\uDC40 Watcher Cycles:");
        logger.info("   Total: ".concat(this.metrics.watcherCycles.total));
        logger.info("   Success Rate: ".concat(this.metrics.watcherCycles.total > 0 ? ((this.metrics.watcherCycles.successful / this.metrics.watcherCycles.total) * 100).toFixed(1) : '100.0', "%"));
        logger.info("   Avg Duration: ".concat(this.metrics.watcherCycles.averageDuration.toFixed(0), "ms"));
        logger.info("   Last Duration: ".concat(this.metrics.watcherCycles.lastDuration, "ms"));
        logger.info("\n\uD83D\uDEE1\uFE0F  Security Scans:");
        logger.info("   Total: ".concat(this.metrics.securityScans.total));
        logger.info("   Cached: ".concat(this.metrics.securityScans.cached, " (").concat(this.metrics.securityScans.total > 0 ? ((this.metrics.securityScans.cached / this.metrics.securityScans.total) * 100).toFixed(0) : '0', "%)"));
        logger.info("   Avg Duration: ".concat(this.metrics.securityScans.averageDuration.toFixed(0), "ms"));
        logger.info("\n\uD83D\uDCEC Notifications:");
        logger.info("   Sent: ".concat(this.metrics.notifications.sent));
        logger.info("   Failed: ".concat(this.metrics.notifications.failed));
        logger.info("\n\uD83D\uDCBE Memory:");
        logger.info("   Heap Used: ".concat((this.metrics.systemHealth.memoryUsage.heapUsed / 1024 / 1024).toFixed(1), "MB"));
        logger.info("   RSS: ".concat((this.metrics.systemHealth.memoryUsage.rss / 1024 / 1024).toFixed(1), "MB"));
        logger.info('='.repeat(30) + '\n');
    };
    MonitoringService.prototype.formatUptime = function (ms) {
        var seconds = Math.floor(ms / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);
        if (days > 0)
            return "".concat(days, "d ").concat(hours % 24, "h");
        if (hours > 0)
            return "".concat(hours, "h ").concat(minutes % 60, "m");
        if (minutes > 0)
            return "".concat(minutes, "m ").concat(seconds % 60, "s");
        return "".concat(seconds, "s");
    };
    // Reset metrics (useful for testing)
    MonitoringService.prototype.reset = function () {
        this.metrics.rpcCalls = { total: 0, successful: 0, failed: 0, rateLimited: 0, timeouts: 0 };
        this.metrics.watcherCycles = { total: 0, successful: 0, failed: 0, averageDuration: 0, lastDuration: 0 };
        this.metrics.securityScans = { total: 0, cached: 0, successful: 0, failed: 0, averageDuration: 0 };
        this.metrics.notifications = { sent: 0, failed: 0 };
    };
    return MonitoringService;
}());
// Singleton instance
exports.monitoring = new MonitoringService();
