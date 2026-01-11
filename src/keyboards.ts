import { InlineKeyboard } from 'grammy';
import { WatchedWallet, NotificationSettings, TrackedToken } from './types';

// Main menu keyboard - Wallet Sniffer focused
export function mainMenuKeyboard(notificationsEnabled?: boolean): InlineKeyboard {
  // Default to true if not provided
  const enabled = notificationsEnabled !== false;
  const notifIcon = enabled ? '\uD83D\uDD14' : '\uD83D\uDD15'; // 🔔 : 🔕
  const notifText = enabled ? 'Notifications: ON' : 'Notifications: OFF';
  
  return new InlineKeyboard()
    .text('\uD83D\uDD0D Wallet Sniffer', 'list_wallets') // 🔍
    .text('\u2795 Add Wallet', 'watch_wallet') // ➕
    .row()
    .text(`${notifIcon}`, 'toggle_notifications_main') // Just icon, smaller
    .text('\u2699\uFE0F Settings', 'settings') // ⚙️
    .text('\u2753 Help', 'help'); // ❓
}

// Main menu keyboard with Add Wallet button (for when accessed from different contexts)
export function mainMenuKeyboardWithAdd(notificationsEnabled?: boolean): InlineKeyboard {
  // Default to true if not provided
  const enabled = notificationsEnabled !== false;
  const notifIcon = enabled ? '\uD83D\uDD14' : '\uD83D\uDD15'; // 🔔 : 🔕
  
  return new InlineKeyboard()
    .text('\uD83D\uDD0D Wallet Sniffer', 'list_wallets') // 🔍
    .text('\u2795 Add Wallet', 'watch_wallet') // ➕
    .row()
    .text(`${notifIcon}`, 'toggle_notifications_main')
    .text('\u2699\uFE0F Settings', 'settings')
    .row()
    .text('\uD83D\uDCCA Stats', 'stats')
    .text('\u2753 Help', 'help');
}

// Back to main menu keyboard
export function backToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('\u00AB Back to Menu', 'main_menu'); // «
}

// Wallet list keyboard (formatted with aligned names and balances)
export function walletListKeyboard(wallets: WatchedWallet[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // Count total pending alerts across all wallets
  const totalAlerts = wallets.reduce((sum, w) => sum + (w.pendingAlerts?.length || 0), 0);
  
  // Show each wallet as a single button with clean formatting
  wallets.forEach((wallet, index) => {
    const label = wallet.label || shortenAddress(wallet.address);
    
    // Simple format without emoji or numbering
    let buttonText = label;
    
    if (wallet.lastBalance) {
      // Parse and format balance
      const balanceNum = parseFloat(wallet.lastBalance);
      const balanceStr = balanceNum.toFixed(4);
      // Add balance with visual separation
      buttonText += ` | ${balanceStr} XNT`;
    }
    
    // Add alert badge if wallet has pending alerts
    if (wallet.pendingAlerts && wallet.pendingAlerts.length > 0) {
      buttonText += ` (${wallet.pendingAlerts.length} alerts)`;
    }
    
    keyboard.text(buttonText, `wallet_menu_${wallet.address}`).row();
  });
  
  // Rug alerts button
  keyboard.row();
  if (totalAlerts > 0) {
    keyboard.text(`\uD83D\uDEA8 Rug Alerts (${totalAlerts})`, 'view_alerts'); // 🚨
  } else {
    keyboard.text('\uD83D\uDEA8 Rug Alerts', 'view_alerts'); // 🚨
  }
  
  keyboard.row();
  keyboard.text('\u00AB Back to Menu', 'main_menu'); // «
  
  return keyboard;
}

// Individual wallet action menu (shown when wallet is clicked)
export function walletActionKeyboard(wallet: WatchedWallet): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    // Sniff for Rugs is now the most prominent button (full width, first position)
    .text('\uD83D\uDEA8 SNIFF FOR RUGS', `security_check_${wallet.address}`) // 🚨
    .row()
    .text('\uD83D\uDCBC Portfolio', `discover_tokens_${wallet.address}`) // 💼
    .text('\u274C Remove', `remove_${wallet.address}`) // ❌
    .row();
  
  // Add alert toggle if wallet is flagged as rugger
  if (wallet.isKnownRugger) {
    const alertIcon = wallet.alertsEnabled ? '\uD83D\uDD15' : '\uD83D\uDEA8'; // 🔕 : 🚨
    const alertText = wallet.alertsEnabled ? 'Disable Alerts' : 'Enable Alerts';
    keyboard.text(`${alertIcon} ${alertText}`, `toggle_alert_${wallet.address}`).row();
  }
  
  keyboard.text('\u00AB Back to Wallets', 'list_wallets'); // «
  
  return keyboard;
}

// Confirm remove wallet keyboard
export function confirmRemoveKeyboard(address: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('\u2705 Yes, Remove', `confirm_remove_${address}`) // ✅
    .text('\u274C Cancel', 'list_wallets'); // ❌
}

// Settings keyboard
export function settingsKeyboard(settings: NotificationSettings): InlineKeyboard {
  const txEnabledIcon = settings.transactionsEnabled ? '\uD83D\uDD14' : '\uD83D\uDD15'; // 🔔 : 🔕
  const txEnabledText = settings.transactionsEnabled ? 'ON' : 'OFF';
  const incomingIcon = settings.incoming ? '\u2705' : '\u274C'; // ✅ : ❌
  const outgoingIcon = settings.outgoing ? '\u2705' : '\u274C'; // ✅ : ❌
  const contractIcon = settings.contractInteractions ? '\u2705' : '\u274C'; // ✅ : ❌
  const balanceIcon = settings.balanceAlerts ? '\u2705' : '\u274C'; // ✅ : ❌
  
  return new InlineKeyboard()
    .text(`${txEnabledIcon} Notifications: ${txEnabledText}`, 'toggle_notifications')
    .row()
    .text(`${incomingIcon} Incoming Txs`, 'toggle_incoming')
    .text(`${outgoingIcon} Outgoing Txs`, 'toggle_outgoing')
    .row()
    .text(`${contractIcon} Program Interactions`, 'toggle_contracts')
    .text(`${balanceIcon} Balance Alerts`, 'toggle_balance')
    .row()
    .text(`\uD83D\uDCB0 Min Value: ${settings.minValue} XNT`, 'set_min_value') // 💰
    .row()
    .text('\u00AB Back to Menu', 'main_menu'); // «
}

// Min value options keyboard
export function minValueKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('0 XNT (All)', 'min_value_0')
    .text('0.1 XNT', 'min_value_0.1')
    .row()
    .text('1 XNT', 'min_value_1')
    .text('10 XNT', 'min_value_10')
    .row()
    .text('100 XNT', 'min_value_100')
    .text('1000 XNT', 'min_value_1000')
    .row()
    .text('\u00AB Back to Settings', 'settings'); // «
}

// Cancel operation keyboard
export function cancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('\u274C Cancel', 'main_menu'); // ❌
}

// Wallet detail keyboard (with token options)
export function walletDetailKeyboard(wallet: WatchedWallet): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    // Sniff for Rugs is now the most prominent button (full width, first position)
    .text('\uD83D\uDEA8 SNIFF FOR RUGS', `security_check_${wallet.address}`) // 🚨
    .row()
    .text('\uD83D\uDCBC Portfolio', `discover_tokens_${wallet.address}`) // 💼
    .text('\u274C Remove', `remove_${wallet.address}`) // ❌
    .row()
    .text('\u00AB Back to Wallets', 'list_wallets'); // «
  
  return keyboard;
}

// Portfolio keyboard (back to wallet menu - one level up)
export function portfolioKeyboard(walletAddress: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('\u00AB Back', `wallet_menu_${walletAddress}`); // «
}

// Security keyboard (back to wallet menu - one level up)
export function securityKeyboard(walletAddress: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('\uD83D\uDD04 Rescan', `security_check_${walletAddress}`) // 🔄
    .row()
    .text('\u00AB Back', `wallet_menu_${walletAddress}`); // «
}

// Token list keyboard for a wallet
export function tokenListKeyboard(walletAddress: string, tokens: TrackedToken[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  tokens.forEach((token, index) => {
    keyboard.text(`\u274C ${token.symbol}`, `remove_token_${walletAddress}_${token.contractAddress}`); // ❌
    if ((index + 1) % 2 === 0 || index === tokens.length - 1) {
      keyboard.row();
    }
  });
  
  keyboard.text('\u2795 Add Token', `add_token_${walletAddress}`).row(); // ➕
  keyboard.text('\u00AB Back to Wallet', `wallet_detail_${walletAddress}`); // «
  
  return keyboard;
}

// Select wallet keyboard (for token operations)
export function selectWalletKeyboard(wallets: WatchedWallet[], action: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  wallets.forEach((wallet, index) => {
    const label = wallet.label || shortenAddress(wallet.address);
    keyboard.text(label, `${action}_${wallet.address}`);
    if ((index + 1) % 2 === 0 || index === wallets.length - 1) {
      keyboard.row();
    }
  });
  
  keyboard.text('\u00AB Back to Menu', 'main_menu'); // «
  
  return keyboard;
}

// Helper to shorten address
function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
