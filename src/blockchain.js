"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.getConnection = getConnection;
exports.resetConnection = resetConnection;
exports.isValidAddress = isValidAddress;
exports.getChecksumAddress = getChecksumAddress;
exports.getBalance = getBalance;
exports.getTransactionCount = getTransactionCount;
exports.getRecentTransactions = getRecentTransactions;
exports.getCurrentBlockNumber = getCurrentBlockNumber;
exports.getLatestSignatures = getLatestSignatures;
exports.getWalletActivityStatsFast = getWalletActivityStatsFast;
exports.getWalletActivityStats = getWalletActivityStats;
exports.getQuickTransactionCount = getQuickTransactionCount;
exports.formatValue = formatValue;
exports.getTxExplorerUrl = getTxExplorerUrl;
exports.getAddressExplorerUrl = getAddressExplorerUrl;
exports.isConnected = isConnected;
exports.getTokenInfo = getTokenInfo;
exports.getTokenBalance = getTokenBalance;
exports.getAllTokenAccounts = getAllTokenAccounts;
exports.formatTokenBalance = formatTokenBalance;
exports.isValidTokenContract = isValidTokenContract;
exports.getTokenExplorerUrl = getTokenExplorerUrl;
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var umi_bundle_defaults_1 = require("@metaplex-foundation/umi-bundle-defaults");
var mpl_token_metadata_1 = require("@metaplex-foundation/mpl-token-metadata");
var umi_1 = require("@metaplex-foundation/umi");
var config_1 = require("./config");
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('Blockchain');
// X1 connection pool (SVM-based) for better concurrency
var CONNECTION_POOL_SIZE = 3;
var connectionPool = [];
var currentConnectionIndex = 0;
var connectionAttempts = 0;
var lastConnectionAttempt = 0;
var CONNECTION_RETRY_DELAY = 5000; // 5 seconds between reconnection attempts
// Circuit breaker state
var circuitBreakerOpen = false;
var circuitBreakerOpenUntil = 0;
var CIRCUIT_BREAKER_THRESHOLD = 10; // Open after 10 consecutive failures
var CIRCUIT_BREAKER_TIMEOUT = 30000; // 30 seconds
// Error tracking (must be declared before getConnection)
var consecutiveErrors = 0;
var MAX_CONSECUTIVE_ERRORS = 5;
// Initialize connection pool
function initializeConnectionPool() {
    if (connectionPool.length === 0) {
        logger.info("Initializing RPC connection pool (".concat(CONNECTION_POOL_SIZE, " connections)..."));
        for (var i = 0; i < CONNECTION_POOL_SIZE; i++) {
            connectionPool.push(new web3_js_1.Connection(config_1.config.x1RpcUrl, {
                commitment: 'confirmed',
                disableRetryOnRateLimit: true,
                confirmTransactionInitialTimeout: 30000,
                wsEndpoint: undefined, // Disable WebSocket for stability
                // Remove problematic keep-alive headers that cause RPC errors
                httpHeaders: undefined,
                fetch: undefined, // Use native fetch
                fetchMiddleware: undefined
            }));
        }
        logger.info("Connection pool initialized with ".concat(CONNECTION_POOL_SIZE, " connections"));
    }
}
function getConnection() {
    var now = Date.now();
    // Check circuit breaker
    if (circuitBreakerOpen) {
        if (now < circuitBreakerOpenUntil) {
            logger.warn('Circuit breaker is open, using fallback connection');
            // Return a temporary lightweight connection
            return new web3_js_1.Connection(config_1.config.x1RpcUrl, {
                commitment: 'confirmed',
                disableRetryOnRateLimit: true,
                confirmTransactionInitialTimeout: 15000,
            });
        }
        else {
            // Try to close circuit breaker
            logger.info('Attempting to close circuit breaker...');
            circuitBreakerOpen = false;
            consecutiveErrors = 0;
        }
    }
    // Initialize pool if needed
    initializeConnectionPool();
    // Rate limit reconnection attempts
    if (connectionAttempts > 0 && now - lastConnectionAttempt < CONNECTION_RETRY_DELAY) {
        // Return existing connection from pool
        return connectionPool[currentConnectionIndex % CONNECTION_POOL_SIZE];
    }
    // Round-robin connection selection for load distribution
    currentConnectionIndex = (currentConnectionIndex + 1) % CONNECTION_POOL_SIZE;
    return connectionPool[currentConnectionIndex];
}
// Reset connection pool (useful after prolonged errors)
function resetConnection() {
    connectionPool.length = 0;
    currentConnectionIndex = 0;
    connectionAttempts = 0;
    circuitBreakerOpen = false;
    logger.info('RPC connection pool reset');
    // Reinitialize on next use
}
// Open circuit breaker (stops making requests for a period)
function openCircuitBreaker() {
    circuitBreakerOpen = true;
    circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_TIMEOUT;
    logger.error("Circuit breaker OPENED (will retry after ".concat(CIRCUIT_BREAKER_TIMEOUT / 1000, "s)"));
}
// Wrapper to handle 429 rate limit errors gracefully with retry logic
// Instead of retrying indefinitely, we fail fast and let the next polling cycle retry
function safeRpcCall(fn_1, defaultValue_1) {
    return __awaiter(this, arguments, void 0, function (fn, defaultValue, operation) {
        var result, monitoring, e_1, error_1, monitoring, e_2, monitoring, e_3, monitoring, e_4, monitoring, e_5;
        var _a, _b, _c, _d, _e, _f;
        if (operation === void 0) { operation = 'RPC call'; }
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _g.trys.push([0, 6, , 26]);
                    return [4 /*yield*/, fn()];
                case 1:
                    result = _g.sent();
                    // Reset error counter on success
                    consecutiveErrors = 0;
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                case 3:
                    monitoring = (_g.sent()).monitoring;
                    monitoring.recordRpcCall('success');
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _g.sent();
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, result];
                case 6:
                    error_1 = _g.sent();
                    consecutiveErrors++;
                    // If too many consecutive errors, open circuit breaker
                    if (consecutiveErrors >= CIRCUIT_BREAKER_THRESHOLD) {
                        logger.error("".concat(consecutiveErrors, " consecutive RPC errors, opening circuit breaker..."), undefined, { consecutiveErrors: consecutiveErrors });
                        openCircuitBreaker();
                        resetConnection();
                        consecutiveErrors = 0;
                    }
                    else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                        logger.warn("".concat(consecutiveErrors, " consecutive RPC errors, resetting connection..."), { consecutiveErrors: consecutiveErrors });
                        resetConnection();
                    }
                    if (!(((_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _a === void 0 ? void 0 : _a.includes('429')) || ((_b = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _b === void 0 ? void 0 : _b.includes('Too Many Requests')))) return [3 /*break*/, 11];
                    logger.warn("Rate limit hit during ".concat(operation, ", returning default value. Will retry next cycle."), { operation: operation });
                    _g.label = 7;
                case 7:
                    _g.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                case 8:
                    monitoring = (_g.sent()).monitoring;
                    monitoring.recordRpcCall('rateLimit');
                    return [3 /*break*/, 10];
                case 9:
                    e_2 = _g.sent();
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/, defaultValue];
                case 11:
                    if (!(((_c = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _c === void 0 ? void 0 : _c.includes('timeout')) || (error_1 === null || error_1 === void 0 ? void 0 : error_1.code) === 'ETIMEDOUT')) return [3 /*break*/, 16];
                    logger.warn("Timeout during ".concat(operation), { operation: operation });
                    _g.label = 12;
                case 12:
                    _g.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                case 13:
                    monitoring = (_g.sent()).monitoring;
                    monitoring.recordRpcCall('timeout');
                    return [3 /*break*/, 15];
                case 14:
                    e_3 = _g.sent();
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/, defaultValue];
                case 16:
                    if (!(((_d = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _d === void 0 ? void 0 : _d.includes('ECONNREFUSED')) || ((_e = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _e === void 0 ? void 0 : _e.includes('ENOTFOUND')) ||
                        ((_f = error_1 === null || error_1 === void 0 ? void 0 : error_1.message) === null || _f === void 0 ? void 0 : _f.includes('ECONNRESET')) || (error_1 === null || error_1 === void 0 ? void 0 : error_1.code) === 'ECONNABORTED')) return [3 /*break*/, 21];
                    logger.warn("Connection error during ".concat(operation, ", may need to reconnect"), { operation: operation });
                    resetConnection();
                    _g.label = 17;
                case 17:
                    _g.trys.push([17, 19, , 20]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                case 18:
                    monitoring = (_g.sent()).monitoring;
                    monitoring.recordRpcCall('failure');
                    return [3 /*break*/, 20];
                case 19:
                    e_4 = _g.sent();
                    return [3 /*break*/, 20];
                case 20: return [2 /*return*/, defaultValue];
                case 21:
                    // For other errors, log and return default
                    logger.error("Error during ".concat(operation), error_1, { operation: operation });
                    _g.label = 22;
                case 22:
                    _g.trys.push([22, 24, , 25]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                case 23:
                    monitoring = (_g.sent()).monitoring;
                    monitoring.recordRpcCall('failure');
                    return [3 /*break*/, 25];
                case 24:
                    e_5 = _g.sent();
                    return [3 /*break*/, 25];
                case 25: return [2 /*return*/, defaultValue];
                case 26: return [2 /*return*/];
            }
        });
    });
}
// Validate Solana wallet address (base58 public key)
function isValidAddress(address) {
    try {
        new web3_js_1.PublicKey(address);
        return true;
    }
    catch (_a) {
        return false;
    }
}
// Get checksummed/normalized address (Solana addresses are case-sensitive base58)
function getChecksumAddress(address) {
    return new web3_js_1.PublicKey(address).toBase58();
}
// Get wallet balance in XNT (with caching)
function getBalance(address) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, cache, CacheKeys, CacheTTL, withCache;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./cache')); })];
                case 1:
                    _a = _b.sent(), cache = _a.cache, CacheKeys = _a.CacheKeys, CacheTTL = _a.CacheTTL, withCache = _a.withCache;
                    return [2 /*return*/, withCache(CacheKeys.walletBalance(address), CacheTTL.VERY_SHORT, function () { return safeRpcCall(function () { return __awaiter(_this, void 0, void 0, function () {
                            var conn, publicKey, balance;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        conn = getConnection();
                                        publicKey = new web3_js_1.PublicKey(address);
                                        return [4 /*yield*/, conn.getBalance(publicKey)];
                                    case 1:
                                        balance = _a.sent();
                                        return [2 /*return*/, (balance / web3_js_1.LAMPORTS_PER_SOL).toString()];
                                }
                            });
                        }); }, '0', "getBalance(".concat(address.slice(0, 8), "...)")); })];
            }
        });
    });
}
// Get transaction count (number of signatures for address)
function getTransactionCount(address) {
    return __awaiter(this, void 0, void 0, function () {
        var _this = this;
        return __generator(this, function (_a) {
            return [2 /*return*/, safeRpcCall(function () { return __awaiter(_this, void 0, void 0, function () {
                    var conn, publicKey, signatures;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                conn = getConnection();
                                publicKey = new web3_js_1.PublicKey(address);
                                return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: 1 })];
                            case 1:
                                signatures = _a.sent();
                                // Return slot number as a proxy for activity tracking
                                return [2 /*return*/, signatures.length > 0 ? signatures[0].slot : 0];
                        }
                    });
                }); }, 0, "getTransactionCount(".concat(address.slice(0, 8), "...)"))];
        });
    });
}
// Get recent transactions for an address (optimized with batch fetching)
function getRecentTransactions(address_1, lastSignature_1) {
    return __awaiter(this, arguments, void 0, function (address, lastSignature, limit) {
        var _this = this;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            return [2 /*return*/, safeRpcCall(function () { return __awaiter(_this, void 0, void 0, function () {
                    var conn, publicKey, transactions, options, signatures, validSignatures, BATCH_SIZE, i, batch, txPromises, txResults, j, tx, sigInfo, txInfo, error_2;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                conn = getConnection();
                                publicKey = new web3_js_1.PublicKey(address);
                                transactions = [];
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 7, , 8]);
                                options = { limit: limit };
                                if (lastSignature) {
                                    options.until = lastSignature;
                                }
                                return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, options)];
                            case 2:
                                signatures = _a.sent();
                                validSignatures = signatures.filter(function (sig) { return !sig.err; });
                                if (validSignatures.length === 0) {
                                    return [2 /*return*/, transactions];
                                }
                                BATCH_SIZE = 10;
                                i = 0;
                                _a.label = 3;
                            case 3:
                                if (!(i < validSignatures.length)) return [3 /*break*/, 6];
                                batch = validSignatures.slice(i, i + BATCH_SIZE);
                                txPromises = batch.map(function (sigInfo) {
                                    return conn.getParsedTransaction(sigInfo.signature, {
                                        maxSupportedTransactionVersion: 0
                                    }).catch(function (err) {
                                        logger.error("Error fetching transaction", err, { signature: sigInfo.signature });
                                        return null;
                                    });
                                });
                                return [4 /*yield*/, Promise.all(txPromises)];
                            case 4:
                                txResults = _a.sent();
                                // Process results
                                for (j = 0; j < txResults.length; j++) {
                                    tx = txResults[j];
                                    sigInfo = batch[j];
                                    if (!tx || !tx.meta)
                                        continue;
                                    txInfo = parseTransaction(tx, sigInfo, address);
                                    if (txInfo) {
                                        transactions.push(txInfo);
                                    }
                                }
                                _a.label = 5;
                            case 5:
                                i += BATCH_SIZE;
                                return [3 /*break*/, 3];
                            case 6: return [3 /*break*/, 8];
                            case 7:
                                error_2 = _a.sent();
                                logger.error('Error fetching recent transactions', error_2);
                                return [3 /*break*/, 8];
                            case 8: return [2 /*return*/, transactions];
                        }
                    });
                }); }, [], "getRecentTransactions(".concat(address.slice(0, 8), "...)"))];
        });
    });
}
// Parse a Solana transaction into our TransactionInfo format
function parseTransaction(tx, sigInfo, watchedAddress) {
    var _a, _b;
    var meta = tx.meta;
    if (!meta)
        return null;
    var accountKeys = tx.transaction.message.accountKeys;
    var watchedPubkey = new web3_js_1.PublicKey(watchedAddress);
    // Find the index of our watched address in the account keys
    var watchedIndex = accountKeys.findIndex(function (key) { return key.pubkey.equals(watchedPubkey); });
    if (watchedIndex === -1)
        return null;
    // Calculate SOL balance change for the watched address
    var preBalance = meta.preBalances[watchedIndex] || 0;
    var postBalance = meta.postBalances[watchedIndex] || 0;
    var balanceChange = (postBalance - preBalance) / web3_js_1.LAMPORTS_PER_SOL;
    // Determine direction based on balance change
    var isIncoming = balanceChange > 0;
    // Get from/to addresses
    var signerKey = ((_a = accountKeys[0]) === null || _a === void 0 ? void 0 : _a.pubkey.toBase58()) || 'Unknown';
    var from = isIncoming ? signerKey : watchedAddress;
    var to = isIncoming ? watchedAddress : (((_b = accountKeys[1]) === null || _b === void 0 ? void 0 : _b.pubkey.toBase58()) || null);
    // Check if it's a program interaction (not just a simple transfer)
    var isContractInteraction = tx.transaction.message.instructions.some(function (ix) { return 'programId' in ix && !ix.programId.equals(new web3_js_1.PublicKey('11111111111111111111111111111111')); });
    return {
        hash: sigInfo.signature,
        from: from,
        to: to,
        value: Math.abs(balanceChange).toString(),
        blockNumber: sigInfo.slot,
        timestamp: sigInfo.blockTime || undefined,
        isContractInteraction: isContractInteraction,
    };
}
// Get current slot number (equivalent to block number)
function getCurrentBlockNumber() {
    return __awaiter(this, void 0, void 0, function () {
        var conn;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    conn = getConnection();
                    return [4 /*yield*/, conn.getSlot()];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
// Get latest signatures for an address (used for tracking new transactions)
function getLatestSignatures(address_1) {
    return __awaiter(this, arguments, void 0, function (address, limit) {
        var _a, cache, CacheKeys, CacheTTL, withCache;
        var _this = this;
        if (limit === void 0) { limit = 1; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(limit === 1)) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./cache')); })];
                case 1:
                    _a = _b.sent(), cache = _a.cache, CacheKeys = _a.CacheKeys, CacheTTL = _a.CacheTTL, withCache = _a.withCache;
                    return [2 /*return*/, withCache(CacheKeys.walletSignatures(address), 15, // 15 second cache for signature checks
                        function () { return safeRpcCall(function () { return __awaiter(_this, void 0, void 0, function () {
                            var conn, publicKey;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        conn = getConnection();
                                        publicKey = new web3_js_1.PublicKey(address);
                                        return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: limit })];
                                    case 1: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); }, [], "getLatestSignatures(".concat(address.slice(0, 8), "...)")); })];
                case 2: return [2 /*return*/, safeRpcCall(function () { return __awaiter(_this, void 0, void 0, function () {
                        var conn, publicKey;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    conn = getConnection();
                                    publicKey = new web3_js_1.PublicKey(address);
                                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: limit })];
                                case 1: return [2 /*return*/, _a.sent()];
                            }
                        });
                    }); }, [], "getLatestSignatures(".concat(address.slice(0, 8), "...)"))];
            }
        });
    });
}
// Cache for wallet activity stats (to avoid repeated expensive calls)
var walletStatsCache = new Map();
var STATS_CACHE_TTL = 60 * 1000; // 1 minute cache
// Get wallet activity stats - FAST version (limited to recent transactions)
// Use this for UI display where speed matters
function getWalletActivityStatsFast(address) {
    return __awaiter(this, void 0, void 0, function () {
        var cached, conn, pubKey, signatures, totalTransactions, firstTxDate, oldestTx, now, oneDayAgo, sevenDaysAgo, last24hTransactions, last7dTransactions, _i, signatures_1, sig, txTime, result, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cached = walletStatsCache.get(address);
                    if (cached && Date.now() < cached.expiry) {
                        return [2 /*return*/, cached.data];
                    }
                    conn = getConnection();
                    pubKey = new web3_js_1.PublicKey(address);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, conn.getSignaturesForAddress(pubKey, { limit: 100 })];
                case 2:
                    signatures = _a.sent();
                    totalTransactions = signatures.length;
                    firstTxDate = null;
                    if (signatures.length > 0) {
                        oldestTx = signatures[signatures.length - 1];
                        if (oldestTx.blockTime) {
                            firstTxDate = new Date(oldestTx.blockTime * 1000);
                        }
                    }
                    now = Date.now();
                    oneDayAgo = now - (24 * 60 * 60 * 1000);
                    sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
                    last24hTransactions = 0;
                    last7dTransactions = 0;
                    for (_i = 0, signatures_1 = signatures; _i < signatures_1.length; _i++) {
                        sig = signatures_1[_i];
                        if (sig.blockTime) {
                            txTime = sig.blockTime * 1000;
                            if (txTime >= oneDayAgo) {
                                last24hTransactions++;
                            }
                            if (txTime >= sevenDaysAgo) {
                                last7dTransactions++;
                            }
                        }
                    }
                    result = {
                        firstTxDate: firstTxDate,
                        totalTransactions: totalTransactions >= 100 ? 100 : totalTransactions, // Indicate if there are more
                        last24hTransactions: last24hTransactions,
                        last7dTransactions: last7dTransactions
                    };
                    // Cache the result
                    walletStatsCache.set(address, { data: result, expiry: Date.now() + STATS_CACHE_TTL });
                    return [2 /*return*/, result];
                case 3:
                    error_3 = _a.sent();
                    logger.error('Error getting wallet activity stats (fast)', error_3);
                    return [2 /*return*/, {
                            firstTxDate: null,
                            totalTransactions: 0,
                            last24hTransactions: 0,
                            last7dTransactions: 0
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Get wallet activity stats (first tx date, total tx count, recent activity)
// WARNING: This is SLOW for active wallets - use getWalletActivityStatsFast for UI
function getWalletActivityStats(address) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, pubKey, allSignatures, lastSignature, hasMore, options, signatures, totalTransactions, firstTxDate, oldestTx, now, oneDayAgo, sevenDaysAgo, last24hTransactions, last7dTransactions, _i, allSignatures_1, sig, txTime, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    conn = getConnection();
                    pubKey = new web3_js_1.PublicKey(address);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    allSignatures = [];
                    lastSignature = undefined;
                    hasMore = true;
                    _a.label = 2;
                case 2:
                    if (!hasMore) return [3 /*break*/, 4];
                    options = { limit: 1000 };
                    if (lastSignature) {
                        options.before = lastSignature;
                    }
                    return [4 /*yield*/, conn.getSignaturesForAddress(pubKey, options)];
                case 3:
                    signatures = _a.sent();
                    if (signatures.length === 0) {
                        hasMore = false;
                    }
                    else {
                        allSignatures = allSignatures.concat(signatures);
                        lastSignature = signatures[signatures.length - 1].signature;
                        // Stop if we got less than 1000 (no more pages)
                        if (signatures.length < 1000) {
                            hasMore = false;
                        }
                        // Safety limit: stop at 50,000 transactions (increased for accurate wallet age)
                        if (allSignatures.length >= 50000) {
                            hasMore = false;
                        }
                    }
                    return [3 /*break*/, 2];
                case 4:
                    totalTransactions = allSignatures.length;
                    firstTxDate = null;
                    if (allSignatures.length > 0) {
                        oldestTx = allSignatures[allSignatures.length - 1];
                        if (oldestTx.blockTime) {
                            firstTxDate = new Date(oldestTx.blockTime * 1000);
                        }
                    }
                    now = Date.now();
                    oneDayAgo = now - (24 * 60 * 60 * 1000);
                    sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
                    last24hTransactions = 0;
                    last7dTransactions = 0;
                    for (_i = 0, allSignatures_1 = allSignatures; _i < allSignatures_1.length; _i++) {
                        sig = allSignatures_1[_i];
                        if (sig.blockTime) {
                            txTime = sig.blockTime * 1000;
                            if (txTime >= oneDayAgo) {
                                last24hTransactions++;
                            }
                            if (txTime >= sevenDaysAgo) {
                                last7dTransactions++;
                            }
                        }
                    }
                    return [2 /*return*/, {
                            firstTxDate: firstTxDate,
                            totalTransactions: totalTransactions,
                            last24hTransactions: last24hTransactions,
                            last7dTransactions: last7dTransactions
                        }];
                case 5:
                    error_4 = _a.sent();
                    logger.error('Error getting wallet activity stats', error_4);
                    return [2 /*return*/, {
                            firstTxDate: null,
                            totalTransactions: 0,
                            last24hTransactions: 0,
                            last7dTransactions: 0
                        }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Get quick transaction count (limited, faster)
function getQuickTransactionCount(address) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, publicKey, signatures, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    conn = getConnection();
                    publicKey = new web3_js_1.PublicKey(address);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: 1000 })];
                case 2:
                    signatures = _a.sent();
                    return [2 /*return*/, signatures.length];
                case 3:
                    error_5 = _a.sent();
                    logger.error('Error getting transaction count', error_5);
                    return [2 /*return*/, 0];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Format value for display
function formatValue(value) {
    var num = parseFloat(value);
    if (num === 0)
        return '0 XNT';
    if (num < 0.000001)
        return '< 0.000001 XNT';
    if (num < 0.001)
        return "".concat(num.toFixed(6), " XNT");
    if (num < 1)
        return "".concat(num.toFixed(4), " XNT");
    return "".concat(num.toFixed(4), " XNT");
}
// Get explorer URL for transaction
function getTxExplorerUrl(txHash) {
    return "".concat(config_1.config.explorerUrl, "/tx/").concat(txHash);
}
// Get explorer URL for address
function getAddressExplorerUrl(address) {
    return "".concat(config_1.config.explorerUrl, "/account/").concat(address);
}
// Check if connection is working
function isConnected() {
    return __awaiter(this, void 0, void 0, function () {
        var conn, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    conn = getConnection();
                    return [4 /*yield*/, conn.getSlot()];
                case 1:
                    _b.sent();
                    return [2 /*return*/, true];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Detect which token program a mint belongs to
function detectTokenProgram(mintAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, mintPubkey, mintInfo, _a, mintInfo, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    conn = getConnection();
                    mintPubkey = new web3_js_1.PublicKey(mintAddress);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, spl_token_1.getMint)(conn, mintPubkey, 'confirmed', spl_token_1.TOKEN_PROGRAM_ID)];
                case 2:
                    mintInfo = _c.sent();
                    return [2 /*return*/, {
                            decimals: mintInfo.decimals,
                            program: 'spl-token',
                            programId: spl_token_1.TOKEN_PROGRAM_ID
                        }];
                case 3:
                    _a = _c.sent();
                    return [3 /*break*/, 4];
                case 4:
                    _c.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, (0, spl_token_1.getMint)(conn, mintPubkey, 'confirmed', spl_token_1.TOKEN_2022_PROGRAM_ID)];
                case 5:
                    mintInfo = _c.sent();
                    return [2 /*return*/, {
                            decimals: mintInfo.decimals,
                            program: 'token-2022',
                            programId: spl_token_1.TOKEN_2022_PROGRAM_ID
                        }];
                case 6:
                    _b = _c.sent();
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, null];
            }
        });
    });
}
// Get token metadata using Metaplex
function getMetaplexMetadata(mintAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var umi, mintPublicKey, asset, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    umi = (0, umi_bundle_defaults_1.createUmi)(config_1.config.x1RpcUrl).use((0, mpl_token_metadata_1.mplTokenMetadata)());
                    mintPublicKey = (0, umi_1.publicKey)(mintAddress);
                    return [4 /*yield*/, (0, mpl_token_metadata_1.fetchDigitalAsset)(umi, mintPublicKey)];
                case 1:
                    asset = _b.sent();
                    return [2 /*return*/, {
                            name: asset.metadata.name.replace(/\0/g, '').trim(),
                            symbol: asset.metadata.symbol.replace(/\0/g, '').trim()
                        }];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Get Token-2022 on-chain metadata (for tokens using the metadata extension)
function getToken2022Metadata(mintAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, mintPubkey, metadata, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    conn = getConnection();
                    mintPubkey = new web3_js_1.PublicKey(mintAddress);
                    return [4 /*yield*/, (0, spl_token_1.getTokenMetadata)(conn, mintPubkey, 'confirmed', spl_token_1.TOKEN_2022_PROGRAM_ID)];
                case 1:
                    metadata = _b.sent();
                    if (metadata) {
                        return [2 /*return*/, {
                                name: metadata.name || '',
                                symbol: metadata.symbol || ''
                            }];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/, null];
            }
        });
    });
}
// Get SPL/Token-2022 token info (symbol, decimals, name) - with caching
function getTokenInfo(tokenMint) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, cache, CacheKeys, CacheTTL, withCache;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./cache')); })];
                case 1:
                    _a = _b.sent(), cache = _a.cache, CacheKeys = _a.CacheKeys, CacheTTL = _a.CacheTTL, withCache = _a.withCache;
                    return [2 /*return*/, withCache(CacheKeys.tokenInfo(tokenMint), CacheTTL.LONG, // Token info rarely changes
                        function () { return __awaiter(_this, void 0, void 0, function () {
                            var mintInfo, metadata, symbol, name_1, error_6;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        _a.trys.push([0, 6, , 7]);
                                        return [4 /*yield*/, detectTokenProgram(tokenMint)];
                                    case 1:
                                        mintInfo = _a.sent();
                                        if (!mintInfo) {
                                            return [2 /*return*/, null];
                                        }
                                        metadata = null;
                                        if (!(mintInfo.program === 'token-2022')) return [3 /*break*/, 3];
                                        return [4 /*yield*/, getToken2022Metadata(tokenMint)];
                                    case 2:
                                        metadata = _a.sent();
                                        _a.label = 3;
                                    case 3:
                                        if (!(!metadata || !metadata.symbol)) return [3 /*break*/, 5];
                                        return [4 /*yield*/, getMetaplexMetadata(tokenMint)];
                                    case 4:
                                        metadata = _a.sent();
                                        _a.label = 5;
                                    case 5:
                                        symbol = (metadata === null || metadata === void 0 ? void 0 : metadata.symbol) || tokenMint.slice(0, 4).toUpperCase();
                                        name_1 = (metadata === null || metadata === void 0 ? void 0 : metadata.name) || "Token ".concat(tokenMint.slice(0, 8), "...");
                                        return [2 /*return*/, {
                                                symbol: symbol,
                                                decimals: mintInfo.decimals,
                                                name: name_1,
                                                program: mintInfo.program
                                            }];
                                    case 6:
                                        error_6 = _a.sent();
                                        logger.error('Error getting token info', error_6);
                                        return [2 /*return*/, null];
                                    case 7: return [2 /*return*/];
                                }
                            });
                        }); })];
            }
        });
    });
}
// Get SPL/Token-2022 token balance for a wallet
function getTokenBalance(tokenMint, walletAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, walletPubkey, mintPubkey, mintInfo, tokenAccounts, totalBalance, _i, _a, accountInfo, accountData, balance, error_7;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 3, , 4]);
                    conn = getConnection();
                    walletPubkey = new web3_js_1.PublicKey(walletAddress);
                    mintPubkey = new web3_js_1.PublicKey(tokenMint);
                    return [4 /*yield*/, detectTokenProgram(tokenMint)];
                case 1:
                    mintInfo = _b.sent();
                    if (!mintInfo) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, conn.getTokenAccountsByOwner(walletPubkey, { mint: mintPubkey }, { commitment: 'confirmed' })];
                case 2:
                    tokenAccounts = _b.sent();
                    if (tokenAccounts.value.length === 0) {
                        return [2 /*return*/, '0'];
                    }
                    totalBalance = BigInt(0);
                    for (_i = 0, _a = tokenAccounts.value; _i < _a.length; _i++) {
                        accountInfo = _a[_i];
                        accountData = spl_token_1.AccountLayout.decode(accountInfo.account.data);
                        totalBalance += accountData.amount;
                    }
                    balance = Number(totalBalance) / Math.pow(10, mintInfo.decimals);
                    return [2 /*return*/, balance.toString()];
                case 3:
                    error_7 = _b.sent();
                    logger.error('Error getting token balance', error_7);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Get all token accounts for a wallet (both SPL and Token-2022) - optimized with parallel fetching
function getAllTokenAccounts(walletAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, walletPubkey, tokens, _a, splResult, token2022Result, mintPromises, splTokens, mintPromises, token2022Tokens;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    conn = getConnection();
                    walletPubkey = new web3_js_1.PublicKey(walletAddress);
                    tokens = [];
                    return [4 /*yield*/, Promise.allSettled([
                            conn.getTokenAccountsByOwner(walletPubkey, { programId: spl_token_1.TOKEN_PROGRAM_ID }),
                            conn.getTokenAccountsByOwner(walletPubkey, { programId: spl_token_1.TOKEN_2022_PROGRAM_ID })
                        ])];
                case 1:
                    _a = _b.sent(), splResult = _a[0], token2022Result = _a[1];
                    if (!(splResult.status === 'fulfilled')) return [3 /*break*/, 3];
                    mintPromises = splResult.value.value.map(function (account) { return __awaiter(_this, void 0, void 0, function () {
                        var data, mint, mintInfo, balance, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    data = spl_token_1.AccountLayout.decode(account.account.data);
                                    mint = new web3_js_1.PublicKey(data.mint).toBase58();
                                    return [4 /*yield*/, (0, spl_token_1.getMint)(conn, new web3_js_1.PublicKey(mint), 'confirmed', spl_token_1.TOKEN_PROGRAM_ID)];
                                case 1:
                                    mintInfo = _b.sent();
                                    balance = Number(data.amount) / Math.pow(10, mintInfo.decimals);
                                    if (balance > 0) {
                                        return [2 /*return*/, {
                                                mint: mint,
                                                balance: balance.toString(),
                                                decimals: mintInfo.decimals,
                                                program: 'spl-token'
                                            }];
                                    }
                                    return [3 /*break*/, 3];
                                case 2:
                                    _a = _b.sent();
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/, null];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(mintPromises)];
                case 2:
                    splTokens = _b.sent();
                    tokens.push.apply(tokens, splTokens.filter(function (t) { return t !== null; }));
                    return [3 /*break*/, 4];
                case 3:
                    logger.error('Error fetching SPL token accounts', splResult.reason);
                    _b.label = 4;
                case 4:
                    if (!(token2022Result.status === 'fulfilled')) return [3 /*break*/, 6];
                    mintPromises = token2022Result.value.value.map(function (account) { return __awaiter(_this, void 0, void 0, function () {
                        var data, mint, mintInfo, balance, _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    _b.trys.push([0, 2, , 3]);
                                    data = spl_token_1.AccountLayout.decode(account.account.data);
                                    mint = new web3_js_1.PublicKey(data.mint).toBase58();
                                    return [4 /*yield*/, (0, spl_token_1.getMint)(conn, new web3_js_1.PublicKey(mint), 'confirmed', spl_token_1.TOKEN_2022_PROGRAM_ID)];
                                case 1:
                                    mintInfo = _b.sent();
                                    balance = Number(data.amount) / Math.pow(10, mintInfo.decimals);
                                    if (balance > 0) {
                                        return [2 /*return*/, {
                                                mint: mint,
                                                balance: balance.toString(),
                                                decimals: mintInfo.decimals,
                                                program: 'token-2022'
                                            }];
                                    }
                                    return [3 /*break*/, 3];
                                case 2:
                                    _a = _b.sent();
                                    return [3 /*break*/, 3];
                                case 3: return [2 /*return*/, null];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(mintPromises)];
                case 5:
                    token2022Tokens = _b.sent();
                    tokens.push.apply(tokens, token2022Tokens.filter(function (t) { return t !== null; }));
                    return [3 /*break*/, 7];
                case 6:
                    logger.error('Error fetching Token-2022 accounts', token2022Result.reason);
                    _b.label = 7;
                case 7: return [2 /*return*/, tokens];
            }
        });
    });
}
// Format token balance for display
function formatTokenBalance(balance, symbol) {
    var num = parseFloat(balance);
    if (num === 0)
        return "0 ".concat(symbol);
    if (num < 0.0001)
        return "< 0.0001 ".concat(symbol);
    if (num < 1)
        return "".concat(num.toFixed(4), " ").concat(symbol);
    if (num < 1000)
        return "".concat(num.toFixed(2), " ").concat(symbol);
    if (num < 1000000)
        return "".concat((num / 1000).toFixed(2), "K ").concat(symbol);
    return "".concat((num / 1000000).toFixed(2), "M ").concat(symbol);
}
// Validate if address is a valid SPL or Token-2022 token mint
function isValidTokenContract(tokenMint) {
    return __awaiter(this, void 0, void 0, function () {
        var mintInfo, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, detectTokenProgram(tokenMint)];
                case 1:
                    mintInfo = _b.sent();
                    return [2 /*return*/, mintInfo !== null];
                case 2:
                    _a = _b.sent();
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Get explorer URL for token
function getTokenExplorerUrl(tokenMint) {
    return "".concat(config_1.config.explorerUrl, "/token/").concat(tokenMint);
}
