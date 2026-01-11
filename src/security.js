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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preScanWallet = preScanWallet;
exports.clearSecurityScanFailures = clearSecurityScanFailures;
exports.getSecurityScanStatus = getSecurityScanStatus;
exports.preScanWallets = preScanWallets;
exports.checkWalletSecurity = checkWalletSecurity;
exports.formatSecurityInfo = formatSecurityInfo;
var web3_js_1 = require("@solana/web3.js");
var blockchain_1 = require("./blockchain");
var cache_1 = require("./cache");
var logger_1 = require("./logger");
var logger = (0, logger_1.createLogger)('Security');
// GoPlus Security API (free, no key required for basic checks)
var GOPLUS_API_BASE = 'https://api.gopluslabs.io/api/v1';
// --- Concurrency guard for security scans ---
// Security scans can be very RPC-heavy. If multiple scans run in parallel, the RPC can 429,
// and the bot may appear frozen (even /start won't respond).
// We therefore serialize scans globally.
var securityScanChain = Promise.resolve();
function withSecurityScanLock(fn_1) {
    return __awaiter(this, arguments, void 0, function (fn, timeoutMs) {
        var release, next, prev;
        if (timeoutMs === void 0) { timeoutMs = 60000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    next = new Promise(function (resolve) { return (release = resolve); });
                    prev = securityScanChain;
                    securityScanChain = securityScanChain.then(function () { return next; }).catch(function () { return next; });
                    // Wait our turn
                    return [4 /*yield*/, prev];
                case 1:
                    // Wait our turn
                    _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, , 4, 5]);
                    return [4 /*yield*/, Promise.race([
                            fn(),
                            new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error('Security scan timed out')); }, timeoutMs); }),
                        ])];
                case 3: 
                // Also enforce an overall timeout so we don't hold the lock forever
                return [2 /*return*/, _a.sent()];
                case 4:
                    // @ts-expect-error set in constructor above
                    release();
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Background pre-scan is intentionally kept but should be used sparingly.
// Track failed security scans for retry logic
var failedSecurityScans = new Map();
var MAX_SECURITY_SCAN_RETRIES = 3;
var SECURITY_SCAN_RETRY_DELAY = 5000; // 5 seconds
// It is NOT used by default in handlers.
function preScanWallet(address) {
    // Check if auto-scan is disabled
    var config = require('./config').config;
    if (config.disableAutoSecurityScan) {
        logger.info('Auto security scan disabled, skipping pre-scan for ' + address.slice(0, 8) + '...');
        return;
    }
    var addressKey = address.toLowerCase();
    var failureInfo = failedSecurityScans.get(addressKey);
    // Check if we've exceeded retry attempts
    if (failureInfo && failureInfo.attempts >= MAX_SECURITY_SCAN_RETRIES) {
        var timeSinceLastAttempt = Date.now() - failureInfo.lastAttempt;
        // Reset after 1 hour
        if (timeSinceLastAttempt < 3600000) {
            logger.warn("\u26A0\uFE0F  Security scan for ".concat(address.slice(0, 8), "... failed ").concat(failureInfo.attempts, " times, skipping"));
            return;
        }
        else {
            // Reset after cooldown period
            failedSecurityScans.delete(addressKey);
        }
    }
    void checkWalletSecurity(address, true).catch(function (err) {
        logger.error("\u26A0\uFE0F  Security scan error for ".concat(address.slice(0, 8), "...:"), err.message);
        // Track failure
        var current = failedSecurityScans.get(addressKey) || { attempts: 0, lastAttempt: 0 };
        current.attempts++;
        current.lastAttempt = Date.now();
        failedSecurityScans.set(addressKey, current);
        // Schedule retry if we haven't exceeded max attempts
        if (current.attempts < MAX_SECURITY_SCAN_RETRIES) {
            var delay = SECURITY_SCAN_RETRY_DELAY * current.attempts;
            logger.info("\uD83D\uDD04 Retrying security scan for ".concat(address.slice(0, 8), "... in ").concat(delay, "ms (attempt ").concat(current.attempts + 1, "/").concat(MAX_SECURITY_SCAN_RETRIES, ")"));
            setTimeout(function () {
                preScanWallet(address);
            }, delay);
        }
        else {
            logger.error("\u274C Security scan permanently failed for ".concat(address.slice(0, 8), "... after ").concat(MAX_SECURITY_SCAN_RETRIES, " attempts"));
        }
    }).then(function () {
        // Clear failure tracking on success
        failedSecurityScans.delete(addressKey);
    });
}
// Clear failed scan tracking (call when wallet is removed)
function clearSecurityScanFailures(address) {
    failedSecurityScans.delete(address.toLowerCase());
}
// Get security scan status
function getSecurityScanStatus(address) {
    var info = failedSecurityScans.get(address.toLowerCase());
    if (!info)
        return null;
    return { failed: info.attempts >= MAX_SECURITY_SCAN_RETRIES, attempts: info.attempts };
}
function preScanWallets(addresses) {
    // Check if auto-scan is disabled
    var config = require('./config').config;
    if (config.disableAutoSecurityScan) {
        logger.info('⏭️  Auto security scan disabled, skipping pre-scan for wallets');
        return;
    }
    for (var _i = 0, _a = addresses.slice(0, 2); _i < _a.length; _i++) { // extra conservative
        var address = _a[_i];
        preScanWallet(address);
    }
}
// Check wallet security using GoPlus API - OPTIMIZED with caching
function checkWalletSecurity(address_1) {
    return __awaiter(this, arguments, void 0, function (address, deepScan) {
        var _this = this;
        if (deepScan === void 0) { deepScan = true; }
        return __generator(this, function (_a) {
            return [2 /*return*/, withSecurityScanLock(function () { return __awaiter(_this, void 0, void 0, function () {
                    var cacheKey, cached, monitoring, e_1, result, startTime, timeoutMs_1, withTimeout, _a, goPlusResult, deployerResult, activityResult, fundingResult, connectedResult, lpRugResult, tokenCount, rugpullCount, _b, coordinatedWallets, totalDuration, monitoring, e_2, error_1, monitoring, e_3;
                    var _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                cacheKey = cache_1.CacheKeys.securityScan(address);
                                cached = cache_1.cache.get(cacheKey);
                                if (!cached) return [3 /*break*/, 5];
                                logger.info("\u2705 Using cached security scan for ".concat(address.slice(0, 8), "..."));
                                _d.label = 1;
                            case 1:
                                _d.trys.push([1, 3, , 4]);
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                            case 2:
                                monitoring = (_d.sent()).monitoring;
                                monitoring.recordSecurityScan(0, true, true);
                                return [3 /*break*/, 4];
                            case 3:
                                e_1 = _d.sent();
                                return [3 /*break*/, 4];
                            case 4: return [2 /*return*/, cached];
                            case 5:
                                result = {
                                    riskLevel: 'unknown',
                                    riskScore: 0,
                                    warnings: [],
                                    isDeployer: false,
                                    deployedTokens: [],
                                    deployedTokensAnalysis: [],
                                    fundingSource: null,
                                    fundingSourceRisk: 'unknown',
                                    fundingChain: [],
                                    hasBlacklistHistory: false,
                                    maliciousActivity: false,
                                    connectedWallets: [],
                                    riskyConnections: 0,
                                    suspiciousPatterns: [],
                                    activityAnalysis: null,
                                    verdict: '',
                                };
                                _d.label = 6;
                            case 6:
                                _d.trys.push([6, 18, , 23]);
                                logger.info('Starting optimized security scan for: ' + address.slice(0, 8) + '...');
                                startTime = Date.now();
                                timeoutMs_1 = 30000;
                                withTimeout = function (promise, defaultValue) {
                                    var timeoutRef = { timer: null };
                                    var timeoutPromise = new Promise(function (_, reject) {
                                        timeoutRef.timer = setTimeout(function () { return reject(new Error('Operation timed out')); }, timeoutMs_1);
                                    });
                                    return Promise.race([
                                        promise,
                                        timeoutPromise
                                    ]).then(function (result) {
                                        // Clear timeout on success
                                        if (timeoutRef.timer)
                                            clearTimeout(timeoutRef.timer);
                                        return result;
                                    }).catch(function (error) {
                                        // Clear timeout on error
                                        if (timeoutRef.timer)
                                            clearTimeout(timeoutRef.timer);
                                        logger.warn('Security check operation failed:', error.message);
                                        return defaultValue;
                                    });
                                };
                                return [4 /*yield*/, Promise.all([
                                        withTimeout(checkGoPlusSecurityCached(address), null),
                                        withTimeout(checkIfDeployerFast(address), { isDeployer: false, deployedTokens: [], tokenAnalysis: [] }),
                                        withTimeout(analyzeWalletActivityFast(address), null),
                                    ])];
                            case 7:
                                _a = _d.sent(), goPlusResult = _a[0], deployerResult = _a[1], activityResult = _a[2];
                                logger.info("\u26A1 Phase 1 completed in ".concat(Date.now() - startTime, "ms"));
                                fundingResult = { source: null, chain: [], risk: 'unknown' };
                                connectedResult = new Map();
                                lpRugResult = {
                                    isLpRugger: false,
                                    totalWithdrawn: 0,
                                    lpBurns: 0,
                                    largeDumps: 0,
                                    evidence: [],
                                    timestamp: null
                                };
                                if (!deepScan) return [3 /*break*/, 11];
                                return [4 /*yield*/, withTimeout(detectLpRugActivity(address), { isLpRugger: false, totalWithdrawn: 0, lpBurns: 0, largeDumps: 0, evidence: [] })];
                            case 8:
                                lpRugResult = _d.sent();
                                return [4 /*yield*/, withTimeout(traceFundingChainFast(address), { source: null, chain: [], risk: 'unknown' })];
                            case 9:
                                fundingResult = _d.sent();
                                logger.info("\uD83D\uDCB0 Funding result for ".concat(address.slice(0, 8)), { fundingResult: fundingResult });
                                return [4 /*yield*/, withTimeout(findConnectedWalletsFast(address), new Map())];
                            case 10:
                                connectedResult = _d.sent();
                                _d.label = 11;
                            case 11:
                                logger.info("\u26A1 Full scan completed in ".concat(Date.now() - startTime, "ms"));
                                // Merge GoPlus results
                                if (goPlusResult) {
                                    result.hasBlacklistHistory = goPlusResult.hasBlacklistHistory;
                                    result.maliciousActivity = goPlusResult.maliciousActivity;
                                    (_c = result.warnings).push.apply(_c, goPlusResult.warnings);
                                    if (goPlusResult.hasBlacklistHistory) {
                                        result.suspiciousPatterns.push({
                                            type: 'known_scammer',
                                            severity: 'critical',
                                            description: 'Address found in security blacklists',
                                            evidence: ['Flagged by GoPlus security database'],
                                        });
                                    }
                                }
                                // Merge deployer results with enhanced analysis
                                result.isDeployer = deployerResult.isDeployer;
                                result.deployedTokens = deployerResult.deployedTokens;
                                result.deployedTokensAnalysis = deployerResult.tokenAnalysis;
                                // Merge LP rug detection results
                                logger.info('LP Rug Result in main scan', { isLpRugger: lpRugResult.isLpRugger, evidence: lpRugResult.evidence });
                                if (lpRugResult.isLpRugger) {
                                    logger.info('Adding LP rugger pattern to results');
                                    result.suspiciousPatterns.push({
                                        type: 'lp_rugger',
                                        severity: 'critical',
                                        description: 'LP RUGGER - Pulled liquidity from DEX',
                                        evidence: lpRugResult.evidence,
                                        timestamp: lpRugResult.timestamp ? new Date(lpRugResult.timestamp * 1000) : undefined,
                                    });
                                    result.warnings.push("\uD83D\uDEA8 LP RUGGER: ".concat(lpRugResult.evidence.join(', ')));
                                }
                                if (deployerResult.isDeployer) {
                                    tokenCount = deployerResult.deployedTokens.length;
                                    rugpullCount = deployerResult.tokenAnalysis.filter(function (t) { return t.isRugpull; }).length;
                                    if (tokenCount >= 10) {
                                        result.suspiciousPatterns.push({
                                            type: 'serial_deployer',
                                            severity: 'critical',
                                            description: "Serial token deployer - created ".concat(tokenCount, " tokens"),
                                            evidence: [
                                                "".concat(tokenCount, " tokens deployed"),
                                                rugpullCount > 0 ? "".concat(rugpullCount, " identified as rugpulls") : 'Token analysis pending',
                                            ],
                                        });
                                        result.warnings.push("\uD83D\uDEA8 SERIAL DEPLOYER: ".concat(tokenCount, " tokens created"));
                                    }
                                    else if (tokenCount >= 3) {
                                        result.suspiciousPatterns.push({
                                            type: 'serial_deployer',
                                            severity: 'danger',
                                            description: "Multiple token deployer - created ".concat(tokenCount, " tokens"),
                                            evidence: ["".concat(tokenCount, " tokens deployed from this wallet")],
                                        });
                                        result.warnings.push("\u26A0\uFE0F Multiple token deployer: ".concat(tokenCount, " tokens"));
                                    }
                                    // Check for rugpull patterns in deployed tokens
                                    if (rugpullCount > 0) {
                                        result.suspiciousPatterns.push({
                                            type: 'liquidity_puller',
                                            severity: 'critical',
                                            description: "".concat(rugpullCount, " of ").concat(tokenCount, " deployed tokens show rugpull indicators"),
                                            evidence: deployerResult.tokenAnalysis
                                                .filter(function (t) { return t.isRugpull; })
                                                .flatMap(function (t) { return t.rugpullIndicators; }),
                                        });
                                        result.warnings.push("\uD83D\uDEA8 RUGPULL HISTORY: ".concat(rugpullCount, " token(s) rugged"));
                                    }
                                }
                                // Merge funding chain results
                                result.fundingSource = fundingResult.source;
                                result.fundingChain = fundingResult.chain;
                                result.fundingSourceRisk = fundingResult.risk;
                                logger.info("\uD83D\uDCCA After merge - fundingChain length: ".concat(result.fundingChain.length), { fundingChain: result.fundingChain });
                                if (fundingResult.risk === 'high' || fundingResult.risk === 'critical') {
                                    result.suspiciousPatterns.push({
                                        type: 'fresh_wallet_funder',
                                        severity: fundingResult.risk === 'critical' ? 'critical' : 'danger',
                                        description: 'Funded by suspicious source',
                                        evidence: ["Funding chain: ".concat(fundingResult.chain.map(function (a) { return a.slice(0, 6) + '...'; }).join(' → '))],
                                    });
                                    result.warnings.push("\u26A0\uFE0F Suspicious funding source detected");
                                }
                                // Analyze activity patterns
                                result.activityAnalysis = activityResult;
                                if (activityResult) {
                                    // Check for wash trading patterns
                                    if (activityResult.rapidFireTransactions > 20) {
                                        result.suspiciousPatterns.push({
                                            type: 'wash_trading',
                                            severity: 'warning',
                                            description: 'High frequency trading pattern detected',
                                            evidence: ["".concat(activityResult.rapidFireTransactions, " rapid-fire transactions detected")],
                                        });
                                    }
                                    // Fresh wallet with large activity
                                    if (activityResult.accountAge < 7 && activityResult.totalTransactions > 100) {
                                        result.suspiciousPatterns.push({
                                            type: 'suspicious_timing',
                                            severity: 'warning',
                                            description: 'New wallet with unusually high activity',
                                            evidence: [
                                                "Account age: ".concat(activityResult.accountAge, " days"),
                                                "Total transactions: ".concat(activityResult.totalTransactions),
                                            ],
                                        });
                                    }
                                }
                                if (!(connectedResult.size > 0)) return [3 /*break*/, 13];
                                _b = result;
                                return [4 /*yield*/, analyzeConnectedWalletsFast(connectedResult, address)];
                            case 12:
                                _b.connectedWallets = _d.sent();
                                result.riskyConnections = result.connectedWallets.filter(function (w) { return w.riskLevel === 'high' || w.riskLevel === 'critical'; }).length;
                                coordinatedWallets = detectCoordinatedWallets(result.connectedWallets);
                                if (coordinatedWallets.length > 0) {
                                    result.suspiciousPatterns.push({
                                        type: 'coordinated_wallets',
                                        severity: 'danger',
                                        description: 'Possible coordinated wallet network detected',
                                        evidence: coordinatedWallets.map(function (w) { return "".concat(w.address.slice(0, 6), "...").concat(w.address.slice(-4), ": ").concat(w.pattern); }),
                                    });
                                    result.warnings.push("\u26A0\uFE0F Connected to ".concat(coordinatedWallets.length, " coordinated wallet(s)"));
                                }
                                if (result.riskyConnections > 0) {
                                    result.warnings.push("Connected to ".concat(result.riskyConnections, " risky wallet(s)"));
                                }
                                _d.label = 13;
                            case 13:
                                // Calculate overall risk score and level
                                result.riskScore = calculateRiskScoreEnhanced(result);
                                result.riskLevel = getRiskLevelEnhanced(result.riskScore);
                                // Generate human-readable verdict
                                result.verdict = generateVerdict(result);
                                // Cache the result
                                cache_1.cache.set(cacheKey, result, cache_1.CacheTTL.SHORT);
                                totalDuration = Date.now() - startTime;
                                logger.info("\u2705 Security scan completed in ".concat(totalDuration, "ms"));
                                _d.label = 14;
                            case 14:
                                _d.trys.push([14, 16, , 17]);
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                            case 15:
                                monitoring = (_d.sent()).monitoring;
                                monitoring.recordSecurityScan(totalDuration, false, true);
                                return [3 /*break*/, 17];
                            case 16:
                                e_2 = _d.sent();
                                return [3 /*break*/, 17];
                            case 17: return [3 /*break*/, 23];
                            case 18:
                                error_1 = _d.sent();
                                logger.error('Error checking wallet security:', error_1);
                                result.verdict = 'Unable to complete security scan. Please try again.';
                                _d.label = 19;
                            case 19:
                                _d.trys.push([19, 21, , 22]);
                                return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./monitoring')); })];
                            case 20:
                                monitoring = (_d.sent()).monitoring;
                                monitoring.recordSecurityScan(0, false, false);
                                return [3 /*break*/, 22];
                            case 21:
                                e_3 = _d.sent();
                                return [3 /*break*/, 22];
                            case 22: return [3 /*break*/, 23];
                            case 23: return [2 /*return*/, result];
                        }
                    });
                }); })];
        });
    });
}
// Check GoPlus Security API for address reputation
function checkGoPlusSecurity(address) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data, warnings, hasBlacklistHistory, maliciousActivity, result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(GOPLUS_API_BASE, "/address_security/").concat(address, "?chain_id=solana"), {
                            method: 'GET',
                            headers: { 'Content-Type': 'application/json' },
                            signal: AbortSignal.timeout(5000), // 5 second timeout
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        // GoPlus may not support this chain, fall back to on-chain analysis
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    warnings = [];
                    hasBlacklistHistory = false;
                    maliciousActivity = false;
                    if (data.result) {
                        result = data.result[address.toLowerCase()] || data.result[address] || {};
                        if (result.blacklist_doubt === '1') {
                            hasBlacklistHistory = true;
                            warnings.push('🚨 Address flagged in blacklists');
                        }
                        if (result.honeypot_related_address === '1') {
                            maliciousActivity = true;
                            warnings.push('⚠️ Related to honeypot activity');
                        }
                        if (result.phishing_activities === '1') {
                            maliciousActivity = true;
                            warnings.push('🎣 Phishing activity detected');
                        }
                        if (result.stealing_attack === '1') {
                            maliciousActivity = true;
                            warnings.push('💀 Associated with theft');
                        }
                        if (result.fake_token === '1') {
                            warnings.push('🪙 Created fake tokens');
                        }
                    }
                    return [2 /*return*/, { hasBlacklistHistory: hasBlacklistHistory, maliciousActivity: maliciousActivity, warnings: warnings }];
                case 3:
                    error_2 = _a.sent();
                    // API not available or timeout - continue with on-chain checks
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Enhanced deployer check with token analysis
function checkIfDeployerEnhanced(address) {
    return __awaiter(this, void 0, void 0, function () {
        var deployedTokens, tokenAnalysis, conn, publicKey, signatures, _i, _a, sigInfo, tx, checkInstruction, _b, _c, ix, _d, _e, inner, _f, _g, ix, e_4, _h, _j, mint, analysis, e_5, error_3;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    deployedTokens = [];
                    tokenAnalysis = [];
                    _k.label = 1;
                case 1:
                    _k.trys.push([1, 15, , 16]);
                    conn = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: 200 })];
                case 2:
                    signatures = _k.sent();
                    _i = 0, _a = signatures.slice(0, 100);
                    _k.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 8];
                    sigInfo = _a[_i];
                    _k.label = 4;
                case 4:
                    _k.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, conn.getParsedTransaction(sigInfo.signature, {
                            maxSupportedTransactionVersion: 0,
                        })];
                case 5:
                    tx = _k.sent();
                    if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                        return [3 /*break*/, 7];
                    checkInstruction = function (ix) {
                        var _a;
                        if ('parsed' in ix && ix.parsed) {
                            var parsed = ix.parsed;
                            if (parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') {
                                var mintAddress = (_a = parsed.info) === null || _a === void 0 ? void 0 : _a.mint;
                                if (mintAddress && !deployedTokens.includes(mintAddress)) {
                                    deployedTokens.push(mintAddress);
                                }
                            }
                        }
                    };
                    // Check main instructions
                    for (_b = 0, _c = tx.transaction.message.instructions; _b < _c.length; _b++) {
                        ix = _c[_b];
                        checkInstruction(ix);
                    }
                    // Check inner instructions
                    if (tx.meta.innerInstructions) {
                        for (_d = 0, _e = tx.meta.innerInstructions; _d < _e.length; _d++) {
                            inner = _e[_d];
                            for (_f = 0, _g = inner.instructions; _f < _g.length; _f++) {
                                ix = _g[_f];
                                checkInstruction(ix);
                            }
                        }
                    }
                    return [3 /*break*/, 7];
                case 6:
                    e_4 = _k.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8:
                    _h = 0, _j = deployedTokens.slice(0, 10);
                    _k.label = 9;
                case 9:
                    if (!(_h < _j.length)) return [3 /*break*/, 14];
                    mint = _j[_h];
                    _k.label = 10;
                case 10:
                    _k.trys.push([10, 12, , 13]);
                    return [4 /*yield*/, analyzeDeployedToken(mint, address)];
                case 11:
                    analysis = _k.sent();
                    tokenAnalysis.push(analysis);
                    return [3 /*break*/, 13];
                case 12:
                    e_5 = _k.sent();
                    tokenAnalysis.push({
                        mint: mint,
                        hasLiquidity: false,
                        liquidityPulled: false,
                        mintAuthorityRevoked: false,
                        freezeAuthorityRevoked: false,
                        isRugpull: false,
                        rugpullIndicators: [],
                    });
                    return [3 /*break*/, 13];
                case 13:
                    _h++;
                    return [3 /*break*/, 9];
                case 14: return [3 /*break*/, 16];
                case 15:
                    error_3 = _k.sent();
                    logger.error('Error checking deployer status:', error_3);
                    return [3 /*break*/, 16];
                case 16: return [2 /*return*/, {
                        isDeployer: deployedTokens.length > 0,
                        deployedTokens: deployedTokens,
                        tokenAnalysis: tokenAnalysis,
                    }];
            }
        });
    });
}
// Analyze a deployed token for rugpull indicators
function analyzeDeployedToken(mint, deployer) {
    return __awaiter(this, void 0, void 0, function () {
        var result, conn, mintPubkey, deployerSigs, _i, deployerSigs_1, sig, tx, _a, _b, ix, parsed, e_6, e_7, getTokenInfo, tokenInfo, e_8, mintInfo, data, largestAccounts, totalSupply, topHolder, topHolderPercentage, topHolderAccount, accountInfo, owner, e_9, error_4;
        var _c, _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    result = {
                        mint: mint,
                        hasLiquidity: false,
                        liquidityPulled: false,
                        mintAuthorityRevoked: false,
                        freezeAuthorityRevoked: false,
                        isRugpull: false,
                        rugpullIndicators: [],
                    };
                    _l.label = 1;
                case 1:
                    _l.trys.push([1, 22, , 23]);
                    conn = (0, blockchain_1.getConnection)();
                    mintPubkey = new web3_js_1.PublicKey(mint);
                    _l.label = 2;
                case 2:
                    _l.trys.push([2, 10, , 11]);
                    return [4 /*yield*/, conn.getSignaturesForAddress(new web3_js_1.PublicKey(deployer), { limit: 100 })];
                case 3:
                    deployerSigs = _l.sent();
                    _i = 0, deployerSigs_1 = deployerSigs;
                    _l.label = 4;
                case 4:
                    if (!(_i < deployerSigs_1.length)) return [3 /*break*/, 9];
                    sig = deployerSigs_1[_i];
                    if (!!result.createdAt) return [3 /*break*/, 8];
                    _l.label = 5;
                case 5:
                    _l.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 })];
                case 6:
                    tx = _l.sent();
                    if (!tx)
                        return [3 /*break*/, 8];
                    // Check if this transaction created the token mint
                    for (_a = 0, _b = tx.transaction.message.instructions; _a < _b.length; _a++) {
                        ix = _b[_a];
                        if ('parsed' in ix && ix.parsed) {
                            parsed = ix.parsed;
                            if ((parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') &&
                                ((_c = parsed.info) === null || _c === void 0 ? void 0 : _c.mint) === mint && sig.blockTime) {
                                result.createdAt = new Date(sig.blockTime * 1000);
                                break;
                            }
                        }
                    }
                    return [3 /*break*/, 8];
                case 7:
                    e_6 = _l.sent();
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 4];
                case 9: return [3 /*break*/, 11];
                case 10:
                    e_7 = _l.sent();
                    return [3 /*break*/, 11];
                case 11:
                    _l.trys.push([11, 14, , 15]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return __importStar(require('./blockchain')); })];
                case 12:
                    getTokenInfo = (_l.sent()).getTokenInfo;
                    return [4 /*yield*/, getTokenInfo(mint)];
                case 13:
                    tokenInfo = _l.sent();
                    if (tokenInfo) {
                        result.name = tokenInfo.name;
                        result.symbol = tokenInfo.symbol;
                    }
                    return [3 /*break*/, 15];
                case 14:
                    e_8 = _l.sent();
                    return [3 /*break*/, 15];
                case 15: return [4 /*yield*/, conn.getParsedAccountInfo(mintPubkey)];
                case 16:
                    mintInfo = _l.sent();
                    if (((_d = mintInfo.value) === null || _d === void 0 ? void 0 : _d.data) && 'parsed' in mintInfo.value.data) {
                        data = mintInfo.value.data.parsed;
                        // Check mint authority
                        if (((_e = data.info) === null || _e === void 0 ? void 0 : _e.mintAuthority) === null) {
                            result.mintAuthorityRevoked = true;
                        }
                        else if (((_f = data.info) === null || _f === void 0 ? void 0 : _f.mintAuthority) === deployer) {
                            result.rugpullIndicators.push('Deployer still has mint authority');
                        }
                        // Check freeze authority
                        if (((_g = data.info) === null || _g === void 0 ? void 0 : _g.freezeAuthority) === null) {
                            result.freezeAuthorityRevoked = true;
                        }
                        else if (((_h = data.info) === null || _h === void 0 ? void 0 : _h.freezeAuthority) === deployer) {
                            result.rugpullIndicators.push('Deployer can freeze accounts');
                        }
                    }
                    return [4 /*yield*/, conn.getTokenLargestAccounts(mintPubkey)];
                case 17:
                    largestAccounts = _l.sent();
                    if (!(largestAccounts.value.length > 0)) return [3 /*break*/, 21];
                    totalSupply = largestAccounts.value.reduce(function (sum, acc) { return sum + Number(acc.amount); }, 0);
                    topHolder = Number(largestAccounts.value[0].amount);
                    if (!(totalSupply > 0)) return [3 /*break*/, 21];
                    topHolderPercentage = (topHolder / totalSupply) * 100;
                    result.topHolderPercentage = topHolderPercentage;
                    // Check for concentrated holdings (rugpull indicator)
                    if (topHolderPercentage > 50) {
                        result.rugpullIndicators.push("Top holder owns ".concat(topHolderPercentage.toFixed(1), "% of supply"));
                    }
                    topHolderAccount = largestAccounts.value[0];
                    if (!topHolderAccount) return [3 /*break*/, 21];
                    _l.label = 18;
                case 18:
                    _l.trys.push([18, 20, , 21]);
                    return [4 /*yield*/, conn.getParsedAccountInfo(topHolderAccount.address)];
                case 19:
                    accountInfo = _l.sent();
                    if (((_j = accountInfo.value) === null || _j === void 0 ? void 0 : _j.data) && 'parsed' in accountInfo.value.data) {
                        owner = (_k = accountInfo.value.data.parsed.info) === null || _k === void 0 ? void 0 : _k.owner;
                        if (owner === deployer && topHolderPercentage > 20) {
                            result.rugpullIndicators.push("Deployer holds ".concat(topHolderPercentage.toFixed(1), "% of tokens"));
                        }
                    }
                    return [3 /*break*/, 21];
                case 20:
                    e_9 = _l.sent();
                    return [3 /*break*/, 21];
                case 21:
                    // Determine if this is likely a rugpull
                    result.isRugpull = result.rugpullIndicators.length >= 2 ||
                        result.rugpullIndicators.some(function (i) { return i.includes('50%') || i.includes('mint authority'); });
                    return [3 /*break*/, 23];
                case 22:
                    error_4 = _l.sent();
                    logger.error('Error analyzing token: ' + mint.slice(0, 8), error_4);
                    return [3 /*break*/, 23];
                case 23: return [2 /*return*/, result];
            }
        });
    });
}
// Trace funding chain - follow the money multiple hops back
function traceFundingChain(address_1) {
    return __awaiter(this, arguments, void 0, function (address, maxHops) {
        var chain, currentAddress, riskLevel, conn, hop, publicKey, allSignatures, lastSignature, options, sigs, oldestSig, tx, accountKeys, funder, _i, accountKeys_1, key, funderAge, deployerCheck, error_5;
        if (maxHops === void 0) { maxHops = 3; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chain = [address];
                    currentAddress = address;
                    riskLevel = 'low';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 11, , 12]);
                    conn = (0, blockchain_1.getConnection)();
                    hop = 0;
                    _a.label = 2;
                case 2:
                    if (!(hop < maxHops)) return [3 /*break*/, 10];
                    publicKey = new web3_js_1.PublicKey(currentAddress);
                    allSignatures = [];
                    lastSignature = void 0;
                    _a.label = 3;
                case 3:
                    if (!true) return [3 /*break*/, 5];
                    options = { limit: 1000 };
                    if (lastSignature)
                        options.before = lastSignature;
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, options)];
                case 4:
                    sigs = _a.sent();
                    if (sigs.length === 0)
                        return [3 /*break*/, 5];
                    allSignatures = allSignatures.concat(sigs);
                    lastSignature = sigs[sigs.length - 1].signature;
                    if (allSignatures.length >= 3000)
                        return [3 /*break*/, 5];
                    if (sigs.length < 1000)
                        return [3 /*break*/, 5];
                    return [3 /*break*/, 3];
                case 5:
                    if (allSignatures.length === 0)
                        return [3 /*break*/, 10];
                    // Get the oldest transaction (first funding)
                    // Check array is not empty before accessing
                    if (allSignatures.length === 0)
                        return [3 /*break*/, 10];
                    oldestSig = allSignatures[allSignatures.length - 1];
                    return [4 /*yield*/, conn.getParsedTransaction(oldestSig.signature, {
                            maxSupportedTransactionVersion: 0,
                        })];
                case 6:
                    tx = _a.sent();
                    if (!(tx === null || tx === void 0 ? void 0 : tx.transaction))
                        return [3 /*break*/, 10];
                    accountKeys = tx.transaction.message.accountKeys;
                    funder = null;
                    for (_i = 0, accountKeys_1 = accountKeys; _i < accountKeys_1.length; _i++) {
                        key = accountKeys_1[_i];
                        if (key.signer && key.pubkey.toBase58() !== currentAddress) {
                            funder = key.pubkey.toBase58();
                            break;
                        }
                    }
                    if (!funder || chain.includes(funder))
                        return [3 /*break*/, 10];
                    chain.push(funder);
                    currentAddress = funder;
                    return [4 /*yield*/, getWalletAge(funder)];
                case 7:
                    funderAge = _a.sent();
                    // Check both null/undefined and ensure it's a valid number
                    if (funderAge != null && !isNaN(funderAge) && funderAge < 7) {
                        riskLevel = 'high';
                    }
                    return [4 /*yield*/, checkIfDeployerEnhanced(funder)];
                case 8:
                    deployerCheck = _a.sent();
                    if (deployerCheck.deployedTokens.length > 5) {
                        riskLevel = 'critical';
                    }
                    _a.label = 9;
                case 9:
                    hop++;
                    return [3 /*break*/, 2];
                case 10: return [3 /*break*/, 12];
                case 11:
                    error_5 = _a.sent();
                    logger.error('Error tracing funding chain:', error_5);
                    return [3 /*break*/, 12];
                case 12: return [2 /*return*/, {
                        source: chain.length > 1 ? chain[chain.length - 1] : null,
                        chain: chain.slice(1), // Exclude the original address
                        risk: riskLevel,
                    }];
            }
        });
    });
}
// Get wallet age in days
function getWalletAge(address) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, publicKey, allSignatures, lastSignature, options, sigs, oldestSig, ageMs, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    conn = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    allSignatures = [];
                    lastSignature = void 0;
                    _a.label = 1;
                case 1:
                    if (!true) return [3 /*break*/, 3];
                    options = { limit: 1000 };
                    if (lastSignature)
                        options.before = lastSignature;
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, options)];
                case 2:
                    sigs = _a.sent();
                    if (sigs.length === 0)
                        return [3 /*break*/, 3];
                    allSignatures = allSignatures.concat(sigs);
                    lastSignature = sigs[sigs.length - 1].signature;
                    if (allSignatures.length >= 3000)
                        return [3 /*break*/, 3];
                    if (sigs.length < 1000)
                        return [3 /*break*/, 3];
                    return [3 /*break*/, 1];
                case 3:
                    // Check array is not empty before accessing
                    if (allSignatures.length === 0) {
                        return [2 /*return*/, null];
                    }
                    oldestSig = allSignatures[allSignatures.length - 1];
                    if (oldestSig === null || oldestSig === void 0 ? void 0 : oldestSig.blockTime) {
                        ageMs = Date.now() - (oldestSig.blockTime * 1000);
                        return [2 /*return*/, Math.floor(ageMs / (1000 * 60 * 60 * 24))];
                    }
                    return [2 /*return*/, null];
                case 4:
                    error_6 = _a.sent();
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
// Analyze wallet activity patterns
function analyzeWalletActivity(address) {
    return __awaiter(this, void 0, void 0, function () {
        var conn, publicKey, signatures, result, oldestSig, newestSig, ageMs, uniqueAddresses, lastTxTime, rapidFireCount, i, sig, timeDiff, tx, accountKeys, preBalances, postBalances, ourIndex, change, _i, accountKeys_2, key, addr, e_10, intervals, i, currentTime, nextTime, avgInterval_1, regularCount, error_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    conn = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: 500 })];
                case 1:
                    signatures = _a.sent();
                    if (signatures.length === 0)
                        return [2 /*return*/, null];
                    result = {
                        totalTransactions: signatures.length,
                        accountAge: 0,
                        avgDailyTransactions: 0,
                        largestOutflow: 0,
                        largestInflow: 0,
                        uniqueInteractions: 0,
                        suspiciousTimingCount: 0,
                        rapidFireTransactions: 0,
                    };
                    oldestSig = signatures[signatures.length - 1];
                    newestSig = signatures[0];
                    if (oldestSig.blockTime) {
                        ageMs = Date.now() - (oldestSig.blockTime * 1000);
                        result.accountAge = Math.max(1, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
                        result.avgDailyTransactions = signatures.length / result.accountAge;
                    }
                    uniqueAddresses = new Set();
                    lastTxTime = 0;
                    rapidFireCount = 0;
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < Math.min(signatures.length, 100))) return [3 /*break*/, 7];
                    sig = signatures[i];
                    // Check for rapid-fire transactions (< 10 seconds apart)
                    if (sig.blockTime && lastTxTime > 0) {
                        timeDiff = lastTxTime - sig.blockTime;
                        if (timeDiff < 10) {
                            rapidFireCount++;
                        }
                    }
                    lastTxTime = sig.blockTime || 0;
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, conn.getParsedTransaction(sig.signature, {
                            maxSupportedTransactionVersion: 0,
                        })];
                case 4:
                    tx = _a.sent();
                    if ((tx === null || tx === void 0 ? void 0 : tx.meta) && tx.transaction) {
                        accountKeys = tx.transaction.message.accountKeys;
                        preBalances = tx.meta.preBalances;
                        postBalances = tx.meta.postBalances;
                        ourIndex = accountKeys.findIndex(function (k) { return k.pubkey.toBase58() === address; });
                        if (ourIndex !== -1) {
                            change = (postBalances[ourIndex] - preBalances[ourIndex]) / web3_js_1.LAMPORTS_PER_SOL;
                            if (change > 0 && change > result.largestInflow) {
                                result.largestInflow = change;
                            }
                            else if (change < 0 && Math.abs(change) > result.largestOutflow) {
                                result.largestOutflow = Math.abs(change);
                            }
                        }
                        // Track unique interactions
                        for (_i = 0, accountKeys_2 = accountKeys; _i < accountKeys_2.length; _i++) {
                            key = accountKeys_2[_i];
                            addr = key.pubkey.toBase58();
                            if (addr !== address && !addr.startsWith('1111') && !addr.startsWith('Token')) {
                                uniqueAddresses.add(addr);
                            }
                        }
                    }
                    return [3 /*break*/, 6];
                case 5:
                    e_10 = _a.sent();
                    return [3 /*break*/, 6];
                case 6:
                    i++;
                    return [3 /*break*/, 2];
                case 7:
                    result.rapidFireTransactions = rapidFireCount;
                    result.uniqueInteractions = uniqueAddresses.size;
                    // Check for suspicious timing patterns (transactions at exact intervals)
                    if (signatures.length >= 10) {
                        intervals = [];
                        for (i = 0; i < Math.min(signatures.length - 1, 20); i++) {
                            currentTime = signatures[i].blockTime;
                            nextTime = signatures[i + 1].blockTime;
                            if (currentTime !== null && currentTime !== undefined && nextTime !== null && nextTime !== undefined) {
                                intervals.push(currentTime - nextTime);
                            }
                        }
                        // Check if intervals are suspiciously regular (bot behavior)
                        if (intervals.length >= 5) {
                            avgInterval_1 = intervals.reduce(function (a, b) { return a + b; }, 0) / intervals.length;
                            regularCount = intervals.filter(function (i) { return Math.abs(i - avgInterval_1) < 5; }).length;
                            if (regularCount > intervals.length * 0.7) {
                                result.suspiciousTimingCount = regularCount;
                            }
                        }
                    }
                    return [2 /*return*/, result];
                case 8:
                    error_7 = _a.sent();
                    logger.error('Error analyzing wallet activity:', error_7);
                    return [2 /*return*/, null];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function findConnectedWalletsEnhanced(address) {
    return __awaiter(this, void 0, void 0, function () {
        var connections, conn, publicKey, signatures, _i, _a, sigInfo, tx, accountKeys, preBalances, postBalances, txTime, ourIndex, ourChange, i, otherAddr, otherChange, existing, e_11, error_8;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    connections = new Map();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 9, , 10]);
                    conn = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: 200 })];
                case 2:
                    signatures = _b.sent();
                    _i = 0, _a = signatures.slice(0, 75);
                    _b.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 8];
                    sigInfo = _a[_i];
                    _b.label = 4;
                case 4:
                    _b.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, conn.getParsedTransaction(sigInfo.signature, {
                            maxSupportedTransactionVersion: 0,
                        })];
                case 5:
                    tx = _b.sent();
                    if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                        return [3 /*break*/, 7];
                    accountKeys = tx.transaction.message.accountKeys;
                    preBalances = tx.meta.preBalances;
                    postBalances = tx.meta.postBalances;
                    txTime = sigInfo.blockTime || 0;
                    ourIndex = accountKeys.findIndex(function (k) { return k.pubkey.toBase58() === address; });
                    if (ourIndex === -1)
                        return [3 /*break*/, 7];
                    ourChange = (postBalances[ourIndex] - preBalances[ourIndex]) / web3_js_1.LAMPORTS_PER_SOL;
                    for (i = 0; i < accountKeys.length; i++) {
                        if (i === ourIndex)
                            continue;
                        otherAddr = accountKeys[i].pubkey.toBase58();
                        // Skip system accounts
                        if (otherAddr.startsWith('1111') || otherAddr.startsWith('Token') ||
                            otherAddr.startsWith('Sysvar') || otherAddr.startsWith('Compute') ||
                            otherAddr.startsWith('So1') || otherAddr.startsWith('Vote')) {
                            continue;
                        }
                        otherChange = (postBalances[i] - preBalances[i]) / web3_js_1.LAMPORTS_PER_SOL;
                        if (Math.abs(otherChange) < 0.001 && Math.abs(ourChange) < 0.001)
                            continue;
                        existing = connections.get(otherAddr) || {
                            sent: 0, received: 0, count: 0, txSignatures: []
                        };
                        existing.count++;
                        existing.txSignatures.push(sigInfo.signature);
                        // Track timing
                        if (!existing.firstTime || txTime < existing.firstTime) {
                            existing.firstTime = txTime;
                        }
                        if (!existing.lastTime || txTime > existing.lastTime) {
                            existing.lastTime = txTime;
                        }
                        if (ourChange > 0 && otherChange < 0) {
                            existing.received += Math.abs(ourChange);
                        }
                        else if (ourChange < 0 && otherChange > 0) {
                            existing.sent += Math.abs(ourChange);
                        }
                        connections.set(otherAddr, existing);
                    }
                    return [3 /*break*/, 7];
                case 6:
                    e_11 = _b.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_8 = _b.sent();
                    logger.error('Error finding connected wallets:', error_8);
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/, connections];
            }
        });
    });
}
// Enhanced connected wallet analysis
function analyzeConnectedWalletsEnhanced(connections, originalAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var results, sorted, _i, sorted_1, _a, addr, data, deployerCheck, goPlusCheck, rugCheck, riskReasons, riskScore, pattern, _b, _c, rug, mintShort, rugTypeLabel, tokenCount, riskLevel, e_12;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    results = [];
                    sorted = Array.from(connections.entries())
                        .filter(function (_a) {
                        var addr = _a[0], data = _a[1];
                        return data.count >= 2 || data.sent > 0.5 || data.received > 0.5;
                    })
                        .sort(function (a, b) {
                        var aTotal = a[1].sent + a[1].received + a[1].count;
                        var bTotal = b[1].sent + b[1].received + b[1].count;
                        return bTotal - aTotal;
                    })
                        .slice(0, 15);
                    _i = 0, sorted_1 = sorted;
                    _e.label = 1;
                case 1:
                    if (!(_i < sorted_1.length)) return [3 /*break*/, 8];
                    _a = sorted_1[_i], addr = _a[0], data = _a[1];
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, quickDeployerCheck(addr)];
                case 3:
                    deployerCheck = _e.sent();
                    return [4 /*yield*/, checkGoPlusSecurity(addr)];
                case 4:
                    goPlusCheck = _e.sent();
                    return [4 /*yield*/, detectRugInvolvementsFast(addr)];
                case 5:
                    rugCheck = _e.sent();
                    riskReasons = [];
                    riskScore = 0;
                    pattern = void 0;
                    // RUG DETECTION - Highest priority
                    if (rugCheck.isLpRugger) {
                        riskReasons.push('🚨 LP RUGGER: Has pulled liquidity from pools');
                        riskScore += 70;
                        pattern = '🔴 LP Rugger';
                    }
                    if (rugCheck.isHoneypotCreator) {
                        riskReasons.push('🍯 HONEYPOT CREATOR: Created tokens that trap buyers');
                        riskScore += 70;
                        pattern = '🍯 Honeypot Creator';
                    }
                    // Add specific rug involvement details
                    for (_b = 0, _c = rugCheck.rugInvolvements.slice(0, 3); _b < _c.length; _b++) {
                        rug = _c[_b];
                        mintShort = "".concat(rug.tokenMint.slice(0, 6), "...").concat(rug.tokenMint.slice(-4));
                        rugTypeLabel = getRugTypeLabel(rug.rugType);
                        if (rug.role === 'deployer') {
                            riskReasons.push("\uD83D\uDC80 ".concat(rugTypeLabel, ": Deployed rugged token ").concat(mintShort));
                            riskScore += 40;
                        }
                        else if (rug.role === 'lp_remover') {
                            riskReasons.push("\uD83D\uDCA7 Removed LP: ".concat(((_d = rug.amount) === null || _d === void 0 ? void 0 : _d.toFixed(2)) || '?', " XNT from ").concat(mintShort));
                            riskScore += 50;
                        }
                        else if (rug.role === 'dumper') {
                            riskReasons.push("\uD83D\uDCC9 Dumped tokens: ".concat(mintShort));
                            riskScore += 30;
                        }
                    }
                    if (rugCheck.rugCount > 3) {
                        riskReasons.push("\u26A0\uFE0F Involved in ".concat(rugCheck.rugCount, " rug incidents total"));
                        riskScore += 20;
                    }
                    // Deployer analysis with severity
                    if (deployerCheck.isDeployer && !rugCheck.isLpRugger && !rugCheck.isHoneypotCreator) {
                        tokenCount = deployerCheck.tokenCount;
                        if (tokenCount > 10) {
                            riskReasons.push("\uD83D\uDEA8 Serial deployer: ".concat(tokenCount, "+ tokens (HIGH RISK)"));
                            riskScore += 60;
                            if (!pattern)
                                pattern = 'Serial Token Deployer';
                        }
                        else if (tokenCount > 3) {
                            riskReasons.push("\u26A0\uFE0F Multiple tokens deployed: ".concat(tokenCount));
                            riskScore += 35;
                            if (!pattern)
                                pattern = 'Token Deployer';
                        }
                        else {
                            riskReasons.push("\uD83D\uDCDD Token deployer: ".concat(tokenCount, " token(s)"));
                            riskScore += 15;
                        }
                    }
                    // GoPlus warnings
                    if (goPlusCheck) {
                        if (goPlusCheck.hasBlacklistHistory) {
                            riskReasons.push('🚫 BLACKLISTED ADDRESS');
                            riskScore += 50;
                            if (!pattern)
                                pattern = 'Known Scammer';
                        }
                        if (goPlusCheck.maliciousActivity) {
                            riskReasons.push('💀 Malicious activity on record');
                            riskScore += 45;
                            if (!pattern)
                                pattern = 'Malicious Actor';
                        }
                        riskReasons.push.apply(riskReasons, goPlusCheck.warnings);
                    }
                    // Value transfer analysis
                    if (data.sent > 50) {
                        riskReasons.push("\uD83D\uDCB8 Sent you ".concat(data.sent.toFixed(2), " XNT"));
                        if (!pattern)
                            pattern = 'Major Funder';
                    }
                    if (data.received > 50) {
                        riskReasons.push("\uD83D\uDCB8 Received ".concat(data.received.toFixed(2), " XNT from you"));
                        if (!pattern)
                            pattern = 'Fund Recipient';
                        riskScore += 5;
                    }
                    // Check for dump pattern (received large amount, many interactions)
                    if (data.received > 10 && data.count > 5 && data.sent < 1) {
                        riskReasons.push('📤 One-way outflow pattern (possible dump address)');
                        riskScore += 20;
                        if (!pattern)
                            pattern = 'Dump Recipient';
                    }
                    // Check for wash trading pattern (back and forth)
                    if (data.sent > 5 && data.received > 5 && data.count > 10) {
                        riskReasons.push('🔄 Circular transaction pattern detected');
                        riskScore += 25;
                        if (!pattern)
                            pattern = 'Wash Trading Partner';
                    }
                    riskLevel = 'low';
                    if (riskScore >= 60)
                        riskLevel = 'critical';
                    else if (riskScore >= 40)
                        riskLevel = 'high';
                    else if (riskScore >= 15)
                        riskLevel = 'medium';
                    results.push({
                        address: addr,
                        interactionCount: data.count,
                        totalValueSent: data.sent,
                        totalValueReceived: data.received,
                        isDeployer: deployerCheck.isDeployer,
                        deployedTokenCount: deployerCheck.tokenCount,
                        riskLevel: riskLevel,
                        riskReasons: riskReasons,
                        firstInteraction: data.firstTime ? new Date(data.firstTime * 1000) : undefined,
                        lastInteraction: data.lastTime ? new Date(data.lastTime * 1000) : undefined,
                        pattern: pattern,
                        rugInvolvements: rugCheck.rugInvolvements,
                        isLpRugger: rugCheck.isLpRugger,
                        isHoneypotCreator: rugCheck.isHoneypotCreator,
                        rugCount: rugCheck.rugCount,
                    });
                    return [3 /*break*/, 7];
                case 6:
                    e_12 = _e.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 1];
                case 8:
                    // Sort by risk level (critical/high first), then by rug count
                    results.sort(function (a, b) {
                        var order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
                        var levelDiff = order[a.riskLevel] - order[b.riskLevel];
                        if (levelDiff !== 0)
                            return levelDiff;
                        return b.rugCount - a.rugCount;
                    });
                    return [2 /*return*/, results];
            }
        });
    });
}
// Get human-readable label for rug type
function getRugTypeLabel(rugType) {
    switch (rugType) {
        case 'lp_pull': return 'LP RUG';
        case 'honeypot': return 'HONEYPOT';
        case 'mint_dump': return 'MINT & DUMP';
        case 'dev_dump': return 'DEV DUMP';
        case 'soft_rug': return 'SOFT RUG';
        case 'coordinated_dump': return 'COORDINATED DUMP';
        default: return 'UNKNOWN RUG';
    }
}
// ============================================
// OPTIMIZED FAST FUNCTIONS WITH CACHING
// ============================================
// Detect LP rug activity on a wallet
function detectLpRugActivity(address) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, cached, totalLpWithdrawals, lpBurns, largeDumps, evidence, lpRugTimestamp, conn_1, signatures, txPromises, transactions, i, tx, sigInfo, accountKeys, involvedPrograms, isAmmTx, ourIndex, balanceChange, _loop_1, _i, _a, pre, error_9, isLpRugger, result;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    logger.info('Starting LP rug detection for: ' + address.slice(0, 8) + '...');
                    cacheKey = "lp_rug:".concat(address);
                    cached = cache_1.cache.get(cacheKey);
                    if (cached) {
                        logger.info('⚡ Using cached LP rug result');
                        return [2 /*return*/, cached];
                    }
                    totalLpWithdrawals = 0;
                    lpBurns = 0;
                    largeDumps = 0;
                    evidence = [];
                    lpRugTimestamp = null;
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    conn_1 = (0, blockchain_1.getConnection)();
                    return [4 /*yield*/, conn_1.getSignaturesForAddress(new web3_js_1.PublicKey(address), { limit: 50 })];
                case 2:
                    signatures = _b.sent();
                    txPromises = signatures.slice(0, 30).map(function (sig) {
                        return (0, cache_1.withCache)(cache_1.CacheKeys.transaction(sig.signature), cache_1.CacheTTL.VERY_LONG, function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, conn_1.getParsedTransaction(sig.signature, {
                                                maxSupportedTransactionVersion: 0,
                                            })];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, null];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                    });
                    return [4 /*yield*/, Promise.all(txPromises)];
                case 3:
                    transactions = _b.sent();
                    for (i = 0; i < transactions.length; i++) {
                        tx = transactions[i];
                        sigInfo = signatures[i];
                        if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                            continue;
                        accountKeys = tx.transaction.message.accountKeys;
                        involvedPrograms = accountKeys.map(function (k) { return k.pubkey.toBase58(); });
                        isAmmTx = involvedPrograms.some(function (p) { return DEX_PROGRAMS.includes(p); });
                        if (isAmmTx) {
                            ourIndex = accountKeys.findIndex(function (k) { return k.pubkey.toBase58() === address; });
                            if (ourIndex !== -1) {
                                balanceChange = (tx.meta.postBalances[ourIndex] - tx.meta.preBalances[ourIndex]) / web3_js_1.LAMPORTS_PER_SOL;
                                if (balanceChange > 5) {
                                    totalLpWithdrawals += balanceChange;
                                    // Capture the earliest LP withdrawal timestamp
                                    if (!lpRugTimestamp && sigInfo.blockTime) {
                                        lpRugTimestamp = sigInfo.blockTime;
                                    }
                                }
                                if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
                                    _loop_1 = function (pre) {
                                        if (pre.owner !== address)
                                            return "continue";
                                        var preAmount = Number(pre.uiTokenAmount.uiAmount || 0);
                                        var post = tx.meta.postTokenBalances.find(function (p) { return p.accountIndex === pre.accountIndex; });
                                        var postAmount = post ? Number(post.uiTokenAmount.uiAmount || 0) : 0;
                                        // LP token burn: large amount going to 0 or near 0
                                        // Lowered threshold from 1M to 100 tokens - even small LP positions matter
                                        if (preAmount > 100 && postAmount < preAmount * 0.01) {
                                            lpBurns++;
                                            // Capture burn timestamp
                                            if (!lpRugTimestamp && sigInfo.blockTime) {
                                                lpRugTimestamp = sigInfo.blockTime;
                                            }
                                        }
                                        // Full dump: 100% of tokens sold (from any amount > 1)
                                        if (preAmount > 1 && postAmount === 0) {
                                            largeDumps++;
                                            // Capture dump timestamp
                                            if (!lpRugTimestamp && sigInfo.blockTime) {
                                                lpRugTimestamp = sigInfo.blockTime;
                                            }
                                        }
                                        // Large dump: >90% sold (more aggressive than 50%)
                                        else if (preAmount > 10 && postAmount < preAmount * 0.1) {
                                            largeDumps++;
                                            // Capture dump timestamp
                                            if (!lpRugTimestamp && sigInfo.blockTime) {
                                                lpRugTimestamp = sigInfo.blockTime;
                                            }
                                        }
                                    };
                                    for (_i = 0, _a = tx.meta.preTokenBalances; _i < _a.length; _i++) {
                                        pre = _a[_i];
                                        _loop_1(pre);
                                    }
                                }
                            }
                        }
                    }
                    if (totalLpWithdrawals > 0) {
                        evidence.push("Withdrew ~".concat(totalLpWithdrawals.toFixed(2), " XNT from LP"));
                    }
                    if (lpBurns > 0) {
                        evidence.push("Burned LP tokens ".concat(lpBurns, " time(s)"));
                    }
                    if (largeDumps > 0) {
                        evidence.push("".concat(largeDumps, " large token dumps"));
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_9 = _b.sent();
                    logger.error('Error detecting LP rug:', error_9);
                    return [3 /*break*/, 5];
                case 5:
                    isLpRugger = totalLpWithdrawals > 10 ||
                        lpBurns > 0 ||
                        (totalLpWithdrawals > 3 && largeDumps >= 1) ||
                        largeDumps >= 2;
                    logger.info("\uD83D\uDCA7 LP Detection results: withdrawn=".concat(totalLpWithdrawals.toFixed(2), ", burns=").concat(lpBurns, ", dumps=").concat(largeDumps, ", isRugger=").concat(isLpRugger));
                    result = {
                        isLpRugger: isLpRugger,
                        totalWithdrawn: totalLpWithdrawals,
                        lpBurns: lpBurns,
                        largeDumps: largeDumps,
                        evidence: evidence,
                        timestamp: lpRugTimestamp, // Include timestamp in result
                    };
                    cache_1.cache.set(cacheKey, result, cache_1.CacheTTL.MEDIUM);
                    return [2 /*return*/, result];
            }
        });
    });
}
// Cached GoPlus security check
function checkGoPlusSecurityCached(address) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey;
        return __generator(this, function (_a) {
            cacheKey = "goplus:".concat(address);
            return [2 /*return*/, (0, cache_1.withCache)(cacheKey, cache_1.CacheTTL.MEDIUM, function () { return checkGoPlusSecurity(address); })];
        });
    });
}
// Fast deployer check - IMPROVED: scans multiple batches to find token deployments
function checkIfDeployerFast(address) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, cached, deployedTokens, tokenAnalysis, conn_2, publicKey, allSignatures, recentSigs, lastSig, maxBatches, batch, olderSigs, e_13, reversedSignatures, txLimit, txPromises, transactions, _i, transactions_1, tx, accountKeys, feePayer, isFeePayer, checkInstruction, _a, _b, ix, _c, _d, inner, _e, _f, ix, analysisPromises, analyses, error_10, result;
        var _this = this;
        var _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    cacheKey = cache_1.CacheKeys.deployerStatus(address);
                    cached = cache_1.cache.get(cacheKey);
                    if (cached)
                        return [2 /*return*/, cached];
                    deployedTokens = [];
                    tokenAnalysis = [];
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 13, , 14]);
                    conn_2 = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    allSignatures = [];
                    return [4 /*yield*/, conn_2.getSignaturesForAddress(publicKey, { limit: 100 })];
                case 2:
                    recentSigs = _h.sent();
                    allSignatures = recentSigs;
                    if (!(recentSigs.length >= 100)) return [3 /*break*/, 9];
                    _h.label = 3;
                case 3:
                    _h.trys.push([3, 8, , 9]);
                    lastSig = recentSigs[recentSigs.length - 1].signature;
                    maxBatches = 30;
                    batch = 0;
                    _h.label = 4;
                case 4:
                    if (!(batch < maxBatches)) return [3 /*break*/, 7];
                    return [4 /*yield*/, conn_2.getSignaturesForAddress(publicKey, {
                            limit: 100,
                            before: lastSig
                        })];
                case 5:
                    olderSigs = _h.sent();
                    if (olderSigs.length === 0)
                        return [3 /*break*/, 7];
                    allSignatures = allSignatures.concat(olderSigs);
                    lastSig = olderSigs[olderSigs.length - 1].signature;
                    // If we got less than 100, we've reached the end of the wallet's history
                    if (olderSigs.length < 100)
                        return [3 /*break*/, 7];
                    _h.label = 6;
                case 6:
                    batch++;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 9];
                case 8:
                    e_13 = _h.sent();
                    return [3 /*break*/, 9];
                case 9:
                    logger.info("\uD83D\uDD0D Scanning ".concat(allSignatures.length, " signatures for deployments..."));
                    reversedSignatures = __spreadArray([], allSignatures, true).reverse();
                    txLimit = Math.min(reversedSignatures.length, 400);
                    logger.info("\uD83D\uDD0D Processing ".concat(txLimit, " transactions from oldest history..."));
                    txPromises = reversedSignatures.slice(0, txLimit).map(function (sigInfo) { return __awaiter(_this, void 0, void 0, function () {
                        var txCacheKey;
                        var _this = this;
                        return __generator(this, function (_a) {
                            txCacheKey = cache_1.CacheKeys.transaction(sigInfo.signature);
                            return [2 /*return*/, (0, cache_1.withCache)(txCacheKey, cache_1.CacheTTL.VERY_LONG, function () { return __awaiter(_this, void 0, void 0, function () {
                                    var _a;
                                    return __generator(this, function (_b) {
                                        switch (_b.label) {
                                            case 0:
                                                _b.trys.push([0, 2, , 3]);
                                                return [4 /*yield*/, conn_2.getParsedTransaction(sigInfo.signature, {
                                                        maxSupportedTransactionVersion: 0,
                                                    })];
                                            case 1: return [2 /*return*/, _b.sent()];
                                            case 2:
                                                _a = _b.sent();
                                                return [2 /*return*/, null];
                                            case 3: return [2 /*return*/];
                                        }
                                    });
                                }); })];
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(txPromises)];
                case 10:
                    transactions = _h.sent();
                    // Analyze transactions for token deployments
                    for (_i = 0, transactions_1 = transactions; _i < transactions_1.length; _i++) {
                        tx = transactions_1[_i];
                        if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                            continue;
                        accountKeys = tx.transaction.message.accountKeys;
                        feePayer = (_g = accountKeys[0]) === null || _g === void 0 ? void 0 : _g.pubkey.toBase58();
                        isFeePayer = feePayer === address;
                        // Skip if this wallet didn't initiate the transaction
                        if (!isFeePayer)
                            continue;
                        checkInstruction = function (ix) {
                            var _a, _b;
                            if ('parsed' in ix && ix.parsed) {
                                var parsed = ix.parsed;
                                if ((parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') && ((_a = parsed.info) === null || _a === void 0 ? void 0 : _a.mint)) {
                                    // Additional verification: check if mint authority is set to this address
                                    var mintAuthority = (_b = parsed.info) === null || _b === void 0 ? void 0 : _b.mintAuthority;
                                    var isMintAuthority = !mintAuthority || mintAuthority === address;
                                    // Only count if this address is the fee payer AND (mint authority or not specified)
                                    if (isMintAuthority && !deployedTokens.includes(parsed.info.mint)) {
                                        deployedTokens.push(parsed.info.mint);
                                        logger.info("\uD83E\uDE99 Found deployed token: ".concat(parsed.info.mint.slice(0, 8), "... (deployed by ").concat(address.slice(0, 8), "...)"));
                                    }
                                }
                            }
                        };
                        for (_a = 0, _b = tx.transaction.message.instructions; _a < _b.length; _a++) {
                            ix = _b[_a];
                            checkInstruction(ix);
                        }
                        if (tx.meta.innerInstructions) {
                            for (_c = 0, _d = tx.meta.innerInstructions; _c < _d.length; _c++) {
                                inner = _d[_c];
                                for (_e = 0, _f = inner.instructions; _e < _f.length; _e++) {
                                    ix = _f[_e];
                                    checkInstruction(ix);
                                }
                            }
                        }
                    }
                    if (!(deployedTokens.length > 0)) return [3 /*break*/, 12];
                    analysisPromises = deployedTokens.slice(0, 5).map(function (mint) {
                        return analyzeDeployedTokenCached(mint, address);
                    });
                    return [4 /*yield*/, Promise.all(analysisPromises)];
                case 11:
                    analyses = _h.sent();
                    tokenAnalysis.push.apply(tokenAnalysis, analyses);
                    _h.label = 12;
                case 12: return [3 /*break*/, 14];
                case 13:
                    error_10 = _h.sent();
                    logger.error('Error in fast deployer check:', error_10);
                    return [3 /*break*/, 14];
                case 14:
                    result = {
                        isDeployer: deployedTokens.length > 0,
                        deployedTokens: deployedTokens,
                        tokenAnalysis: tokenAnalysis,
                    };
                    cache_1.cache.set(cacheKey, result, cache_1.CacheTTL.MEDIUM);
                    return [2 /*return*/, result];
            }
        });
    });
}
// Cached token analysis
function analyzeDeployedTokenCached(mint, deployer) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey;
        return __generator(this, function (_a) {
            cacheKey = cache_1.CacheKeys.tokenAnalysis(mint);
            return [2 /*return*/, (0, cache_1.withCache)(cacheKey, cache_1.CacheTTL.LONG, function () { return analyzeDeployedToken(mint, deployer); })];
        });
    });
}
// Fast funding chain trace - reduced hops
function traceFundingChainFast(address_1) {
    return __awaiter(this, arguments, void 0, function (address, maxHops) {
        var chain, currentAddress, riskLevel, conn_3, _loop_2, hop, state_1, error_11;
        var _this = this;
        if (maxHops === void 0) { maxHops = 2; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chain = [address];
                    currentAddress = address;
                    riskLevel = 'low';
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    conn_3 = (0, blockchain_1.getConnection)();
                    _loop_2 = function (hop) {
                        var publicKey, signatures, oldestSig, tx, accountKeys, funder, KNOWN_PROGRAMS, isTokenAccount, _i, accountKeys_3, key, addr, isToken, _b, accountKeys_4, key, addr, isToken;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    publicKey = new web3_js_1.PublicKey(currentAddress);
                                    return [4 /*yield*/, conn_3.getSignaturesForAddress(publicKey, { limit: 100 })];
                                case 1:
                                    signatures = _c.sent();
                                    if (signatures.length === 0)
                                        return [2 /*return*/, "break"];
                                    oldestSig = signatures[signatures.length - 1];
                                    return [4 /*yield*/, (0, cache_1.withCache)(cache_1.CacheKeys.transaction(oldestSig.signature), cache_1.CacheTTL.VERY_LONG, function () { return __awaiter(_this, void 0, void 0, function () {
                                            var _a;
                                            return __generator(this, function (_b) {
                                                switch (_b.label) {
                                                    case 0:
                                                        _b.trys.push([0, 2, , 3]);
                                                        return [4 /*yield*/, conn_3.getParsedTransaction(oldestSig.signature, {
                                                                maxSupportedTransactionVersion: 0,
                                                            })];
                                                    case 1: return [2 /*return*/, _b.sent()];
                                                    case 2:
                                                        _a = _b.sent();
                                                        return [2 /*return*/, null];
                                                    case 3: return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 2:
                                    tx = _c.sent();
                                    if (!(tx === null || tx === void 0 ? void 0 : tx.transaction))
                                        return [2 /*return*/, "break"];
                                    accountKeys = tx.transaction.message.accountKeys;
                                    funder = null;
                                    KNOWN_PROGRAMS = new Set([
                                        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
                                        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022 Program
                                        'memoX1sJsBY6od7CfQ58XooRALwnocAZen4L7mW1ick', // Memo Program
                                        '11111111111111111111111111111111', // System Program
                                        'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token Program
                                        'ComputeBudget111111111111111111111111111111', // Compute Budget Program
                                        'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', // Memo Program (old)
                                    ]);
                                    isTokenAccount = function (addr) { return __awaiter(_this, void 0, void 0, function () {
                                        var accountInfo, owner, _a;
                                        return __generator(this, function (_b) {
                                            switch (_b.label) {
                                                case 0:
                                                    _b.trys.push([0, 2, , 3]);
                                                    return [4 /*yield*/, conn_3.getAccountInfo(new web3_js_1.PublicKey(addr))];
                                                case 1:
                                                    accountInfo = _b.sent();
                                                    if (!accountInfo)
                                                        return [2 /*return*/, false];
                                                    owner = accountInfo.owner.toBase58();
                                                    return [2 /*return*/, owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
                                                            owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'];
                                                case 2:
                                                    _a = _b.sent();
                                                    return [2 /*return*/, false];
                                                case 3: return [2 /*return*/];
                                            }
                                        });
                                    }); };
                                    _i = 0, accountKeys_3 = accountKeys;
                                    _c.label = 3;
                                case 3:
                                    if (!(_i < accountKeys_3.length)) return [3 /*break*/, 6];
                                    key = accountKeys_3[_i];
                                    addr = key.pubkey.toBase58();
                                    // Skip if it's a known program address
                                    if (KNOWN_PROGRAMS.has(addr))
                                        return [3 /*break*/, 5];
                                    if (!(key.signer && addr !== currentAddress)) return [3 /*break*/, 5];
                                    return [4 /*yield*/, isTokenAccount(addr)];
                                case 4:
                                    isToken = _c.sent();
                                    if (!isToken) {
                                        funder = addr;
                                        return [3 /*break*/, 6];
                                    }
                                    _c.label = 5;
                                case 5:
                                    _i++;
                                    return [3 /*break*/, 3];
                                case 6:
                                    if (!!funder) return [3 /*break*/, 10];
                                    _b = 0, accountKeys_4 = accountKeys;
                                    _c.label = 7;
                                case 7:
                                    if (!(_b < accountKeys_4.length)) return [3 /*break*/, 10];
                                    key = accountKeys_4[_b];
                                    addr = key.pubkey.toBase58();
                                    // Skip if it's a known program address
                                    if (KNOWN_PROGRAMS.has(addr))
                                        return [3 /*break*/, 9];
                                    if (!(key.writable && addr !== currentAddress && !addr.startsWith('11111111'))) return [3 /*break*/, 9];
                                    return [4 /*yield*/, isTokenAccount(addr)];
                                case 8:
                                    isToken = _c.sent();
                                    if (!isToken) {
                                        funder = addr;
                                        return [3 /*break*/, 10];
                                    }
                                    _c.label = 9;
                                case 9:
                                    _b++;
                                    return [3 /*break*/, 7];
                                case 10:
                                    if (!funder)
                                        return [2 /*return*/, "break"];
                                    if (chain.includes(funder))
                                        return [2 /*return*/, "break"];
                                    chain.push(funder);
                                    currentAddress = funder;
                                    return [2 /*return*/];
                            }
                        });
                    };
                    hop = 0;
                    _a.label = 2;
                case 2:
                    if (!(hop < maxHops)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_2(hop)];
                case 3:
                    state_1 = _a.sent();
                    if (state_1 === "break")
                        return [3 /*break*/, 5];
                    _a.label = 4;
                case 4:
                    hop++;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_11 = _a.sent();
                    logger.error('Error tracing funding chain:', error_11);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, {
                        source: chain.length > 1 ? chain[chain.length - 1] : null,
                        chain: chain.slice(1),
                        risk: riskLevel,
                    }];
            }
        });
    });
}
// Fast wallet activity analysis - reduced scope
function analyzeWalletActivityFast(address) {
    return __awaiter(this, void 0, void 0, function () {
        var conn_4, publicKey, signatures, result, oldestSig, ageMs, uniqueAddresses, lastTxTime, rapidFireCount, txPromises, transactions, i, sig, tx, timeDiff, accountKeys, preBalances, postBalances, ourIndex, change, _i, accountKeys_5, key, addr, error_12;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    conn_4 = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn_4.getSignaturesForAddress(publicKey, { limit: 100 })];
                case 1:
                    signatures = _a.sent();
                    if (signatures.length === 0)
                        return [2 /*return*/, null];
                    result = {
                        totalTransactions: signatures.length,
                        accountAge: 0,
                        avgDailyTransactions: 0,
                        largestOutflow: 0,
                        largestInflow: 0,
                        uniqueInteractions: 0,
                        suspiciousTimingCount: 0,
                        rapidFireTransactions: 0,
                    };
                    oldestSig = signatures[signatures.length - 1];
                    if (oldestSig.blockTime) {
                        ageMs = Date.now() - (oldestSig.blockTime * 1000);
                        result.accountAge = Math.max(1, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
                        result.avgDailyTransactions = signatures.length / result.accountAge;
                    }
                    uniqueAddresses = new Set();
                    lastTxTime = 0;
                    rapidFireCount = 0;
                    txPromises = signatures.slice(0, 20).map(function (sig) {
                        return (0, cache_1.withCache)(cache_1.CacheKeys.transaction(sig.signature), cache_1.CacheTTL.VERY_LONG, function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, conn_4.getParsedTransaction(sig.signature, {
                                                maxSupportedTransactionVersion: 0,
                                            })];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, null];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                    });
                    return [4 /*yield*/, Promise.all(txPromises)];
                case 2:
                    transactions = _a.sent();
                    for (i = 0; i < signatures.length && i < 20; i++) {
                        sig = signatures[i];
                        tx = transactions[i];
                        // Check for rapid-fire transactions
                        if (sig.blockTime && lastTxTime > 0) {
                            timeDiff = lastTxTime - sig.blockTime;
                            if (timeDiff < 10)
                                rapidFireCount++;
                        }
                        lastTxTime = sig.blockTime || 0;
                        if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                            continue;
                        accountKeys = tx.transaction.message.accountKeys;
                        preBalances = tx.meta.preBalances;
                        postBalances = tx.meta.postBalances;
                        ourIndex = accountKeys.findIndex(function (k) { return k.pubkey.toBase58() === address; });
                        if (ourIndex !== -1) {
                            change = (postBalances[ourIndex] - preBalances[ourIndex]) / web3_js_1.LAMPORTS_PER_SOL;
                            if (change > 0 && change > result.largestInflow) {
                                result.largestInflow = change;
                            }
                            else if (change < 0 && Math.abs(change) > result.largestOutflow) {
                                result.largestOutflow = Math.abs(change);
                            }
                        }
                        // Track unique interactions
                        for (_i = 0, accountKeys_5 = accountKeys; _i < accountKeys_5.length; _i++) {
                            key = accountKeys_5[_i];
                            addr = key.pubkey.toBase58();
                            if (addr !== address && !addr.startsWith('1111') && !addr.startsWith('Token')) {
                                uniqueAddresses.add(addr);
                            }
                        }
                    }
                    result.rapidFireTransactions = rapidFireCount;
                    result.uniqueInteractions = uniqueAddresses.size;
                    return [2 /*return*/, result];
                case 3:
                    error_12 = _a.sent();
                    logger.error('Error analyzing wallet activity:', error_12);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Fast connected wallets finder - reduced depth
function findConnectedWalletsFast(address) {
    return __awaiter(this, void 0, void 0, function () {
        var connections, conn_5, publicKey, signatures, txPromises, results, _i, results_1, result, tx, txMeta, txTime, accountKeys, preBalances, postBalances, ourIndex, ourChange, i, otherAddr, otherChange, existing, error_13;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    connections = new Map();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    conn_5 = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn_5.getSignaturesForAddress(publicKey, { limit: 50 })];
                case 2:
                    signatures = _b.sent();
                    txPromises = signatures.slice(0, 30).map(function (sigInfo) {
                        return (0, cache_1.withCache)(cache_1.CacheKeys.transaction(sigInfo.signature), cache_1.CacheTTL.VERY_LONG, function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            var _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, 2, , 3]);
                                        _b = {};
                                        return [4 /*yield*/, conn_5.getParsedTransaction(sigInfo.signature, {
                                                maxSupportedTransactionVersion: 0,
                                            })];
                                    case 1: return [2 /*return*/, (_b.tx = _c.sent(),
                                            _b.blockTime = sigInfo.blockTime,
                                            _b)];
                                    case 2:
                                        _a = _c.sent();
                                        return [2 /*return*/, null];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                    });
                    return [4 /*yield*/, Promise.all(txPromises)];
                case 3:
                    results = _b.sent();
                    for (_i = 0, results_1 = results; _i < results_1.length; _i++) {
                        result = results_1[_i];
                        if (!((_a = result === null || result === void 0 ? void 0 : result.tx) === null || _a === void 0 ? void 0 : _a.meta) || !result.tx.transaction)
                            continue;
                        tx = result.tx;
                        txMeta = tx.meta;
                        if (!txMeta)
                            continue;
                        txTime = result.blockTime || 0;
                        accountKeys = tx.transaction.message.accountKeys;
                        preBalances = txMeta.preBalances;
                        postBalances = txMeta.postBalances;
                        ourIndex = accountKeys.findIndex(function (k) { return k.pubkey.toBase58() === address; });
                        if (ourIndex === -1)
                            continue;
                        ourChange = (postBalances[ourIndex] - preBalances[ourIndex]) / web3_js_1.LAMPORTS_PER_SOL;
                        for (i = 0; i < accountKeys.length; i++) {
                            if (i === ourIndex)
                                continue;
                            otherAddr = accountKeys[i].pubkey.toBase58();
                            // Skip system accounts
                            if (otherAddr.startsWith('1111') || otherAddr.startsWith('Token') ||
                                otherAddr.startsWith('Sysvar') || otherAddr.startsWith('Compute') ||
                                otherAddr.startsWith('So1') || otherAddr.startsWith('Vote')) {
                                continue;
                            }
                            otherChange = (postBalances[i] - preBalances[i]) / web3_js_1.LAMPORTS_PER_SOL;
                            if (Math.abs(otherChange) < 0.001 && Math.abs(ourChange) < 0.001)
                                continue;
                            existing = connections.get(otherAddr) || {
                                sent: 0, received: 0, count: 0, txSignatures: []
                            };
                            existing.count++;
                            if (!existing.firstTime || txTime < existing.firstTime) {
                                existing.firstTime = txTime;
                            }
                            if (!existing.lastTime || txTime > existing.lastTime) {
                                existing.lastTime = txTime;
                            }
                            if (ourChange > 0 && otherChange < 0) {
                                existing.received += Math.abs(ourChange);
                            }
                            else if (ourChange < 0 && otherChange > 0) {
                                existing.sent += Math.abs(ourChange);
                            }
                            connections.set(otherAddr, existing);
                        }
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_13 = _b.sent();
                    logger.error('Error finding connected wallets:', error_13);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, connections];
            }
        });
    });
}
// ULTRA-FAST connected wallet analysis - minimal RPC calls
function analyzeConnectedWalletsFast(connections, originalAddress) {
    return __awaiter(this, void 0, void 0, function () {
        var results, sorted, checkPromises, walletResults, _i, walletResults_1, w;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    sorted = Array.from(connections.entries())
                        .filter(function (_a) {
                        var addr = _a[0], data = _a[1];
                        return data.count >= 2 || data.sent > 1 || data.received > 1;
                    })
                        .sort(function (a, b) {
                        var aTotal = a[1].sent + a[1].received + (a[1].count * 0.1);
                        var bTotal = b[1].sent + b[1].received + (b[1].count * 0.1);
                        return bTotal - aTotal;
                    })
                        .slice(0, 5);
                    checkPromises = sorted.map(function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
                        var deployerCheck, riskReasons, riskScore, pattern, tokenCount, riskLevel, e_14;
                        var addr = _b[0], data = _b[1];
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, quickDeployerCheckCached(addr)];
                                case 1:
                                    deployerCheck = _c.sent();
                                    riskReasons = [];
                                    riskScore = 0;
                                    pattern = void 0;
                                    // Quick deployer analysis
                                    if (deployerCheck.isDeployer) {
                                        tokenCount = deployerCheck.tokenCount;
                                        if (tokenCount >= 10) {
                                            riskReasons.push("\uD83D\uDEA8 Serial deployer: ".concat(tokenCount, "+ tokens"));
                                            riskScore += 60;
                                            pattern = 'Serial Deployer';
                                        }
                                        else if (tokenCount >= 3) {
                                            riskReasons.push("\u26A0\uFE0F Deployed ".concat(tokenCount, " tokens"));
                                            riskScore += 30;
                                            pattern = 'Token Deployer';
                                        }
                                        else if (tokenCount > 0) {
                                            riskReasons.push("\uD83D\uDCDD Deployed ".concat(tokenCount, " token"));
                                            riskScore += 10;
                                        }
                                    }
                                    // Value transfer analysis (no RPC needed)
                                    if (data.sent > 50) {
                                        riskReasons.push("\uD83D\uDCB8 Sent you ".concat(data.sent.toFixed(1), " XNT"));
                                        if (!pattern)
                                            pattern = 'Major Funder';
                                    }
                                    if (data.received > 50) {
                                        riskReasons.push("\uD83D\uDCB8 Received ".concat(data.received.toFixed(1), " XNT"));
                                        if (!pattern)
                                            pattern = 'Fund Recipient';
                                        riskScore += 5;
                                    }
                                    // Dump pattern
                                    if (data.received > 10 && data.count > 5 && data.sent < 1) {
                                        riskReasons.push('📤 One-way outflow');
                                        riskScore += 15;
                                        if (!pattern)
                                            pattern = 'Dump Recipient';
                                    }
                                    riskLevel = 'low';
                                    if (riskScore >= 50)
                                        riskLevel = 'critical';
                                    else if (riskScore >= 30)
                                        riskLevel = 'high';
                                    else if (riskScore >= 10)
                                        riskLevel = 'medium';
                                    return [2 /*return*/, {
                                            address: addr,
                                            interactionCount: data.count,
                                            totalValueSent: data.sent,
                                            totalValueReceived: data.received,
                                            isDeployer: deployerCheck.isDeployer,
                                            deployedTokenCount: deployerCheck.tokenCount,
                                            riskLevel: riskLevel,
                                            riskReasons: riskReasons,
                                            firstInteraction: data.firstTime ? new Date(data.firstTime * 1000) : undefined,
                                            lastInteraction: data.lastTime ? new Date(data.lastTime * 1000) : undefined,
                                            pattern: pattern,
                                            rugInvolvements: [],
                                            isLpRugger: false,
                                            isHoneypotCreator: false,
                                            rugCount: 0,
                                        }];
                                case 2:
                                    e_14 = _c.sent();
                                    return [2 /*return*/, null];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, Promise.all(checkPromises)];
                case 1:
                    walletResults = _a.sent();
                    for (_i = 0, walletResults_1 = walletResults; _i < walletResults_1.length; _i++) {
                        w = walletResults_1[_i];
                        if (w)
                            results.push(w);
                    }
                    // Sort by risk
                    results.sort(function (a, b) {
                        var order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
                        return order[a.riskLevel] - order[b.riskLevel];
                    });
                    return [2 /*return*/, results];
            }
        });
    });
}
// Cached quick deployer check
function quickDeployerCheckCached(address) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, cached, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cacheKey = "quick_deployer:".concat(address);
                    cached = cache_1.cache.get(cacheKey);
                    if (cached)
                        return [2 /*return*/, cached];
                    return [4 /*yield*/, quickDeployerCheck(address)];
                case 1:
                    result = _a.sent();
                    cache_1.cache.set(cacheKey, result, cache_1.CacheTTL.MEDIUM);
                    return [2 /*return*/, result];
            }
        });
    });
}
// Fast rug detection with caching - IMPROVED LP detection
function detectRugInvolvementsFast(address) {
    return __awaiter(this, void 0, void 0, function () {
        var cacheKey, cached, rugInvolvements, isLpRugger, isHoneypotCreator, deployerCheck, deployedTokens, _loop_3, _i, deployedTokens_1, mint, conn_6, signatures, totalLpWithdrawals, lpBurns, largeDumps, txPromises, transactions, _a, transactions_2, tx, accountKeys, involvedPrograms, isAmmTx, ourIndex, preBalances, postBalances, balanceChange, _loop_4, _b, _c, pre, evidence, error_14, result;
        var _this = this;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    cacheKey = cache_1.CacheKeys.rugCheck(address);
                    cached = cache_1.cache.get(cacheKey);
                    if (cached)
                        return [2 /*return*/, cached];
                    rugInvolvements = [];
                    isLpRugger = false;
                    isHoneypotCreator = false;
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 10, , 11]);
                    return [4 /*yield*/, quickDeployerCheck(address)];
                case 2:
                    deployerCheck = _d.sent();
                    if (!(deployerCheck.isDeployer && deployerCheck.tokenCount > 0)) return [3 /*break*/, 7];
                    return [4 /*yield*/, getDeployedTokenMints(address, 3)];
                case 3:
                    deployedTokens = _d.sent();
                    _loop_3 = function (mint) {
                        var tokenAnalysis, e_15;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, (0, cache_1.withCache)(cache_1.CacheKeys.tokenAnalysis(mint), cache_1.CacheTTL.LONG, function () { return analyzeTokenForRugPatterns(mint, address); })];
                                case 1:
                                    tokenAnalysis = _e.sent();
                                    if (tokenAnalysis.isRugged) {
                                        rugInvolvements.push({
                                            rugType: tokenAnalysis.rugType,
                                            tokenMint: mint,
                                            role: 'deployer',
                                            evidence: tokenAnalysis.evidence,
                                            timestamp: tokenAnalysis.timestamp ? new Date(tokenAnalysis.timestamp * 1000) : undefined,
                                        });
                                        if (tokenAnalysis.rugType === 'honeypot') {
                                            isHoneypotCreator = true;
                                        }
                                    }
                                    return [3 /*break*/, 3];
                                case 2:
                                    e_15 = _e.sent();
                                    return [2 /*return*/, "continue"];
                                case 3: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, deployedTokens_1 = deployedTokens;
                    _d.label = 4;
                case 4:
                    if (!(_i < deployedTokens_1.length)) return [3 /*break*/, 7];
                    mint = deployedTokens_1[_i];
                    return [5 /*yield**/, _loop_3(mint)];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7:
                    conn_6 = (0, blockchain_1.getConnection)();
                    return [4 /*yield*/, conn_6.getSignaturesForAddress(new web3_js_1.PublicKey(address), { limit: 50 })];
                case 8:
                    signatures = _d.sent();
                    totalLpWithdrawals = 0;
                    lpBurns = 0;
                    largeDumps = 0;
                    txPromises = signatures.slice(0, 30).map(function (sig) {
                        return (0, cache_1.withCache)(cache_1.CacheKeys.transaction(sig.signature), cache_1.CacheTTL.VERY_LONG, function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, conn_6.getParsedTransaction(sig.signature, {
                                                maxSupportedTransactionVersion: 0,
                                            })];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, null];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                    });
                    return [4 /*yield*/, Promise.all(txPromises)];
                case 9:
                    transactions = _d.sent();
                    for (_a = 0, transactions_2 = transactions; _a < transactions_2.length; _a++) {
                        tx = transactions_2[_a];
                        if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                            continue;
                        accountKeys = tx.transaction.message.accountKeys;
                        involvedPrograms = accountKeys.map(function (k) { return k.pubkey.toBase58(); });
                        isAmmTx = involvedPrograms.some(function (p) { return DEX_PROGRAMS.includes(p); });
                        if (isAmmTx) {
                            ourIndex = accountKeys.findIndex(function (k) { return k.pubkey.toBase58() === address; });
                            if (ourIndex !== -1) {
                                preBalances = tx.meta.preBalances;
                                postBalances = tx.meta.postBalances;
                                balanceChange = (postBalances[ourIndex] - preBalances[ourIndex]) / web3_js_1.LAMPORTS_PER_SOL;
                                // Track XNT withdrawals from LP
                                if (balanceChange > 5) {
                                    totalLpWithdrawals += balanceChange;
                                }
                                // Check for LP token burns (tokens going to 0)
                                if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
                                    _loop_4 = function (pre) {
                                        if (pre.owner !== address)
                                            return "continue";
                                        var preAmount = Number(pre.uiTokenAmount.uiAmount || 0);
                                        var post = tx.meta.postTokenBalances.find(function (p) {
                                            return p.accountIndex === pre.accountIndex;
                                        });
                                        var postAmount = post ? Number(post.uiTokenAmount.uiAmount || 0) : 0;
                                        // LP token burn: large amount going to 0 or near 0
                                        // Lowered threshold from 1M to 100 tokens - even small LP positions matter
                                        if (preAmount > 100 && postAmount < preAmount * 0.01) {
                                            lpBurns++;
                                            logger.info("\uD83D\uDD0D LP burn detected: ".concat(preAmount.toFixed(0), " -> ").concat(postAmount.toFixed(0)));
                                        }
                                        // Full dump: 100% of tokens sold (from any amount > 1)
                                        if (preAmount > 1 && postAmount === 0) {
                                            largeDumps++;
                                        }
                                        // Large dump: >90% sold (more aggressive than 50%)
                                        else if (preAmount > 10 && postAmount < preAmount * 0.1) {
                                            largeDumps++;
                                        }
                                    };
                                    for (_b = 0, _c = tx.meta.preTokenBalances; _b < _c.length; _b++) {
                                        pre = _c[_b];
                                        _loop_4(pre);
                                    }
                                }
                            }
                        }
                    }
                    // Determine if LP rugger based on combined signals
                    // Improved logic: lower thresholds to catch more rug patterns
                    if (totalLpWithdrawals > 10 ||
                        lpBurns > 0 ||
                        (totalLpWithdrawals > 3 && largeDumps >= 1) ||
                        largeDumps >= 2) {
                        isLpRugger = true;
                        evidence = [];
                        if (totalLpWithdrawals > 0) {
                            evidence.push("Withdrew ~".concat(totalLpWithdrawals.toFixed(2), " XNT from liquidity"));
                        }
                        if (lpBurns > 0) {
                            evidence.push("Burned LP tokens ".concat(lpBurns, " time(s)"));
                        }
                        if (largeDumps > 0) {
                            evidence.push("Large token dumps: ".concat(largeDumps));
                        }
                        rugInvolvements.push({
                            rugType: 'lp_pull',
                            tokenMint: 'XDEX LP',
                            role: 'lp_remover',
                            amount: totalLpWithdrawals,
                            evidence: evidence,
                        });
                    }
                    return [3 /*break*/, 11];
                case 10:
                    error_14 = _d.sent();
                    logger.error('Error in fast rug detection:', error_14);
                    return [3 /*break*/, 11];
                case 11:
                    result = {
                        rugInvolvements: rugInvolvements,
                        isLpRugger: isLpRugger,
                        isHoneypotCreator: isHoneypotCreator,
                        rugCount: rugInvolvements.length,
                    };
                    cache_1.cache.set(cacheKey, result, cache_1.CacheTTL.MEDIUM);
                    return [2 /*return*/, result];
            }
        });
    });
}
// Quick deployer check (faster, fewer transactions) - OPTIMIZED
function quickDeployerCheck(address) {
    return __awaiter(this, void 0, void 0, function () {
        var conn_7, publicKey, signatures, tokenCount, txPromises, transactions, _i, transactions_3, tx, _a, _b, ix, parsed, error_15;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    conn_7 = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn_7.getSignaturesForAddress(publicKey, { limit: 20 })];
                case 1:
                    signatures = _c.sent();
                    tokenCount = 0;
                    txPromises = signatures.slice(0, 15).map(function (sigInfo) {
                        return (0, cache_1.withCache)(cache_1.CacheKeys.transaction(sigInfo.signature), cache_1.CacheTTL.VERY_LONG, function () { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 2, , 3]);
                                        return [4 /*yield*/, conn_7.getParsedTransaction(sigInfo.signature, {
                                                maxSupportedTransactionVersion: 0,
                                            })];
                                    case 1: return [2 /*return*/, _b.sent()];
                                    case 2:
                                        _a = _b.sent();
                                        return [2 /*return*/, null];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); });
                    });
                    return [4 /*yield*/, Promise.all(txPromises)];
                case 2:
                    transactions = _c.sent();
                    for (_i = 0, transactions_3 = transactions; _i < transactions_3.length; _i++) {
                        tx = transactions_3[_i];
                        if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                            continue;
                        for (_a = 0, _b = tx.transaction.message.instructions; _a < _b.length; _a++) {
                            ix = _b[_a];
                            if ('parsed' in ix && ix.parsed) {
                                parsed = ix.parsed;
                                if (parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') {
                                    tokenCount++;
                                }
                            }
                        }
                    }
                    return [2 /*return*/, { isDeployer: tokenCount > 0, tokenCount: tokenCount }];
                case 3:
                    error_15 = _c.sent();
                    return [2 /*return*/, { isDeployer: false, tokenCount: 0 }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// AMM Program IDs for LP detection
var RAYDIUM_AMM_V4 = 'HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8';
var RAYDIUM_CLMM = 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK';
var ORCA_WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
// X1 XDEX Programs
var XDEX_AMM = 'sEsYH97wqmfnkzHedjNcw3zyJdPvUmsa9AixhS4b4fN';
var XDEX_PROGRAM_2 = '9Dpjw2pB5kXJr6ZTHiqzEMfJPic3om9jgNacnwpLCoaU';
var XDEX_PROGRAM_3 = '81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ';
// All DEX programs for LP detection
var DEX_PROGRAMS = [RAYDIUM_AMM_V4, RAYDIUM_CLMM, ORCA_WHIRLPOOL, XDEX_AMM, XDEX_PROGRAM_2, XDEX_PROGRAM_3];
// Detect LP rug and other rug involvements for a wallet
function detectRugInvolvements(address) {
    return __awaiter(this, void 0, void 0, function () {
        var rugInvolvements, isLpRugger, isHoneypotCreator, conn, publicKey, signatures, lpRemovals, lpAdditions, tokenDumps, _i, _a, sigInfo, tx, accountKeys, instructions, timestamp, involvedPrograms, isRaydiumTx, isOrcaTx, preBalances, postBalances, ourIndex, balanceChange, _b, instructions_1, ix, parsed, mintKey, existing, _loop_5, i, e_16, _loop_6, _c, lpRemovals_1, _d, mint, removal, _e, tokenDumps_1, _f, mint, dump, deployerCheck, deployedTokens, _g, deployedTokens_2, mint, tokenAnalysis, e_17, error_16;
        var _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    rugInvolvements = [];
                    isLpRugger = false;
                    isHoneypotCreator = false;
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 17, , 18]);
                    conn = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: 100 })];
                case 2:
                    signatures = _j.sent();
                    lpRemovals = new Map();
                    lpAdditions = new Map();
                    tokenDumps = new Map();
                    _i = 0, _a = signatures.slice(0, 60);
                    _j.label = 3;
                case 3:
                    if (!(_i < _a.length)) return [3 /*break*/, 8];
                    sigInfo = _a[_i];
                    _j.label = 4;
                case 4:
                    _j.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, conn.getParsedTransaction(sigInfo.signature, {
                            maxSupportedTransactionVersion: 0,
                        })];
                case 5:
                    tx = _j.sent();
                    if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                        return [3 /*break*/, 7];
                    accountKeys = tx.transaction.message.accountKeys;
                    instructions = tx.transaction.message.instructions;
                    timestamp = sigInfo.blockTime || 0;
                    involvedPrograms = accountKeys.map(function (k) { return k.pubkey.toBase58(); });
                    isRaydiumTx = involvedPrograms.some(function (p) {
                        return p === RAYDIUM_AMM_V4 || p === RAYDIUM_CLMM;
                    });
                    isOrcaTx = involvedPrograms.some(function (p) { return p === ORCA_WHIRLPOOL; });
                    if (isRaydiumTx || isOrcaTx) {
                        preBalances = tx.meta.preBalances;
                        postBalances = tx.meta.postBalances;
                        ourIndex = accountKeys.findIndex(function (k) { return k.pubkey.toBase58() === address; });
                        if (ourIndex !== -1) {
                            balanceChange = (postBalances[ourIndex] - preBalances[ourIndex]) / web3_js_1.LAMPORTS_PER_SOL;
                            // Large positive balance = likely LP removal (rug)
                            if (balanceChange > 10) {
                                // Try to find the token involved
                                for (_b = 0, instructions_1 = instructions; _b < instructions_1.length; _b++) {
                                    ix = instructions_1[_b];
                                    if ('parsed' in ix && ix.parsed) {
                                        parsed = ix.parsed;
                                        if ((_h = parsed.info) === null || _h === void 0 ? void 0 : _h.mint) {
                                            mintKey = parsed.info.mint;
                                            existing = lpRemovals.get(mintKey) || { amount: 0, timestamp: 0 };
                                            existing.amount += balanceChange;
                                            existing.timestamp = timestamp;
                                            lpRemovals.set(mintKey, existing);
                                        }
                                    }
                                }
                                // If we can't find specific mint, record as general LP removal
                                if (lpRemovals.size === 0) {
                                    lpRemovals.set('unknown_lp', { amount: balanceChange, timestamp: timestamp });
                                }
                            }
                            // Large negative balance = LP addition
                            if (balanceChange < -10) {
                                lpAdditions.set('lp_add_' + timestamp, { amount: Math.abs(balanceChange), timestamp: timestamp });
                            }
                        }
                    }
                    // Check for large token transfers (potential dumps)
                    if (tx.meta.preTokenBalances && tx.meta.postTokenBalances) {
                        _loop_5 = function (i) {
                            var pre = tx.meta.preTokenBalances[i];
                            var post = tx.meta.postTokenBalances.find(function (p) { return p.accountIndex === pre.accountIndex; });
                            if (pre && post && pre.owner === address) {
                                var preAmount = Number(pre.uiTokenAmount.uiAmount || 0);
                                var postAmount = Number(post.uiTokenAmount.uiAmount || 0);
                                var diff = preAmount - postAmount;
                                // Large token outflow = potential dump
                                if (diff > 0 && preAmount > 0) {
                                    var percentageSold = (diff / preAmount) * 100;
                                    if (percentageSold > 50) {
                                        var existing = tokenDumps.get(pre.mint) || { amount: 0, timestamp: 0 };
                                        existing.amount += diff;
                                        existing.timestamp = timestamp;
                                        tokenDumps.set(pre.mint, existing);
                                    }
                                }
                            }
                        };
                        for (i = 0; i < tx.meta.preTokenBalances.length; i++) {
                            _loop_5(i);
                        }
                    }
                    return [3 /*break*/, 7];
                case 6:
                    e_16 = _j.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8:
                    _loop_6 = function (mint, removal) {
                        var addition = Array.from(lpAdditions.values()).find(function (a) {
                            return removal.timestamp - a.timestamp < 7 * 24 * 60 * 60 && // Within 7 days
                                removal.timestamp > a.timestamp;
                        });
                        if (addition || removal.amount > 50) {
                            isLpRugger = true;
                            rugInvolvements.push({
                                rugType: 'lp_pull',
                                tokenMint: mint,
                                role: 'lp_remover',
                                amount: removal.amount,
                                timestamp: new Date(removal.timestamp * 1000),
                                evidence: [
                                    "Removed ".concat(removal.amount.toFixed(2), " XNT in liquidity"),
                                    addition ? 'LP was recently added then quickly removed' : 'Large LP removal detected',
                                ],
                            });
                        }
                    };
                    // Analyze patterns to classify rug types
                    // LP Rug detection: Added then quickly removed liquidity
                    for (_c = 0, lpRemovals_1 = lpRemovals; _c < lpRemovals_1.length; _c++) {
                        _d = lpRemovals_1[_c], mint = _d[0], removal = _d[1];
                        _loop_6(mint, removal);
                    }
                    // Dev dump detection
                    for (_e = 0, tokenDumps_1 = tokenDumps; _e < tokenDumps_1.length; _e++) {
                        _f = tokenDumps_1[_e], mint = _f[0], dump = _f[1];
                        if (dump.amount > 0) {
                            rugInvolvements.push({
                                rugType: 'dev_dump',
                                tokenMint: mint,
                                role: 'dumper',
                                amount: dump.amount,
                                timestamp: new Date(dump.timestamp * 1000),
                                evidence: [
                                    "Sold large portion of token holdings",
                                ],
                            });
                        }
                    }
                    return [4 /*yield*/, quickDeployerCheck(address)];
                case 9:
                    deployerCheck = _j.sent();
                    if (!(deployerCheck.isDeployer && deployerCheck.tokenCount > 0)) return [3 /*break*/, 16];
                    return [4 /*yield*/, getDeployedTokenMints(address, 5)];
                case 10:
                    deployedTokens = _j.sent();
                    _g = 0, deployedTokens_2 = deployedTokens;
                    _j.label = 11;
                case 11:
                    if (!(_g < deployedTokens_2.length)) return [3 /*break*/, 16];
                    mint = deployedTokens_2[_g];
                    _j.label = 12;
                case 12:
                    _j.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, analyzeTokenForRugPatterns(mint, address)];
                case 13:
                    tokenAnalysis = _j.sent();
                    if (tokenAnalysis.isRugged) {
                        rugInvolvements.push({
                            rugType: tokenAnalysis.rugType,
                            tokenMint: mint,
                            role: 'deployer',
                            evidence: tokenAnalysis.evidence,
                            timestamp: tokenAnalysis.timestamp ? new Date(tokenAnalysis.timestamp * 1000) : undefined,
                        });
                        if (tokenAnalysis.rugType === 'honeypot') {
                            isHoneypotCreator = true;
                        }
                    }
                    return [3 /*break*/, 15];
                case 14:
                    e_17 = _j.sent();
                    return [3 /*break*/, 15];
                case 15:
                    _g++;
                    return [3 /*break*/, 11];
                case 16: return [3 /*break*/, 18];
                case 17:
                    error_16 = _j.sent();
                    logger.error('Error detecting rug involvements:', error_16);
                    return [3 /*break*/, 18];
                case 18: return [2 /*return*/, {
                        rugInvolvements: rugInvolvements,
                        isLpRugger: isLpRugger,
                        isHoneypotCreator: isHoneypotCreator,
                        rugCount: rugInvolvements.length,
                    }];
            }
        });
    });
}
// Get deployed token mints for a wallet
function getDeployedTokenMints(address, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var mints, conn, publicKey, signatures, _i, signatures_1, sigInfo, tx, _a, _b, ix, parsed, e_18, error_17;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    mints = [];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 9, , 10]);
                    conn = (0, blockchain_1.getConnection)();
                    publicKey = new web3_js_1.PublicKey(address);
                    return [4 /*yield*/, conn.getSignaturesForAddress(publicKey, { limit: 50 })];
                case 2:
                    signatures = _d.sent();
                    _i = 0, signatures_1 = signatures;
                    _d.label = 3;
                case 3:
                    if (!(_i < signatures_1.length)) return [3 /*break*/, 8];
                    sigInfo = signatures_1[_i];
                    if (mints.length >= limit)
                        return [3 /*break*/, 8];
                    _d.label = 4;
                case 4:
                    _d.trys.push([4, 6, , 7]);
                    return [4 /*yield*/, conn.getParsedTransaction(sigInfo.signature, {
                            maxSupportedTransactionVersion: 0,
                        })];
                case 5:
                    tx = _d.sent();
                    if (!(tx === null || tx === void 0 ? void 0 : tx.meta) || !tx.transaction)
                        return [3 /*break*/, 7];
                    for (_a = 0, _b = tx.transaction.message.instructions; _a < _b.length; _a++) {
                        ix = _b[_a];
                        if ('parsed' in ix && ix.parsed) {
                            parsed = ix.parsed;
                            if ((parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') && ((_c = parsed.info) === null || _c === void 0 ? void 0 : _c.mint)) {
                                if (!mints.includes(parsed.info.mint)) {
                                    mints.push(parsed.info.mint);
                                }
                            }
                        }
                    }
                    return [3 /*break*/, 7];
                case 6:
                    e_18 = _d.sent();
                    return [3 /*break*/, 7];
                case 7:
                    _i++;
                    return [3 /*break*/, 3];
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_17 = _d.sent();
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/, mints];
            }
        });
    });
}
// Analyze a token for specific rug patterns
function analyzeTokenForRugPatterns(mint, deployer) {
    return __awaiter(this, void 0, void 0, function () {
        var evidence, isRugged, rugType, rugTimestamp, conn, mintPubkey, mintInfo, data, largestAccounts, totalSupply, topHolder, topHolderPct, _i, _a, account, accInfo, owner, deployerPct, e_19, deployerSigs, _loop_7, _b, deployerSigs_2, sig, state_2, e_20, error_18;
        var _c, _d, _e, _f, _g, _h, _j;
        return __generator(this, function (_k) {
            switch (_k.label) {
                case 0:
                    evidence = [];
                    isRugged = false;
                    rugType = 'none';
                    rugTimestamp = undefined;
                    _k.label = 1;
                case 1:
                    _k.trys.push([1, 19, , 20]);
                    conn = (0, blockchain_1.getConnection)();
                    mintPubkey = new web3_js_1.PublicKey(mint);
                    return [4 /*yield*/, conn.getParsedAccountInfo(mintPubkey)];
                case 2:
                    mintInfo = _k.sent();
                    if (((_c = mintInfo.value) === null || _c === void 0 ? void 0 : _c.data) && 'parsed' in mintInfo.value.data) {
                        data = mintInfo.value.data.parsed;
                        // Check for honeypot indicators
                        // Honeypots typically have mint authority still enabled
                        if (((_d = data.info) === null || _d === void 0 ? void 0 : _d.mintAuthority) === deployer) {
                            evidence.push('Deployer still controls mint authority');
                        }
                        // Check freeze authority (can freeze buyers from selling)
                        if (((_e = data.info) === null || _e === void 0 ? void 0 : _e.freezeAuthority) === deployer) {
                            evidence.push('Deployer can freeze token accounts (honeypot indicator)');
                            isRugged = true;
                            rugType = 'honeypot';
                        }
                    }
                    return [4 /*yield*/, conn.getTokenLargestAccounts(mintPubkey)];
                case 3:
                    largestAccounts = _k.sent();
                    if (!(largestAccounts.value.length > 0)) return [3 /*break*/, 10];
                    totalSupply = largestAccounts.value.reduce(function (sum, acc) { return sum + Number(acc.amount); }, 0);
                    if (!(totalSupply === 0)) return [3 /*break*/, 4];
                    evidence.push('Token supply is 0 (likely dumped/rugged)');
                    isRugged = true;
                    rugType = 'dev_dump';
                    return [3 /*break*/, 10];
                case 4:
                    topHolder = Number(largestAccounts.value[0].amount);
                    topHolderPct = (topHolder / totalSupply) * 100;
                    // Check if supply is concentrated (soft rug indicator)
                    if (topHolderPct > 80) {
                        evidence.push("".concat(topHolderPct.toFixed(1), "% held by single wallet"));
                        isRugged = true;
                        rugType = 'soft_rug';
                    }
                    _i = 0, _a = largestAccounts.value.slice(0, 3);
                    _k.label = 5;
                case 5:
                    if (!(_i < _a.length)) return [3 /*break*/, 10];
                    account = _a[_i];
                    _k.label = 6;
                case 6:
                    _k.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, conn.getParsedAccountInfo(account.address)];
                case 7:
                    accInfo = _k.sent();
                    if (((_f = accInfo.value) === null || _f === void 0 ? void 0 : _f.data) && 'parsed' in accInfo.value.data) {
                        owner = (_g = accInfo.value.data.parsed.info) === null || _g === void 0 ? void 0 : _g.owner;
                        if (owner === deployer) {
                            deployerPct = (Number(account.amount) / totalSupply) * 100;
                            if (deployerPct > 30) {
                                evidence.push("Deployer still holds ".concat(deployerPct.toFixed(1), "% of supply"));
                            }
                        }
                    }
                    return [3 /*break*/, 9];
                case 8:
                    e_19 = _k.sent();
                    return [3 /*break*/, 9];
                case 9:
                    _i++;
                    return [3 /*break*/, 5];
                case 10:
                    // If we have multiple evidence points, likely a rug
                    if (evidence.length >= 2 && !isRugged) {
                        isRugged = true;
                        rugType = 'soft_rug';
                    }
                    if (!isRugged) return [3 /*break*/, 18];
                    _k.label = 11;
                case 11:
                    _k.trys.push([11, 17, , 18]);
                    return [4 /*yield*/, conn.getSignaturesForAddress(new web3_js_1.PublicKey(deployer), { limit: 50 })];
                case 12:
                    deployerSigs = _k.sent();
                    _loop_7 = function (sig) {
                        var tx, involvedMints_1, e_21;
                        return __generator(this, function (_l) {
                            switch (_l.label) {
                                case 0:
                                    _l.trys.push([0, 2, , 3]);
                                    return [4 /*yield*/, conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 })];
                                case 1:
                                    tx = _l.sent();
                                    if (!tx)
                                        return [2 /*return*/, "continue"];
                                    involvedMints_1 = new Set();
                                    if ((_h = tx.meta) === null || _h === void 0 ? void 0 : _h.preTokenBalances) {
                                        tx.meta.preTokenBalances.forEach(function (b) { return involvedMints_1.add(b.mint); });
                                    }
                                    if ((_j = tx.meta) === null || _j === void 0 ? void 0 : _j.postTokenBalances) {
                                        tx.meta.postTokenBalances.forEach(function (b) { return involvedMints_1.add(b.mint); });
                                    }
                                    if (involvedMints_1.has(mint) && sig.blockTime) {
                                        // Found a transaction with this token - use as rug timestamp
                                        rugTimestamp = sig.blockTime;
                                        return [2 /*return*/, "break"];
                                    }
                                    return [3 /*break*/, 3];
                                case 2:
                                    e_21 = _l.sent();
                                    return [2 /*return*/, "continue"];
                                case 3: return [2 /*return*/];
                            }
                        });
                    };
                    _b = 0, deployerSigs_2 = deployerSigs;
                    _k.label = 13;
                case 13:
                    if (!(_b < deployerSigs_2.length)) return [3 /*break*/, 16];
                    sig = deployerSigs_2[_b];
                    return [5 /*yield**/, _loop_7(sig)];
                case 14:
                    state_2 = _k.sent();
                    if (state_2 === "break")
                        return [3 /*break*/, 16];
                    _k.label = 15;
                case 15:
                    _b++;
                    return [3 /*break*/, 13];
                case 16: return [3 /*break*/, 18];
                case 17:
                    e_20 = _k.sent();
                    return [3 /*break*/, 18];
                case 18: return [3 /*break*/, 20];
                case 19:
                    error_18 = _k.sent();
                    // Token might not exist anymore = rugged
                    evidence.push('Token account no longer exists');
                    isRugged = true;
                    rugType = 'dev_dump';
                    return [3 /*break*/, 20];
                case 20: return [2 /*return*/, { isRugged: isRugged, rugType: rugType, evidence: evidence, timestamp: rugTimestamp }];
            }
        });
    });
}
// Detect coordinated wallet patterns
function detectCoordinatedWallets(wallets) {
    var coordinated = [];
    for (var _i = 0, wallets_1 = wallets; _i < wallets_1.length; _i++) {
        var wallet = wallets_1[_i];
        // Check for coordination indicators
        var isCoordinated = 
        // Multiple deployers working together
        (wallet.isDeployer && wallet.deployedTokenCount > 2) ||
            // Wash trading pattern
            (wallet.pattern === 'Wash Trading Partner') ||
            // Known scammer
            (wallet.riskLevel === 'critical') ||
            // Dump recipient with high value
            (wallet.pattern === 'Dump Recipient' && wallet.totalValueReceived > 20);
        if (isCoordinated) {
            coordinated.push(wallet);
        }
    }
    return coordinated;
}
// Enhanced risk score calculation (0-100)
function calculateRiskScoreEnhanced(info) {
    var score = 0;
    // Blacklist/malicious activity: high base score
    if (info.hasBlacklistHistory)
        score += 45;
    if (info.maliciousActivity)
        score += 45;
    // Deployer analysis
    if (info.isDeployer) {
        var tokenCount = info.deployedTokens.length;
        if (tokenCount >= 10)
            score += 35; // Serial deployer
        else if (tokenCount >= 5)
            score += 25;
        else if (tokenCount >= 3)
            score += 15;
        else
            score += 5;
        // Rugpull history is very serious
        var rugpullCount = info.deployedTokensAnalysis.filter(function (t) { return t.isRugpull; }).length;
        if (rugpullCount > 0)
            score += 30 + (rugpullCount * 5);
    }
    // Suspicious patterns scoring
    for (var _i = 0, _a = info.suspiciousPatterns; _i < _a.length; _i++) {
        var pattern = _a[_i];
        if (pattern.severity === 'critical')
            score += 25;
        else if (pattern.severity === 'danger')
            score += 15;
        else if (pattern.severity === 'warning')
            score += 8;
    }
    // Funding source risk
    if (info.fundingSourceRisk === 'critical')
        score += 20;
    else if (info.fundingSourceRisk === 'high')
        score += 12;
    // Risky connections
    var criticalConnections = info.connectedWallets.filter(function (w) { return w.riskLevel === 'critical'; }).length;
    var highRiskConnections = info.connectedWallets.filter(function (w) { return w.riskLevel === 'high'; }).length;
    score += criticalConnections * 10;
    score += highRiskConnections * 5;
    // Activity analysis
    if (info.activityAnalysis) {
        if (info.activityAnalysis.rapidFireTransactions > 30)
            score += 10;
        if (info.activityAnalysis.suspiciousTimingCount > 10)
            score += 10;
        if (info.activityAnalysis.accountAge < 3 && info.activityAnalysis.totalTransactions > 200)
            score += 15;
    }
    // Cap at 100
    return Math.min(score, 100);
}
// Get risk level from score
function getRiskLevelEnhanced(score) {
    if (score >= 70)
        return 'critical';
    if (score >= 45)
        return 'high';
    if (score >= 20)
        return 'medium';
    if (score > 0)
        return 'low';
    return 'low';
}
// Generate human-readable verdict
function generateVerdict(info) {
    var score = info.riskScore;
    var patterns = info.suspiciousPatterns;
    var rugpullCount = info.deployedTokensAnalysis.filter(function (t) { return t.isRugpull; }).length;
    // Critical verdict
    if (score >= 70 || info.hasBlacklistHistory || rugpullCount > 0) {
        if (info.hasBlacklistHistory) {
            return '🚨 CRITICAL: This wallet is BLACKLISTED and has been flagged for malicious activity. DO NOT interact with this address.';
        }
        if (rugpullCount > 0) {
            return "\uD83D\uDEA8 CRITICAL: This wallet has deployed ".concat(rugpullCount, " token(s) identified as RUGPULLS. Extremely high risk - likely a scammer.");
        }
        if (info.deployedTokens.length >= 10) {
            return '🚨 CRITICAL: Serial token deployer detected. This pattern is commonly associated with scam operations.';
        }
        return '🚨 CRITICAL: Multiple severe risk indicators detected. Exercise extreme caution.';
    }
    // High risk verdict
    if (score >= 45) {
        var reasons = [];
        if (info.isDeployer && info.deployedTokens.length > 3) {
            reasons.push("deployed ".concat(info.deployedTokens.length, " tokens"));
        }
        if (info.riskyConnections > 2) {
            reasons.push("connected to ".concat(info.riskyConnections, " risky wallets"));
        }
        if (patterns.some(function (p) { return p.type === 'coordinated_wallets'; })) {
            reasons.push('part of coordinated wallet network');
        }
        if (info.fundingSourceRisk === 'high' || info.fundingSourceRisk === 'critical') {
            reasons.push('suspicious funding source');
        }
        return "\u26A0\uFE0F HIGH RISK: ".concat(reasons.length > 0 ? 'Wallet has ' + reasons.join(', ') + '.' : 'Multiple risk factors detected.', " Proceed with caution.");
    }
    // Medium risk verdict
    if (score >= 20) {
        if (info.isDeployer) {
            return "\u26A1 MEDIUM RISK: This wallet has deployed ".concat(info.deployedTokens.length, " token(s). Verify token legitimacy before interacting.");
        }
        if (info.riskyConnections > 0) {
            return "\u26A1 MEDIUM RISK: Connected to ".concat(info.riskyConnections, " wallet(s) with risk indicators. Review connections carefully.");
        }
        return '⚡ MEDIUM RISK: Some risk indicators detected. Review the details before proceeding.';
    }
    // Low risk verdict
    if (score > 0) {
        return '✅ LOW RISK: Minor indicators detected but no major concerns. Normal wallet activity patterns.';
    }
    // Clean verdict
    return '✅ CLEAN: No significant risk indicators detected. Wallet appears safe based on available data.';
}
// Format security info for display (compact version for wallet details)
function formatSecurityInfo(info) {
    var _a;
    var riskEmoji = {
        low: '🟢',
        medium: '🟡',
        high: '🔴',
        critical: '🚨',
        unknown: '⚪',
    };
    var message = "\n\uD83D\uDEE1\uFE0F <b>Security Analysis</b>\n";
    message += "\u251C Risk Level: ".concat(riskEmoji[info.riskLevel], " <b>").concat(info.riskLevel.toUpperCase(), "</b>");
    if (info.riskScore > 0)
        message += " (".concat(info.riskScore, "/100)");
    message += "\n";
    if (info.isDeployer) {
        message += "\u251C Token Deployer: \u26A0\uFE0F Yes (".concat(info.deployedTokens.length, " token").concat(info.deployedTokens.length > 1 ? 's' : '', ")\n");
    }
    else {
        message += "\u251C Token Deployer: \u2705 No\n";
    }
    if (info.connectedWallets.length > 0) {
        var riskyCount = info.riskyConnections;
        if (riskyCount > 0) {
            message += "\u251C Connections: \u26A0\uFE0F ".concat(riskyCount, " risky of ").concat(info.connectedWallets.length, "\n");
        }
        else {
            message += "\u251C Connections: \u2705 ".concat(info.connectedWallets.length, " (all safe)\n");
        }
    }
    // Show funding chain with full trace
    logger.info('📊 Formatting security info', {
        fundingChainLength: ((_a = info.fundingChain) === null || _a === void 0 ? void 0 : _a.length) || 0,
        fundingSource: info.fundingSource,
        fundingSourceRisk: info.fundingSourceRisk
    });
    // Always show funding source if available
    if (info.fundingSource || (info.fundingChain && info.fundingChain.length > 0)) {
        message += "\n\uD83D\uDCB0 <b>Funded By:</b>\n";
        if (info.fundingChain && info.fundingChain.length > 0) {
            logger.info("\u2705 Funding chain has ".concat(info.fundingChain.length, " entries"));
            // Show full chain trace with visual flow
            var chainDisplay = info.fundingChain.map(function (addr, idx) {
                var short = "".concat(addr.slice(0, 6), "...").concat(addr.slice(-4));
                return "   ".concat(idx + 1, ". <code>").concat(short, "</code>");
            }).join('\n');
            message += chainDisplay + '\n';
        }
        else if (info.fundingSource) {
            var shortFunding = "".concat(info.fundingSource.slice(0, 6), "...").concat(info.fundingSource.slice(-4));
            message += "   <code>".concat(shortFunding, "</code>\n");
        }
        else {
            // No funding chain found
            message += "   \uD83C\uDD95 <i>Newly created wallet (no funding history)</i>\n";
        }
        // Add risk indicator for funding source
        if (info.fundingSourceRisk === 'critical') {
            message += "   \uD83D\uDEA8 <b>High-risk source detected!</b>\n";
        }
        else if (info.fundingSourceRisk === 'high') {
            message += "   \u26A0\uFE0F Suspicious funding source\n";
        }
        else if (info.fundingSource || info.fundingChain.length > 0) {
            message += "   \u2705 Funding source verified\n";
        }
    }
    else {
        // No funding information at all - definitely a new wallet
        message += "\n\uD83D\uDCB0 <b>Funded By:</b>\n";
        message += "   \uD83C\uDD95 <i>Newly created wallet (no funding history)</i>\n";
    }
    if (info.warnings.length > 0) {
        message += "\u2514 \u26A0\uFE0F ".concat(info.warnings.length, " warning(s) - tap Security for details\n");
    }
    else {
        message += "\u2514 Warnings: None\n";
    }
    return message;
}
