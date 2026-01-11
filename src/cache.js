"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheTTL = exports.CacheKeys = exports.cache = void 0;
exports.withCache = withCache;
exports.batchAsync = batchAsync;
exports.parallelAsync = parallelAsync;
exports.startCacheCleanup = startCacheCleanup;
exports.stopCacheCleanup = stopCacheCleanup;
exports.getCacheStats = getCacheStats;
// In-memory cache for RPC results to speed up repeated scans
// Caches expire after a configurable TTL
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('Cache');
// Request deduplication - prevent duplicate in-flight requests
var inflightRequests = new Map();
var MemoryCache = /** @class */ (function () {
    function MemoryCache() {
        this.cache = new Map();
        this.maxSize = 5000; // Increased for better performance
        this.hits = 0;
        this.misses = 0;
    }
    // Set with TTL in seconds
    MemoryCache.prototype.set = function (key, data, ttlSeconds) {
        if (ttlSeconds === void 0) { ttlSeconds = 300; }
        // Evict oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            var firstKey = this.cache.keys().next().value;
            if (firstKey)
                this.cache.delete(firstKey);
        }
        this.cache.set(key, {
            data: data,
            expiry: Date.now() + (ttlSeconds * 1000),
        });
    };
    MemoryCache.prototype.get = function (key) {
        var entry = this.cache.get(key);
        if (!entry) {
            this.misses++;
            return null;
        }
        // Check if expired
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }
        // Track hit
        entry.hits = (entry.hits || 0) + 1;
        this.hits++;
        return entry.data;
    };
    MemoryCache.prototype.has = function (key) {
        return this.get(key) !== null;
    };
    MemoryCache.prototype.delete = function (key) {
        this.cache.delete(key);
    };
    MemoryCache.prototype.clear = function () {
        this.cache.clear();
    };
    // Get cache stats
    MemoryCache.prototype.stats = function () {
        var total = this.hits + this.misses;
        var hitRate = total > 0 ? (this.hits / total) * 100 : 0;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: Math.round(hitRate * 100) / 100
        };
    };
    // Clean expired entries (run periodically)
    MemoryCache.prototype.cleanExpired = function () {
        var now = Date.now();
        var cleaned = 0;
        for (var _i = 0, _a = this.cache.entries(); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], entry = _b[1];
            if (now > entry.expiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        return cleaned;
    };
    return MemoryCache;
}());
// Global cache instance
exports.cache = new MemoryCache();
// Cache key generators
exports.CacheKeys = {
    // Wallet data - short TTL as balances change
    walletSignatures: function (address) { return "sigs:".concat(address); },
    walletBalance: function (address) { return "bal:".concat(address); },
    // Transaction data - long TTL as transactions are immutable
    transaction: function (signature) { return "tx:".concat(signature); },
    // Deployer data - medium TTL
    deployerStatus: function (address) { return "deployer:".concat(address); },
    tokenAnalysis: function (mint) { return "token:".concat(mint); },
    // Security scan results - short TTL
    securityScan: function (address) { return "security:".concat(address); },
    rugCheck: function (address) { return "rug:".concat(address); },
    // Token info - long TTL as metadata rarely changes
    tokenInfo: function (mint) { return "info:".concat(mint); },
    tokenPrice: function (mint) { return "price:".concat(mint); },
};
// TTL values in seconds - optimized for performance
exports.CacheTTL = {
    VERY_SHORT: 30, // 30 seconds - for balance data
    SHORT: 300, // 5 minutes - for security scans
    MEDIUM: 1800, // 30 minutes - for deployer checks (increased)
    LONG: 7200, // 2 hours - for token metadata (increased)
    VERY_LONG: 86400, // 24 hours - for immutable data like transactions
};
// Helper to run with cache and request deduplication
function withCache(key, ttl, fetcher) {
    return __awaiter(this, void 0, void 0, function () {
        var cached, inflight, promise;
        var _this = this;
        return __generator(this, function (_a) {
            cached = exports.cache.get(key);
            if (cached !== null) {
                return [2 /*return*/, cached];
            }
            inflight = inflightRequests.get(key);
            if (inflight) {
                return [2 /*return*/, inflight];
            }
            promise = (function () { return __awaiter(_this, void 0, void 0, function () {
                var data;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, , 2, 3]);
                            return [4 /*yield*/, fetcher()];
                        case 1:
                            data = _a.sent();
                            exports.cache.set(key, data, ttl);
                            return [2 /*return*/, data];
                        case 2:
                            // Remove from in-flight tracking
                            inflightRequests.delete(key);
                            return [7 /*endfinally*/];
                        case 3: return [2 /*return*/];
                    }
                });
            }); })();
            inflightRequests.set(key, promise);
            return [2 /*return*/, promise];
        });
    });
}
// Batch helper - run multiple async operations with concurrency limit
function batchAsync(items_1, fn_1) {
    return __awaiter(this, arguments, void 0, function (items, fn, concurrency) {
        var results, i, batch, batchResults;
        if (concurrency === void 0) { concurrency = 5; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < items.length)) return [3 /*break*/, 4];
                    batch = items.slice(i, i + concurrency);
                    return [4 /*yield*/, Promise.all(batch.map(fn))];
                case 2:
                    batchResults = _a.sent();
                    results.push.apply(results, batchResults);
                    _a.label = 3;
                case 3:
                    i += concurrency;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}
// Parallel helper with error handling - run all and collect results
function parallelAsync(tasks_1) {
    return __awaiter(this, arguments, void 0, function (tasks, options) {
        var _a, concurrency, _b, onError, results, i, batch, batchPromises, batchResults, _i, batchResults_1, r;
        var _this = this;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = options.concurrency, concurrency = _a === void 0 ? 10 : _a, _b = options.onError, onError = _b === void 0 ? 'skip' : _b;
                    results = [];
                    i = 0;
                    _c.label = 1;
                case 1:
                    if (!(i < tasks.length)) return [3 /*break*/, 4];
                    batch = tasks.slice(i, i + concurrency);
                    batchPromises = batch.map(function (task) { return __awaiter(_this, void 0, void 0, function () {
                        var error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, task()];
                                case 1: return [2 /*return*/, _a.sent()];
                                case 2:
                                    error_1 = _a.sent();
                                    if (onError === 'throw')
                                        throw error_1;
                                    return [2 /*return*/, null];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(batchPromises)];
                case 2:
                    batchResults = _c.sent();
                    for (_i = 0, batchResults_1 = batchResults; _i < batchResults_1.length; _i++) {
                        r = batchResults_1[_i];
                        if (r !== null) {
                            results.push(r);
                        }
                    }
                    _c.label = 3;
                case 3:
                    i += concurrency;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}
// Periodic cache cleanup
var cleanupInterval = null;
function startCacheCleanup(intervalMs) {
    if (intervalMs === void 0) { intervalMs = 300000; }
    if (cleanupInterval)
        return;
    cleanupInterval = setInterval(function () {
        var cleaned = exports.cache.cleanExpired();
        if (cleaned > 0) {
            logger.info("\uD83E\uDDF9 Cache cleanup: removed ".concat(cleaned, " expired entries"));
        }
    }, intervalMs);
}
function stopCacheCleanup() {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}
// Get cache statistics
function getCacheStats() {
    return {
        cache: exports.cache.stats(),
        inflightRequests: inflightRequests.size
    };
}
