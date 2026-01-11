"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultNotificationSettings = void 0;
// Default notification settings
exports.defaultNotificationSettings = {
    transactionsEnabled: false, // Master toggle - OFF by default until user enables
    incoming: true,
    outgoing: true,
    minValue: 0.01, // Ignore tiny transactions by default
    contractInteractions: false, // Don't spam with every program interaction
    balanceAlerts: false, // Disable separate balance alerts (tx notifications are enough)
    minBalanceChange: 0.01,
};
