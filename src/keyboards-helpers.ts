/**
 * Keyboard Helper Functions
 * Common keyboard layouts used across handlers
 */

import { InlineKeyboard } from 'grammy';
import { WatchedWallet } from './types';

/**
 * Main menu keyboard
 */
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 List Wallets', 'list_wallets')
    .text('➕ Add Wallet', 'add_wallet').row()
    .text('⚙️ Settings', 'settings')
    .text('📊 Portfolio', 'portfolio').row()
    .text('🛡️ Security Scan', 'security_scan')
    .text('📤 Export', 'export');
}

/**
 * Back to menu keyboard
 */
export function backToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔙 Back to Menu', 'main_menu');
}

/**
 * Wallet list keyboard
 */
export function walletListKeyboard(wallets: WatchedWallet[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  for (const wallet of wallets) {
    const label = wallet.label || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
    const alertIcon = wallet.alertsEnabled ? '🔔' : '🔕';
    const buttonText = `${alertIcon} ${label}`;
    
    keyboard.text(buttonText, `wallet_${wallet.address}`).row();
  }
  
  keyboard.text('🔙 Back to Menu', 'main_menu');
  
  return keyboard;
}

/**
 * Confirm remove wallet keyboard
 */
export function confirmRemoveKeyboard(address: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Yes, Remove', `confirm_remove_${address}`).row()
    .text('❌ Cancel', 'cancel_remove');
}

/**
 * Settings keyboard
 */
export function settingsKeyboard(settings: any): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  const transactionsIcon = settings?.transactionsEnabled !== false ? '🔔' : '🔕';
  const incomingIcon = settings?.incoming !== false ? '✅' : '❌';
  const outgoingIcon = settings?.outgoing !== false ? '✅' : '❌';
  const contractsIcon = settings?.contractInteractions !== false ? '✅' : '❌';
  const balanceIcon = settings?.balanceAlerts !== false ? '✅' : '❌';
  
  keyboard
    .text(`${transactionsIcon} Notifications`, 'toggle_notifications').row()
    .text(`${incomingIcon} Incoming`, 'toggle_incoming')
    .text(`${outgoingIcon} Outgoing`, 'toggle_outgoing').row()
    .text(`${contractsIcon} Contracts`, 'toggle_contracts')
    .text(`${balanceIcon} Balance`, 'toggle_balance').row()
    .text('💰 Min Value', 'set_min_value')
    .text('🔄 Reset', 'reset_settings').row()
    .text('🔙 Back', 'main_menu');
  
  return keyboard;
}

/**
 * Min value keyboard
 */
export function minValueKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('0 XNT', 'minvalue_0')
    .text('0.1 XNT', 'minvalue_0.1')
    .text('1 XNT', 'minvalue_1').row()
    .text('10 XNT', 'minvalue_10')
    .text('100 XNT', 'minvalue_100')
    .text('1000 XNT', 'minvalue_1000').row()
    .text('🔙 Back', 'settings');
}

/**
 * Wallet action menu keyboard
 */
export function walletActionKeyboard(address: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 Refresh', `refresh_${address}`)
    .text('🛡️ Security', `security_${address}`).row()
    .text('🏷️ Edit Label', `label_${address}`)
    .text('🔔 Toggle Alerts', `alerts_${address}`).row()
    .text('🗑️ Remove', `remove_${address}`)
    .text('🔙 Back', 'list_wallets');
}

/**
 * Export format keyboard
 */
export function exportFormatKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📄 JSON', 'export_json').row()
    .text('📊 CSV', 'export_csv').row()
    .text('📝 TXT', 'export_txt').row()
    .text('🔙 Back', 'main_menu');
}

/**
 * Pagination keyboard
 */
export function paginationKeyboard(
  currentPage: number,
  totalPages: number,
  callbackPrefix: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  if (totalPages <= 1) {
    return keyboard;
  }
  
  const buttons: Array<{ text: string; callback: string }> = [];
  
  // Previous button
  if (currentPage > 0) {
    buttons.push({ text: '◀️ Prev', callback: `${callbackPrefix}_${currentPage - 1}` });
  }
  
  // Page indicator
  buttons.push({ text: `${currentPage + 1}/${totalPages}`, callback: 'noop' });
  
  // Next button
  if (currentPage < totalPages - 1) {
    buttons.push({ text: 'Next ▶️', callback: `${callbackPrefix}_${currentPage + 1}` });
  }
  
  // Add buttons to keyboard
  for (const button of buttons) {
    keyboard.text(button.text, button.callback);
  }
  
  return keyboard;
}
