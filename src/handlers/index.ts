/**
 * Handlers Index
 * Central export for all handler modules
 */

// Wallet handlers
export {
  handleWatchCommand,
  handleUnwatchCommand,
  handleListCommand,
  handleWatchAddress,
  handleUnwatchAddress,
  sendWalletList,
  sendWalletListEdit,
  handleConfirmRemoveWallet,
} from './wallet-handlers';

// Security handlers
export {
  handleSecurityScan,
  handleSecurityScanRefresh,
  handleSecurityCommand,
} from './security-handlers';

// Settings handlers
export {
  handleSettingsCommand,
  sendSettings,
  sendSettingsEdit,
  handleToggleNotifications,
  handleToggleIncoming,
  handleToggleOutgoing,
  handleToggleContracts,
  handleToggleBalanceAlerts,
  handleSetMinValue,
  handleUpdateMinValue,
  handleResetSettings,
} from './settings-handlers';

// Re-export portfolio handlers (if they exist)
export * from '../handlers-portfolio';
