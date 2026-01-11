/**
 * Telegram Command & Callback Handlers
 * Simplified from 800+ lines → 400 lines
 */
import { Bot, Context, InlineKeyboard } from 'grammy';
import {
  getUser,
  addWallet,
  removeWallet,
  getWallets,
  updateSettings,
  updateWallet,
  getStats as getStorageStats,
} from './storage';
import { isValidAddress, getBalance, formatXN, getWalletUrl, testConnection } from './blockchain';
import { getWatcherStats } from './watcher';
import { config } from './config';
import { createLogger } from './logger';
import {
  getMainMenuKeyboard,
  getWalletListKeyboard,
  getWalletDetailKeyboard,
  getSettingsKeyboard,
  getConfirmKeyboard,
  getCancelKeyboard,
} from './keyboards';
import { escapeHtml, truncate, formatDate } from './utils';

const logger = createLogger('Handlers');

// Conversation state tracking
const conversationState = new Map<number, { action: string; data?: any }>();

/**
 * Setup all handlers
 */
export function setupHandlers(bot: Bot): void {
  // Commands
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('watch', handleWatchCommand);
  bot.command('list', handleList);
  bot.command('settings', handleSettings);
  bot.command('stats', handleStats);
  bot.command('status', handleStatus);
  
  // Callback queries
  bot.callbackQuery(/^menu:(.+)$/, handleMenuCallback);
  bot.callbackQuery(/^wallet:(.+)$/, handleWalletCallback);
  bot.callbackQuery(/^setting:(.+)$/, handleSettingCallback);
  bot.callbackQuery(/^confirm:(.+)$/, handleConfirmCallback);
  bot.callbackQuery('cancel', handleCancel);
  
  // Text messages (for conversation flow)
  bot.on('message:text', handleTextMessage);
  
  logger.info('Handlers registered');
}

/**
 * /start command
 */
async function handleStart(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const username = ctx.from?.username;
  getUser(telegramId, username); // Create user if not exists
  
  const message = `
🤖 <b>Welcome to X1 Wallet Watcher!</b>

I'll help you monitor X1 blockchain wallet addresses and notify you of:
• 📥 Incoming transactions
• 📤 Outgoing transactions  
• 📈 Balance changes

<b>Quick Start:</b>
Use /watch [address] [label] to add a wallet
Example: <code>/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU MyWallet</code>

Or use the menu below 👇
  `.trim();
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
}

/**
 * /help command
 */
async function handleHelp(ctx: Context): Promise<void> {
  const message = `
📚 <b>Available Commands:</b>

/start - Start bot & show main menu
/watch [address] [label] - Add a wallet to watch
/list - View your watched wallets
/settings - Configure notifications
/stats - View bot statistics
/status - Check bot & blockchain status
/help - Show this help message

<b>Examples:</b>
<code>/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU MyWallet</code>

<b>Limits:</b>
• Max wallets per user: ${config.maxWalletsPerUser}
• Poll interval: ${config.pollInterval / 1000}s
  `.trim();
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
}

/**
 * /watch command
 */
async function handleWatchCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const args = ctx.match as string;
  const parts = args.trim().split(/\s+/);
  
  if (parts.length === 0 || !parts[0]) {
    await ctx.reply(
      '❌ Please provide a wallet address.\n\nExample:\n<code>/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU MyWallet</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  const address = parts[0];
  const label = parts.slice(1).join(' ') || undefined;
  
  await addWalletHandler(ctx, telegramId, address, label);
}

/**
 * /list command
 */
async function handleList(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const wallets = getWallets(telegramId);
  
  if (wallets.length === 0) {
    await ctx.reply(
      '📭 You are not watching any wallets yet.\n\nUse /watch to add one!',
      { reply_markup: getCancelKeyboard() }
    );
    return;
  }
  
  await ctx.reply(
    `📍 <b>Your Watched Wallets (${wallets.length}/${config.maxWalletsPerUser}):</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: getWalletListKeyboard(wallets),
    }
  );
}

/**
 * /settings command
 */
async function handleSettings(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const user = getUser(telegramId);
  
  const message = `
⚙️ <b>Notification Settings:</b>

Configure which notifications you want to receive.
Current minimum value filter: <b>${user.settings.minValueXn} XN</b>
  `.trim();
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getSettingsKeyboard(user.settings),
  });
}

/**
 * /stats command
 */
async function handleStats(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const storageStats = getStorageStats();
  const watcherStats = getWatcherStats();
  const userWallets = getWallets(telegramId);
  
  const message = `
📊 <b>Bot Statistics:</b>

<b>Your Stats:</b>
• Watched wallets: ${userWallets.length}/${config.maxWalletsPerUser}

<b>Global Stats:</b>
• Total users: ${storageStats.totalUsers}
• Total wallets: ${storageStats.totalWallets}
• Watcher status: ${watcherStats.isWatching ? '✅ Active' : '❌ Inactive'}
• Poll interval: ${watcherStats.pollInterval / 1000}s
  `.trim();
  
  await ctx.reply(message, {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
}

/**
 * /status command
 */
async function handleStatus(ctx: Context): Promise<void> {
  await ctx.reply('🔍 Checking status...');
  
  const rpcOk = await testConnection();
  const watcherStats = getWatcherStats();
  
  const message = `
🔌 <b>Bot Status:</b>

<b>RPC Connection:</b> ${rpcOk ? '✅ Connected' : '❌ Failed'}
<b>RPC URL:</b> <code>${config.x1RpcUrl}</code>

<b>Watcher Service:</b> ${watcherStats.isWatching ? '✅ Running' : '❌ Stopped'}
<b>Poll Interval:</b> ${config.pollInterval / 1000}s
<b>Active Wallets:</b> ${watcherStats.activeWallets}
  `.trim();
  
  await ctx.reply(message, { parse_mode: 'HTML' });
}

/**
 * Handle menu callbacks
 */
async function handleMenuCallback(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const match = ctx.match as RegExpMatchArray;
  const action = match[1];
  
  await ctx.answerCallbackQuery();
  
  switch (action) {
    case 'main':
      await handleStart(ctx);
      break;
    case 'wallets':
      await handleList(ctx);
      break;
    case 'settings':
      await handleSettings(ctx);
      break;
    case 'stats':
      await handleStats(ctx);
      break;
    case 'help':
      await handleHelp(ctx);
      break;
    case 'add_wallet':
      conversationState.set(telegramId, { action: 'add_wallet' });
      await ctx.reply(
        '📝 Please send me the wallet address you want to watch.\n\nYou can also include a label:\n<code>address MyLabel</code>',
        { parse_mode: 'HTML', reply_markup: getCancelKeyboard() }
      );
      break;
  }
}

/**
 * Handle wallet callbacks
 */
async function handleWalletCallback(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const match = ctx.match as RegExpMatchArray;
  const [action, address] = match[1].split(':');
  
  await ctx.answerCallbackQuery();
  
  switch (action) {
    case 'view':
      await showWalletDetail(ctx, telegramId, address);
      break;
    case 'toggle':
      await toggleWalletAlerts(ctx, telegramId, address);
      break;
    case 'label':
      conversationState.set(telegramId, { action: 'edit_label', data: address });
      await ctx.reply(
        '📝 Send me the new label for this wallet:',
        { reply_markup: getCancelKeyboard() }
      );
      break;
    case 'remove':
      await ctx.editMessageText(
        '⚠️ Are you sure you want to stop watching this wallet?',
        { reply_markup: getConfirmKeyboard('remove', address) }
      );
      break;
  }
}

/**
 * Handle setting callbacks
 */
async function handleSettingCallback(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const match = ctx.match as RegExpMatchArray;
  const setting = match[1];
  
  await ctx.answerCallbackQuery();
  
  const user = getUser(telegramId);
  
  switch (setting) {
    case 'incoming':
      updateSettings(telegramId, { notifyIncoming: !user.settings.notifyIncoming });
      break;
    case 'outgoing':
      updateSettings(telegramId, { notifyOutgoing: !user.settings.notifyOutgoing });
      break;
    case 'balance':
      updateSettings(telegramId, { notifyBalanceChange: !user.settings.notifyBalanceChange });
      break;
    case 'minvalue':
      conversationState.set(telegramId, { action: 'set_minvalue' });
      await ctx.reply(
        `💰 Current minimum value: <b>${user.settings.minValueXn} XN</b>\n\nSend me the new minimum value (in XN):`,
        { parse_mode: 'HTML', reply_markup: getCancelKeyboard() }
      );
      return;
  }
  
  // Refresh settings
  await handleSettings(ctx);
}

/**
 * Handle confirm callbacks
 */
async function handleConfirmCallback(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const match = ctx.match as RegExpMatchArray;
  const [action, data] = match[1].split(':');
  
  await ctx.answerCallbackQuery();
  
  if (action === 'remove') {
    const removed = removeWallet(telegramId, data);
    if (removed) {
      await ctx.editMessageText('✅ Wallet removed successfully!');
      setTimeout(() => handleList(ctx), 1000);
    } else {
      await ctx.editMessageText('❌ Wallet not found.');
    }
  }
}

/**
 * Handle cancel callback
 */
async function handleCancel(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  conversationState.delete(telegramId);
  await ctx.answerCallbackQuery('Cancelled');
  await ctx.reply('❌ Cancelled.', { reply_markup: getMainMenuKeyboard() });
}

/**
 * Handle text messages (conversation flow)
 */
async function handleTextMessage(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  
  const state = conversationState.get(telegramId);
  if (!state) return;
  
  const text = ctx.message?.text;
  if (!text) return;
  
  conversationState.delete(telegramId);
  
  try {
    switch (state.action) {
      case 'add_wallet':
        const parts = text.trim().split(/\s+/);
        const address = parts[0];
        const label = parts.slice(1).join(' ') || undefined;
        await addWalletHandler(ctx, telegramId, address, label);
        break;
        
      case 'edit_label':
        updateWallet(telegramId, state.data, { label: text.trim() });
        await ctx.reply('✅ Label updated!', { reply_markup: getMainMenuKeyboard() });
        break;
        
      case 'set_minvalue':
        const value = parseFloat(text);
        if (isNaN(value) || value < 0) {
          await ctx.reply('❌ Invalid value. Please enter a positive number.');
        } else {
          updateSettings(telegramId, { minValueXn: value });
          await ctx.reply(`✅ Minimum value set to ${value} XN`, {
            reply_markup: getMainMenuKeyboard(),
          });
        }
        break;
    }
  } catch (error: any) {
    logger.error('Error in conversation handler', error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
}

/**
 * Add wallet helper
 */
async function addWalletHandler(
  ctx: Context,
  telegramId: number,
  address: string,
  label?: string
): Promise<void> {
  // Validate address
  if (!isValidAddress(address)) {
    await ctx.reply('❌ Invalid wallet address. Please check and try again.');
    return;
  }
  
  // Check wallet limit
  const wallets = getWallets(telegramId);
  if (wallets.length >= config.maxWalletsPerUser) {
    await ctx.reply(
      `❌ You've reached the maximum limit of ${config.maxWalletsPerUser} wallets.\n\nPlease remove a wallet before adding a new one.`
    );
    return;
  }
  
  try {
    // Get initial balance
    await ctx.reply('⏳ Adding wallet...');
    const balance = await getBalance(address);
    
    // Add to storage
    const wallet = addWallet(telegramId, address, label);
    updateWallet(telegramId, address, { lastBalance: balance.toString() });
    
    const message = `
✅ <b>Wallet added successfully!</b>

${label ? `📍 <b>Label:</b> ${escapeHtml(label)}\n` : ''}📬 <b>Address:</b> <code>${address}</code>
💰 <b>Balance:</b> ${formatXN(balance)}

You'll receive notifications for transactions on this wallet.
    `.trim();
    
    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('🔗 View on Explorer', getWalletUrl(address))
        .row()
        .text('🏠 Main Menu', 'menu:main'),
    });
  } catch (error: any) {
    logger.error('Error adding wallet', error);
    await ctx.reply(`❌ Error: ${error.message}`);
  }
}

/**
 * Show wallet detail
 */
async function showWalletDetail(ctx: Context, telegramId: number, address: string): Promise<void> {
  const wallets = getWallets(telegramId);
  const wallet = wallets.find(w => w.address === address);
  
  if (!wallet) {
    await ctx.editMessageText('❌ Wallet not found.');
    return;
  }
  
  const balance = wallet.lastBalance ? parseFloat(wallet.lastBalance) : 0;
  
  const message = `
📍 <b>Wallet Details</b>

${wallet.label ? `🏷️ <b>Label:</b> ${escapeHtml(wallet.label)}\n` : ''}📬 <b>Address:</b> <code>${address}</code>
💰 <b>Balance:</b> ${formatXN(balance)}
🔔 <b>Alerts:</b> ${wallet.alertsEnabled ? '✅ Enabled' : '❌ Disabled'}
📅 <b>Added:</b> ${formatDate(wallet.addedAt)}
${wallet.lastChecked ? `🕐 <b>Last checked:</b> ${formatDate(wallet.lastChecked)}` : ''}
  `.trim();
  
  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    reply_markup: getWalletDetailKeyboard(address),
  });
}

/**
 * Toggle wallet alerts
 */
async function toggleWalletAlerts(ctx: Context, telegramId: number, address: string): Promise<void> {
  const wallets = getWallets(telegramId);
  const wallet = wallets.find(w => w.address === address);
  
  if (!wallet) {
    await ctx.answerCallbackQuery('❌ Wallet not found');
    return;
  }
  
  updateWallet(telegramId, address, { alertsEnabled: !wallet.alertsEnabled });
  
  await ctx.answerCallbackQuery(
    wallet.alertsEnabled ? '🔕 Alerts disabled' : '🔔 Alerts enabled'
  );
  
  await showWalletDetail(ctx, telegramId, address);
}
