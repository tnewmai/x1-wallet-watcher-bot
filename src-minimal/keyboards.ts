/**
 * Minimal Keyboard Layouts
 */
import { InlineKeyboard } from 'grammy';

/**
 * Main menu keyboard
 */
export function getMainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👀 My Wallets', 'menu:wallets')
    .text('⚙️ Settings', 'menu:settings').row()
    .text('➕ Add Wallet', 'menu:add_wallet')
    .text('📊 Stats', 'menu:stats').row()
    .text('❓ Help', 'menu:help');
}

/**
 * Wallet list keyboard
 */
export function getWalletListKeyboard(wallets: Array<{ address: string; label?: string }>): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  wallets.forEach((wallet, index) => {
    const label = wallet.label || `Wallet ${index + 1}`;
    keyboard.text(`📍 ${label}`, `wallet:view:${wallet.address}`).row();
  });
  
  keyboard.text('➕ Add Wallet', 'menu:add_wallet')
    .text('🏠 Main Menu', 'menu:main').row();
  
  return keyboard;
}

/**
 * Wallet detail keyboard
 */
export function getWalletDetailKeyboard(address: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔔 Toggle Alerts', `wallet:toggle:${address}`)
    .text('🏷️ Edit Label', `wallet:label:${address}`).row()
    .text('🗑️ Remove', `wallet:remove:${address}`)
    .text('◀️ Back', 'menu:wallets');
}

/**
 * Settings keyboard
 */
export function getSettingsKeyboard(settings: any): InlineKeyboard {
  const incomingEmoji = settings.notifyIncoming ? '✅' : '❌';
  const outgoingEmoji = settings.notifyOutgoing ? '✅' : '❌';
  const balanceEmoji = settings.notifyBalanceChange ? '✅' : '❌';
  
  return new InlineKeyboard()
    .text(`${incomingEmoji} Incoming Txs`, 'setting:incoming').row()
    .text(`${outgoingEmoji} Outgoing Txs`, 'setting:outgoing').row()
    .text(`${balanceEmoji} Balance Changes`, 'setting:balance').row()
    .text('💰 Min Value Filter', 'setting:minvalue').row()
    .text('🏠 Main Menu', 'menu:main');
}

/**
 * Confirmation keyboard
 */
export function getConfirmKeyboard(action: string, data: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Yes', `confirm:${action}:${data}`)
    .text('❌ No', 'menu:wallets');
}

/**
 * Cancel keyboard
 */
export function getCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('❌ Cancel', 'cancel');
}
