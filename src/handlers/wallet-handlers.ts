/**
 * Wallet Management Handlers
 * Handlers for wallet-related commands (add, remove, list, detail)
 */

import { Context, InlineKeyboard } from 'grammy';
import { MyContext } from '../types';
import { getStorage } from '../storage-v2';
import { 
  isValidAddress, 
  getChecksumAddress, 
  getBalance,
  getAddressExplorerUrl,
  getWalletActivityStats
} from '../blockchain';
import { 
  validateWalletLabel, 
  validateAddress,
  checkWalletAdditionRateLimit,
  checkCommandRateLimit,
  escapeHtml
} from '../validation';
import { 
  MAX_WALLETS_PER_USER,
  WALLETS_PER_PAGE,
  EMOJI,
  MESSAGES
} from '../constants';
import { 
  mainMenuKeyboard,
  backToMenuKeyboard,
  walletListKeyboard,
  confirmRemoveKeyboard
} from '../keyboards-helpers';
import { registerWalletForWatching, unregisterWalletFromWatching } from '../watcher';
import logger from '../logger';

/**
 * Handle /watch command - Add a new wallet
 */
export async function handleWatchCommand(ctx: MyContext): Promise<void> {
  if (!ctx.from) return;

  // Rate limit check
  const rateLimitCheck = checkCommandRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.reply(rateLimitCheck.message!);
    return;
  }

  const args = ctx.message?.text?.split(' ').slice(1);
  
  if (args && args.length > 0) {
    // Direct address provided
    const address = args[0];
    const label = args.slice(1).join(' ') || undefined;
    await handleWatchAddress(ctx, address, label);
  } else {
    // Ask for address
    if (ctx.session) {
      ctx.session.awaitingWalletAddress = true;
    }
    await ctx.reply(
      `${EMOJI.WALLET} <b>Add Wallet</b>\n\n` +
      `📝 Send me the wallet address you want to watch:\n\n` +
      `<i>Example: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU</i>`,
      { parse_mode: 'HTML', reply_markup: { remove_keyboard: true } }
    );
  }
}

/**
 * Handle /unwatch command - Remove a wallet
 */
export async function handleUnwatchCommand(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  // Rate limit check
  const rateLimitCheck = checkCommandRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.reply(rateLimitCheck.message!);
    return;
  }

  const args = ctx.message?.text?.split(' ').slice(1);
  
  if (args && args.length > 0) {
    const address = args[0];
    await handleUnwatchAddress(ctx, address);
  } else {
    await ctx.reply(
      `${EMOJI.INFO} <b>Usage:</b> /unwatch &lt;address&gt;\n\n` +
      `Or use /list and tap the wallet to remove it.`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Handle /list command - Show all watched wallets
 */
export async function handleListCommand(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  // Rate limit check
  const rateLimitCheck = checkCommandRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.reply(rateLimitCheck.message!);
    return;
  }

  await sendWalletList(ctx);
}

/**
 * Process wallet address input (after /watch command)
 */
export async function handleWatchAddress(
  ctx: MyContext, 
  address: string, 
  label?: string
): Promise<void> {
  if (!ctx.from) return;

  // Ensure user exists
  const storage = getStorage();
  await storage.ensureUser(ctx.from.id, ctx.from.username);

  // Validate address
  const addressValidation = validateAddress(address);
  if (!addressValidation.valid) {
    await ctx.reply(
      `${EMOJI.ERROR} <b>Invalid Address</b>\n\n${addressValidation.error}`,
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
    return;
  }

  // Validate with blockchain library
  if (!isValidAddress(address)) {
    await ctx.reply(
      `${EMOJI.ERROR} <b>Invalid Address</b>\n\n` +
      `Please provide a valid X1 wallet address.`,
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
    return;
  }

  // Validate label if provided
  if (label) {
    const labelValidation = validateWalletLabel(label);
    if (!labelValidation.valid) {
      await ctx.reply(
        `${EMOJI.WARNING} <b>Invalid Label</b>\n\n${labelValidation.error}`,
        { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
      );
      return;
    }
    label = labelValidation.sanitized;
  }

  // Check rate limit for wallet additions
  const rateLimitCheck = checkWalletAdditionRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.reply(rateLimitCheck.message!);
    return;
  }

  // Get checksum address
  const checksumAddress = getChecksumAddress(address);

  // Add wallet to storage
  const result = await storage.addWallet(ctx.from.id, checksumAddress, label);

  if (result.success) {
    // Register for watching
    registerWalletForWatching(checksumAddress);
    
    // Get current balance
    let balanceInfo = '';
    try {
      const balance = await getBalance(checksumAddress);
      balanceInfo = `\n${EMOJI.BALANCE} <b>Current Balance:</b> ${balance} XNT`;
    } catch (e) {
      logger.warn(`Failed to fetch balance for ${checksumAddress}:`, e);
    }

    await ctx.reply(
      `${EMOJI.SUCCESS} <b>Wallet Added!</b>\n\n` +
      `${EMOJI.WALLET} <b>Address:</b>\n<code>${checksumAddress}</code>` +
      (label ? `\n🏷️ <b>Label:</b> ${escapeHtml(label)}` : '') +
      balanceInfo +
      `\n\n${EMOJI.LINK} <a href="${getAddressExplorerUrl(checksumAddress)}">View on Explorer</a>\n\n` +
      `${EMOJI.ALERT} I'll notify you when there's activity on this wallet!`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );

    logger.info(`User ${ctx.from.id} added wallet ${checksumAddress.slice(0, 8)}...`);
  } else {
    await ctx.reply(
      `${EMOJI.ERROR} ${result.message}`,
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
  }
}

/**
 * Process wallet removal
 */
export async function handleUnwatchAddress(ctx: Context, address: string): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const result = await storage.removeWallet(ctx.from.id, address);
  
  if (result.success) {
    unregisterWalletFromWatching(address);
    logger.info(`User ${ctx.from.id} removed wallet ${address.slice(0, 8)}...`);
  }
  
  await ctx.reply(
    result.success ? `${EMOJI.SUCCESS} ${result.message}` : `${EMOJI.ERROR} ${result.message}`,
    { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
  );
}

/**
 * Send wallet list
 */
export async function sendWalletList(ctx: Context, page: number = 0): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const wallets = await storage.getWallets(ctx.from.id);
  
  if (wallets.length === 0) {
    await ctx.reply(
      `${EMOJI.LIST} <b>Your Wallets</b>\n\n` +
      `📭 <i>No wallets monitored yet</i>\n\n` +
      `💡 Add your first wallet to start tracking activity!\n\n` +
      `Use /watch to get started.`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  // Calculate stats
  const totalAlerts = wallets.reduce((sum, w) => sum + (w.pendingAlerts?.length || 0), 0);
  const ruggersMonitored = wallets.filter(w => w.isKnownRugger).length;
  const alertsEnabled = wallets.filter(w => w.alertsEnabled).length;
  
  // Build message
  let message = `${EMOJI.CHART} <b>OVERVIEW</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `${EMOJI.WALLET} <b>Monitored:</b> ${wallets.length}/${MAX_WALLETS_PER_USER} wallets\n`;
  
  if (ruggersMonitored > 0) {
    message += `${EMOJI.DANGER} <b>Ruggers:</b> ${ruggersMonitored} tracked\n`;
  }
  
  if (alertsEnabled > 0) {
    message += `${EMOJI.ALERT} <b>Alerts:</b> ${alertsEnabled} active\n`;
  }
  
  if (totalAlerts > 0) {
    message += `${EMOJI.FIRE} <b>Pending:</b> ${totalAlerts} alert${totalAlerts > 1 ? 's' : ''}\n`;
  }
  
  message += `\n${EMOJI.WALLET} <b>Your Wallets</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `<i>Tap any wallet for options</i>`;

  await ctx.reply(message, { 
    parse_mode: 'HTML', 
    reply_markup: walletListKeyboard(wallets) 
  });
}

/**
 * Send wallet list (edit message version)
 */
export async function sendWalletListEdit(ctx: Context, page: number = 0): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const wallets = await storage.getWallets(ctx.from.id);
  
  if (wallets.length === 0) {
    await ctx.editMessageText(
      `${EMOJI.LIST} <b>Your Wallets</b>\n\n` +
      `📭 <i>No wallets monitored yet</i>\n\n` +
      `💡 Add your first wallet to start tracking activity!`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }
  
  // Calculate stats
  const totalAlerts = wallets.reduce((sum, w) => sum + (w.pendingAlerts?.length || 0), 0);
  const ruggersMonitored = wallets.filter(w => w.isKnownRugger).length;
  const alertsEnabled = wallets.filter(w => w.alertsEnabled).length;
  
  let message = `${EMOJI.CHART} <b>OVERVIEW</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `${EMOJI.WALLET} <b>Monitored:</b> ${wallets.length}/${MAX_WALLETS_PER_USER}\n`;
  
  if (ruggersMonitored > 0) {
    message += `${EMOJI.DANGER} <b>Ruggers:</b> ${ruggersMonitored}\n`;
  }
  
  if (alertsEnabled > 0) {
    message += `${EMOJI.ALERT} <b>Alerts:</b> ${alertsEnabled}\n`;
  }
  
  if (totalAlerts > 0) {
    message += `${EMOJI.FIRE} <b>Pending:</b> ${totalAlerts}\n`;
  }
  
  message += `\n${EMOJI.WALLET} <b>Your Wallets</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━\n`;
  message += `<i>Tap any wallet for options</i>`;

  await ctx.editMessageText(message, { 
    parse_mode: 'HTML', 
    reply_markup: walletListKeyboard(wallets) 
  });
}

/**
 * Handle wallet removal confirmation
 */
export async function handleConfirmRemoveWallet(ctx: Context, address: string): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const result = await storage.removeWallet(ctx.from.id, address);
  
  if (result.success) {
    unregisterWalletFromWatching(address);
    logger.info(`User ${ctx.from.id} removed wallet ${address.slice(0, 8)}...`);
  }
  
  await ctx.answerCallbackQuery({ text: result.message });
  await sendWalletListEdit(ctx);
}
