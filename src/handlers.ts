import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { 
  getOrCreateUser, 
  addWallet, 
  removeWallet, 
  getUserWallets,
  getUserSettings,
  updateUserSettings,
  getStats,
  addTokenToWallet,
  removeTokenFromWallet,
  getWalletTokens
} from './storage';
import { WatchedWallet } from './types';
import { 
  isValidAddress, 
  getChecksumAddress, 
  getBalance,
  getAddressExplorerUrl,
  isConnected,
  getTokenInfo,
  getTokenBalance,
  formatTokenBalance,
  getWalletActivityStats,
  getWalletActivityStatsFast,
  getAllTokenAccounts
} from './blockchain';
import { checkWalletSecurity, formatSecurityInfo } from './security';
import { performEnhancedSecurityScan, formatEnhancedSecurityResult } from './enhanced-security-scanner';
import { getTokenPrice, formatPrice, formatValueUsd } from './prices';
import { getUserPortfolioSummary, formatPortfolioValue as formatPortfolioValueFromModule } from './portfolio';
import { exportWalletTransactionsCsv, exportAllWalletsCsv, generateExportFilename } from './export';
import { paginateArray, createPaginationKeyboard, extractPageNumber } from './pagination';
import { 
  sendPortfolioView, 
  sendPortfolioViewEdit, 
  sendExportMenu, 
  sendExportMenuEdit,
  handleExportWallet,
  handleExportAllWallets,
  handleMuteWallet
} from './handlers-portfolio';
import { 
  mainMenuKeyboard, 
  backToMenuKeyboard,
  walletListKeyboard,
  walletActionKeyboard,
  confirmRemoveKeyboard,
  settingsKeyboard,
  minValueKeyboard,
  cancelKeyboard,
  walletDetailKeyboard,
  tokenListKeyboard,
  selectWalletKeyboard,
  portfolioKeyboard,
  securityKeyboard
} from './keyboards';
import { registerWalletForWatching, unregisterWalletFromWatching, getPendingTransactions, clearPendingTransactions } from './watcher';
import { getTxExplorerUrl } from './blockchain';
import { config } from './config';
import { TrackedToken, TokenProgram } from './types';
import { createLogger } from './logger';

const logger = createLogger('Handlers');

// Session data interface
export interface SessionData {
  awaitingWalletAddress?: boolean;
  awaitingWalletLabel?: string; // stores the address while waiting for label
  awaitingTokenAddress?: string; // stores wallet address while waiting for token contract
  walletListPage?: number; // current page for wallet list
  portfolioPage?: number; // current page for portfolio view
}

// Custom context with session
export type MyContext = Context & SessionFlavor<SessionData>;

// Helper to escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Format token amount for display
function formatTokenAmount(amount: number): string {
  if (amount === 0) return '0';
  if (amount < 0.0001) return '&lt; 0.0001';
  if (amount < 1) return amount.toFixed(4);
  if (amount < 1000) return amount.toFixed(2);
  if (amount < 1000000) return `${(amount / 1000).toFixed(2)}K`;
  if (amount < 1000000000) return `${(amount / 1000000).toFixed(2)}M`;
  return `${(amount / 1000000000).toFixed(2)}B`;
}

// Get display name for a token (from DeployedTokenInfo)
function getTokenDisplayName(token: { mint: string; name?: string; symbol?: string }): string {
  // Always show ticker if available
  if (token.symbol && token.symbol.length > 0 && !token.symbol.startsWith('Token ')) {
    // Show ticker prominently
    if (token.name && token.name !== token.symbol && !token.name.startsWith('Token ')) {
      return `$${token.symbol} (${token.name})`;
    } else {
      return `$${token.symbol}`;
    }
  } else if (token.name && token.name.length > 0 && !token.name.startsWith('Token ')) {
    // Fallback to name only if no ticker
    return token.name;
  } else {
    // Use mint prefix as identifier
    return `$${token.mint.slice(0, 6)}...`;
  }
}

// Setup handlers
export function setupHandlers(bot: Bot<MyContext>): void {

  // /start command
  bot.command('start', async (ctx) => {
    const user = ctx.from;
    if (!user) return;

    getOrCreateUser(user.id, user.username);

    // Check if user has any wallets
    const userWallets = getUserWallets(user.id);
    
    // Same welcome message for all users
    const welcomeMessage = `👋 <b>Welcome to X1 Wallet Sniffer!</b>

🛡️ <b>Your Shield Against Crypto Scams</b>

<b>What I Do:</b>
🚨 Detect ruggers & scammers instantly
🔍 Track funding chains to bad actors
⚠️ Real-time security risk analysis
📊 Monitor wallet activity & alerts

🚀 <b>Get Started:</b>
Tap "<b>➕ Add Wallet</b>" to scan your first address for threats.

💡 Monitor up to ${config.maxWalletsPerUser} wallets for free!`;

    const settings = getUserSettings(user.id);
    await ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(settings.transactionsEnabled),
    });
  });

  // /help command
  bot.command('help', async (ctx) => {
    await sendHelpMessage(ctx);
  });

  // /watch command
  bot.command('watch', async (ctx) => {
    const args = ctx.message?.text?.split(' ').slice(1);
    
    if (args && args.length > 0) {
      // Direct address provided
      await handleWatchAddress(ctx, args[0], args.slice(1).join(' ') || undefined);
    } else {
      // Ask for address
      ctx.session.awaitingWalletAddress = true;
      await ctx.reply(
        '📝 <b>Send me the wallet address</b> you want to watch:\n\n<i>Example: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU</i>',
        { parse_mode: 'HTML', reply_markup: cancelKeyboard() }
      );
    }
  });

  // /unwatch command
  bot.command('unwatch', async (ctx) => {
    const args = ctx.message?.text?.split(' ').slice(1);
    
    if (args && args.length > 0) {
      await handleUnwatchAddress(ctx, args[0]);
    } else {
      await ctx.reply('Usage: /unwatch <address>');
    }
  });

  // /list command
  bot.command('list', async (ctx) => {
    await sendWalletList(ctx);
  });

  // /settings command
  bot.command('settings', async (ctx) => {
    await sendSettings(ctx);
  });

  // /stats command
  bot.command('stats', async (ctx) => {
    await sendStats(ctx);
  });

  // /status command - check bot and blockchain connection
  bot.command('status', async (ctx) => {
    const connected = await isConnected();
    const statusEmoji = connected ? '✅' : '❌';
    
    await ctx.reply(
      `🤖 <b>Bot Status</b>\n\n` +
      `${statusEmoji} X1 Blockchain: ${connected ? 'Connected' : 'Disconnected'}\n` +
      `🌐 RPC: <code>${config.x1RpcUrl}</code>\n` +
      `⏱️ Poll Interval: ${config.pollInterval / 1000}s`,
      { parse_mode: 'HTML' }
    );
  });

  // /portfolio command - show portfolio with USD values
  bot.command('portfolio', async (ctx) => {
    await sendPortfolioView(ctx);
  });

  // /export command - export transactions to CSV
  bot.command('export', async (ctx) => {
    await sendExportMenu(ctx);
  });

  // /addtoken command
  bot.command('addtoken', async (ctx) => {
    const wallets = getUserWallets(ctx.from!.id);
    
    if (wallets.length === 0) {
      await ctx.reply(
        '❌ You need to add at least one wallet first!\n\nUse /watch to add a wallet.',
        { reply_markup: mainMenuKeyboard() }
      );
      return;
    }
    
    if (wallets.length === 1) {
      // Only one wallet, skip selection
      ctx.session.awaitingTokenAddress = wallets[0].address;
      await ctx.reply(
        '🪙 <b>Add SPL Token to Track</b>\n\n' +
        'Send me the <b>token mint address</b> you want to track:\n\n' +
        '<i>Example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC)</i>',
        { parse_mode: 'HTML', reply_markup: cancelKeyboard() }
      );
    } else {
      // Multiple wallets, show selection
      await ctx.reply(
        '🪙 <b>Select Wallet</b>\n\nWhich wallet do you want to add a token to?',
        { parse_mode: 'HTML', reply_markup: selectWalletKeyboard(wallets, 'add_token') }
      );
    }
  });

  // Handle text messages (for wallet address input)
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    
    // Check if awaiting wallet address
    if (ctx.session.awaitingWalletAddress) {
      ctx.session.awaitingWalletAddress = false;
      
      if (isValidAddress(text)) {
        ctx.session.awaitingWalletLabel = text;
        await ctx.reply(
          '✅ Valid address!\n\n📝 <b>Send a label/name</b> for this wallet (optional):\n\n<i>Or send "skip" to continue without a label</i>',
          { parse_mode: 'HTML', reply_markup: cancelKeyboard() }
        );
      } else {
        await ctx.reply(
          '❌ <b>Invalid address!</b>\n\nPlease send a valid X1 wallet address.',
          { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
        );
      }
      return;
    }
    
    // Check if awaiting label
    if (ctx.session.awaitingWalletLabel) {
      const address = ctx.session.awaitingWalletLabel;
      ctx.session.awaitingWalletLabel = undefined;
      
      // Ensure user is initialized before handling
      if (ctx.from) {
        getOrCreateUser(ctx.from.id, ctx.from.username);
      }
      
      const label = text.toLowerCase() === 'skip' ? undefined : text;
      await handleWatchAddress(ctx, address, label);
      return;
    }
    
    // Check if awaiting token address
    if (ctx.session.awaitingTokenAddress) {
      const walletAddress = ctx.session.awaitingTokenAddress;
      ctx.session.awaitingTokenAddress = undefined;
      
      await handleAddToken(ctx, walletAddress, text);
      return;
    }
  });

  // Callback query handlers
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    
    // Main menu
    if (data === 'main_menu') {
      const settings = getUserSettings(ctx.from!.id);
      await ctx.editMessageText(
        '🏠 <b>Main Menu</b>\n\nWhat would you like to do?',
        { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(settings.transactionsEnabled) }
      );
    }
    
    // Watch wallet
    else if (data === 'watch_wallet') {
      ctx.session.awaitingWalletAddress = true;
      await ctx.editMessageText(
        '📝 <b>Send me the wallet address</b> you want to watch:\n\n<i>Example: 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU</i>',
        { parse_mode: 'HTML', reply_markup: cancelKeyboard() }
      );
    }
    
    // List wallets (Wallet Sniffer)
    else if (data === 'list_wallets') {
      await sendWalletListEdit(ctx);
    }
    
    // View all alerts
    else if (data === 'view_alerts') {
      await viewAllAlerts(ctx);
    }
    
    // Clear alert for a wallet
    else if (data.startsWith('clear_alert_')) {
      const address = data.replace('clear_alert_', '');
      await clearWalletAlerts(ctx, address);
    }
    
    // Clear all alerts
    else if (data === 'clear_all_alerts') {
      if (ctx.from) {
        const wallets = getUserWallets(ctx.from.id);
        wallets.forEach(w => w.pendingAlerts = []);
        await ctx.answerCallbackQuery({ text: '✅ All alerts cleared!' });
        await sendWalletListEdit(ctx);
      }
    }
    
    // Toggle rugger alerts for a wallet
    else if (data.startsWith('toggle_alert_')) {
      const address = data.replace('toggle_alert_', '');
      await toggleRuggerAlert(ctx, address);
    }
    
    // Settings
    else if (data === 'settings') {
      await sendSettingsEdit(ctx);
    }
    
    // Stats
    else if (data === 'stats') {
      await sendStatsEdit(ctx);
    }
    
    // Help
    else if (data === 'help') {
      await sendHelpEdit(ctx);
    }
    
    // Toggle notifications master switch (from settings)
    else if (data === 'toggle_notifications') {
      const settings = getUserSettings(ctx.from!.id);
      updateUserSettings(ctx.from!.id, { transactionsEnabled: !settings.transactionsEnabled });
      const status = !settings.transactionsEnabled ? '🔔 Notifications ON' : '🔕 Notifications OFF';
      await ctx.answerCallbackQuery({ text: status });
      await sendSettingsEdit(ctx);
    }
    
    // Toggle notifications master switch (from main menu)
    else if (data === 'toggle_notifications_main') {
      if (!ctx.from) {
        await ctx.answerCallbackQuery({ text: '❌ Error: User not found' });
        return;
      }
      
      const settings = getUserSettings(ctx.from.id);
      const newStatus = !settings.transactionsEnabled;
      updateUserSettings(ctx.from.id, { transactionsEnabled: newStatus });
      
      const status = newStatus ? '🔔 Notifications turned ON' : '🔕 Notifications turned OFF';
      await ctx.answerCallbackQuery({ text: status, show_alert: false });
      
      // Update the main menu to show new status
      await ctx.editMessageText(
        '🏠 <b>Main Menu</b>\n\nWhat would you like to do?',
        { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(newStatus) }
      );
    }
    
    // Toggle settings
    else if (data === 'toggle_incoming') {
      const settings = getUserSettings(ctx.from!.id);
      updateUserSettings(ctx.from!.id, { incoming: !settings.incoming });
      await sendSettingsEdit(ctx);
    }
    else if (data === 'toggle_outgoing') {
      const settings = getUserSettings(ctx.from!.id);
      updateUserSettings(ctx.from!.id, { outgoing: !settings.outgoing });
      await sendSettingsEdit(ctx);
    }
    else if (data === 'toggle_contracts') {
      const settings = getUserSettings(ctx.from!.id);
      updateUserSettings(ctx.from!.id, { contractInteractions: !settings.contractInteractions });
      await sendSettingsEdit(ctx);
    }
    
    // Set min value
    else if (data === 'set_min_value') {
      await ctx.editMessageText(
        '💰 <b>Set Minimum Value</b>\n\nChoose the minimum transaction value to be notified about:',
        { parse_mode: 'HTML', reply_markup: minValueKeyboard() }
      );
    }
    else if (data.startsWith('min_value_')) {
      const value = parseFloat(data.replace('min_value_', ''));
      updateUserSettings(ctx.from!.id, { minValue: value });
      await sendSettingsEdit(ctx);
    }
    
    // Remove wallet
    else if (data.startsWith('remove_')) {
      const address = data.replace('remove_', '');
      await ctx.editMessageText(
        `⚠️ <b>Remove Wallet?</b>\n\n<code>${address}</code>\n\nAre you sure you want to stop watching this wallet?`,
        { parse_mode: 'HTML', reply_markup: confirmRemoveKeyboard(address) }
      );
    }
    else if (data.startsWith('confirm_remove_')) {
      const address = data.replace('confirm_remove_', '');
      const result = removeWallet(ctx.from!.id, address);
      
      if (result.success) {
        unregisterWalletFromWatching(address);
      }
      
      await ctx.answerCallbackQuery({ text: result.message });
      await sendWalletListEdit(ctx);
    }
    
    // Toggle balance alerts
    else if (data === 'toggle_balance') {
      const settings = getUserSettings(ctx.from!.id);
      updateUserSettings(ctx.from!.id, { balanceAlerts: !settings.balanceAlerts });
      await sendSettingsEdit(ctx);
    }
    
    // Wallet menu (show action buttons for specific wallet)
    else if (data.startsWith('wallet_menu_')) {
      const address = data.replace('wallet_menu_', '');
      await showWalletActionMenu(ctx, address);
    }
    
    // Wallet detail view
    else if (data.startsWith('wallet_detail_')) {
      const address = data.replace('wallet_detail_', '');
      await sendWalletDetail(ctx, address);
    }
    
    // Wallet info (when tapping wallet label - just show wallet list again)
    else if (data.startsWith('wallet_info_')) {
      const address = data.replace('wallet_info_', '');
      await ctx.answerCallbackQuery({ text: `Wallet: ${address.slice(0, 6)}...${address.slice(-4)}` });
    }
    
    // Add token to wallet
    else if (data.startsWith('add_token_')) {
      const walletAddress = data.replace('add_token_', '');
      ctx.session.awaitingTokenAddress = walletAddress;
      await ctx.editMessageText(
        '🪙 <b>Add SPL Token to Track</b>\n\n' +
        'Send me the <b>token mint address</b> you want to track:\n\n' +
        '<i>Example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (USDC)</i>',
        { parse_mode: 'HTML', reply_markup: cancelKeyboard() }
      );
    }
    
    // View tokens for wallet
    else if (data.startsWith('view_tokens_')) {
      const walletAddress = data.replace('view_tokens_', '');
      await sendTokenList(ctx, walletAddress);
    }
    
    // Remove token from wallet
    else if (data.startsWith('remove_token_')) {
      const parts = data.replace('remove_token_', '').split('_');
      const walletAddress = parts[0];
      const tokenAddress = parts.slice(1).join('_');
      
      const result = removeTokenFromWallet(ctx.from!.id, walletAddress, tokenAddress);
      await ctx.answerCallbackQuery({ text: result.message });
      await sendTokenList(ctx, walletAddress);
    }
    
    // Refresh wallet balance
    else if (data.startsWith('refresh_')) {
      const address = data.replace('refresh_', '');
      try {
        const balance = await getBalance(address);
        await ctx.answerCallbackQuery({ text: `Balance: ${balance} XNT` });
        await sendWalletDetail(ctx, address);
      } catch (e) {
        await ctx.answerCallbackQuery({ text: 'Error fetching balance' });
      }
    }
    
    // Discover all tokens in wallet
    else if (data.startsWith('discover_tokens_')) {
      const walletAddress = data.replace('discover_tokens_', '');
      await discoverWalletTokens(ctx, walletAddress);
    }
    
    // Deep security check
    else if (data.startsWith('security_check_')) {
      const walletAddress = data.replace('security_check_', '');
      await performSecurityCheck(ctx, walletAddress);
    }
    
    // View transaction details
    else if (data.startsWith('view_tx_details_')) {
      const walletAddress = data.replace('view_tx_details_', '');
      await showTransactionDetails(ctx, walletAddress);
    }
    
    // Dismiss transaction notification
    else if (data.startsWith('dismiss_tx_')) {
      const walletAddress = data.replace('dismiss_tx_', '');
      clearPendingTransactions(walletAddress);
      await ctx.editMessageText('✅ Notifications cleared.', { parse_mode: 'HTML' });
    }
    
    // Portfolio view
    else if (data === 'portfolio') {
      await sendPortfolioViewEdit(ctx);
    }
    
    // Portfolio pagination
    else if (data.startsWith('portfolio_page_')) {
      const page = extractPageNumber(data, 'portfolio_page');
      ctx.session.portfolioPage = page;
      await sendPortfolioViewEdit(ctx);
    }
    
    // Export menu
    else if (data === 'export') {
      await sendExportMenuEdit(ctx);
    }
    
    // Export single wallet
    else if (data.startsWith('export_wallet_')) {
      const walletAddress = data.replace('export_wallet_', '');
      await handleExportWallet(ctx, walletAddress);
    }
    
    // Export all wallets
    else if (data === 'export_all') {
      await handleExportAllWallets(ctx);
    }
    
    // Wallet list pagination
    else if (data.startsWith('wallet_page_')) {
      const page = extractPageNumber(data, 'wallet_page');
      ctx.session.walletListPage = page;
      await sendWalletListEdit(ctx, page);
    }
    
    // Quick actions
    else if (data.startsWith('mute_1h_')) {
      const walletAddress = data.replace('mute_1h_', '');
      await handleMuteWallet(ctx, walletAddress, 60);
    }
    else if (data.startsWith('mute_24h_')) {
      const walletAddress = data.replace('mute_24h_', '');
      await handleMuteWallet(ctx, walletAddress, 1440);
    }
    
    await ctx.answerCallbackQuery();
  });
}

// Helper functions
async function handleWatchAddress(ctx: MyContext, address: string, label?: string): Promise<void> {
  if (!ctx.from) return;

  // Ensure user exists in storage
  getOrCreateUser(ctx.from.id, ctx.from.username);

  if (!isValidAddress(address)) {
    await ctx.reply(
      '❌ <b>Invalid address!</b>\n\nPlease provide a valid X1 wallet address.',
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
    return;
  }

  const checksumAddress = getChecksumAddress(address);
  const result = addWallet(ctx.from.id, checksumAddress, label);

  if (result.success) {
    registerWalletForWatching(checksumAddress);
    
    // Get current balance
    let balanceInfo = '';
    try {
      const balance = await getBalance(checksumAddress);
      balanceInfo = `\n💰 Current Balance: <b>${balance} XNT</b>`;
    } catch (e) {
      // Ignore balance fetch errors
    }

    await ctx.reply(
      `✅ <b>Wallet Added!</b>\n\n` +
      `📍 Address: <code>${checksumAddress}</code>` +
      (label ? `\n🏷️ Label: ${label}` : '') +
      balanceInfo +
      `\n\n🔗 <a href="${getAddressExplorerUrl(checksumAddress)}">View on Explorer</a>\n\n` +
      `I'll notify you when there's activity on this wallet!`,
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
  } else {
    await ctx.reply(
      `❌ ${result.message}`,
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
  }
}

async function handleUnwatchAddress(ctx: Context, address: string): Promise<void> {
  if (!ctx.from) return;

  const result = removeWallet(ctx.from.id, address);
  
  if (result.success) {
    unregisterWalletFromWatching(address);
  }
  
  await ctx.reply(result.message, { reply_markup: mainMenuKeyboard() });
}

async function sendWalletList(ctx: Context, page: number = 0): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);
  
  if (wallets.length === 0) {
    await ctx.reply(
      '📭 <i>No wallets monitored yet</i>\n\n' +
      '💡 Add your first wallet to start tracking rugger activity, token deployments, and LP changes!\n\n' +
      '👇 Tap below to get started',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  // Calculate stats
  const totalAlerts = wallets.reduce((sum, w) => sum + (w.pendingAlerts?.length || 0), 0);
  const ruggersMonitored = wallets.filter(w => w.isKnownRugger).length;
  const alertsEnabled = wallets.filter(w => w.alertsEnabled).length;
  
  // Professional header with stats
  let message = '';
  
  // Stats section
  message += '📊 <b>Wallets under watch</b>\n';
  message += '━━━━━━━━━━━━━━━━━━━\n';
  message += `👁️ Monitored: <b>${wallets.length}/${config.maxWalletsPerUser}</b> wallets\n`;
  
  if (ruggersMonitored > 0) {
    message += `🚨 Ruggers: <b>${ruggersMonitored}</b> tracked\n`;
  }
  
  if (alertsEnabled > 0) {
    message += `🔔 Alerts: <b>${alertsEnabled}</b> active\n`;
  }
  
  if (totalAlerts > 0) {
    message += `🔴 Pending: <b>${totalAlerts}</b> alert${totalAlerts > 1 ? 's' : ''}\n`;
  }
  
  message += '\n<i>Tap any wallet for options</i>';

  // Paginate if there are many wallets
  const WALLETS_PER_PAGE = 5;
  const paginated = paginateArray(wallets, page, WALLETS_PER_PAGE);
  
  // Build keyboard with pagination
  const keyboard = walletListKeyboard(paginated.items);
  
  // Add pagination buttons if needed
  if (paginated.totalPages > 1) {
    const paginationRow = createPaginationKeyboard({
      currentPage: paginated.currentPage,
      totalPages: paginated.totalPages,
      itemsPerPage: WALLETS_PER_PAGE,
      callbackPrefix: 'wallet_page',
    });
    // Merge pagination keyboard into main keyboard
    keyboard.row();
    // Note: InlineKeyboard doesn't have a direct merge method, so we add buttons manually
  }

  await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard });
}

async function sendWalletListEdit(ctx: Context, page: number = 0): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);
  
  if (wallets.length === 0) {
    await ctx.editMessageText(
      '🔍 <b>Wallet Sniffer</b>\n\n' +
      '📭 <i>No wallets added yet!</i>\n\n' +
      '🚀 <b>Ready to start monitoring?</b>\n\n' +
      '💡 Add your first wallet to track:\n' +
      '  • 🚨 Rugger activity & scams\n' +
      '  • 🪙 Token deployments\n' +
      '  • 💧 LP changes & dumps\n' +
      '  • 💰 Balance changes\n' +
      '  • 📊 Transaction alerts\n\n' +
      '👉 Tap "<b>Add Wallet</b>" from the main menu to get started!\n\n' +
      'Or use: <code>/watch &lt;wallet_address&gt; [label]</code>',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }
  
  // Calculate stats
  const totalAlerts = wallets.reduce((sum, w) => sum + (w.pendingAlerts?.length || 0), 0);
  const ruggersMonitored = wallets.filter(w => w.isKnownRugger).length;
  const alertsEnabled = wallets.filter(w => w.alertsEnabled).length;
  
  // Professional header with stats
  let message = '';
  
  // Stats section
  message += '📊 <b>Wallets under watch</b>\n';
  message += '━━━━━━━━━━━━━━━━━━━\n';
  message += `👁️ Monitored: <b>${wallets.length}/${config.maxWalletsPerUser}</b> wallets\n`;
  
  if (ruggersMonitored > 0) {
    message += `🚨 Ruggers: <b>${ruggersMonitored}</b> tracked\n`;
  }
  
  if (alertsEnabled > 0) {
    message += `🔔 Alerts: <b>${alertsEnabled}</b> active\n`;
  }
  
  if (totalAlerts > 0) {
    message += `🔴 Pending: <b>${totalAlerts}</b> alert${totalAlerts > 1 ? 's' : ''}\n`;
  }
  
  message += '\n<i>Tap any wallet for options</i>';

  await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: walletListKeyboard(wallets) });
}

async function sendSettings(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const settings = getUserSettings(ctx.from.id);
  
  await ctx.reply(
    '⚙️ <b>Notification Settings</b>\n\nCustomize what transactions you want to be notified about:',
    { parse_mode: 'HTML', reply_markup: settingsKeyboard(settings) }
  );
}

async function sendSettingsEdit(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  const settings = getUserSettings(ctx.from.id);
  
  await ctx.editMessageText(
    '⚙️ <b>Notification Settings</b>\n\nCustomize what transactions you want to be notified about:',
    { parse_mode: 'HTML', reply_markup: settingsKeyboard(settings) }
  );
}

async function sendStats(ctx: Context): Promise<void> {
  const stats = getStats();
  const userWallets = ctx.from ? getUserWallets(ctx.from.id).length : 0;
  
  await ctx.reply(
    `📊 <b>Bot Statistics</b>\n\n` +
    `👤 Your Wallets: ${userWallets}\n` +
    `👥 Total Users: ${stats.totalUsers}\n` +
    `👀 Total Wallets Watched: ${stats.totalWallets}\n` +
    `📨 Notifications Sent: ${stats.totalNotificationsSent}`,
    { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
  );
}

async function sendStatsEdit(ctx: Context): Promise<void> {
  const stats = getStats();
  const userWallets = ctx.from ? getUserWallets(ctx.from.id).length : 0;
  
  await ctx.editMessageText(
    `📊 <b>Bot Statistics</b>\n\n` +
    `👤 Your Wallets: ${userWallets}\n` +
    `👥 Total Users: ${stats.totalUsers}\n` +
    `👀 Total Wallets Watched: ${stats.totalWallets}\n` +
    `📨 Notifications Sent: ${stats.totalNotificationsSent}`,
    { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
  );
}

async function sendHelpMessage(ctx: Context): Promise<void> {
  const helpText = `
❓ <b>Help & Commands</b>

<b>Commands:</b>
/start - Start the bot & show menu
/watch [address] [label] - Watch a wallet
/unwatch [address] - Stop watching a wallet
/list - List your watched wallets
/addtoken - Add an SPL token to track
/settings - Notification settings
/stats - View statistics
/status - Check bot & blockchain status
/help - Show this help message

<b>How it works:</b>
1. Add wallet addresses to watch
2. Optionally track SPL tokens for each wallet
3. Configure your notification preferences
4. Get instant alerts when there's activity!

<b>Tips:</b>
• You can watch up to ${config.maxWalletsPerUser} wallets
• Track up to 10 SPL tokens per wallet
• Use labels to easily identify wallets
• Set minimum value to filter small transactions

<b>X1 Blockchain:</b>
X1 is SVM-based. Send any valid X1 wallet address (base58 public key)!
  `;

  await ctx.reply(helpText, { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() });
}

async function sendHelpEdit(ctx: Context): Promise<void> {
  const helpText = `
❓ <b>Help & Commands</b>

<b>Commands:</b>
/start - Start the bot & show menu
/watch [address] [label] - Watch a wallet
/unwatch [address] - Stop watching a wallet
/list - List your watched wallets
/addtoken - Add an SPL token to track
/settings - Notification settings
/stats - View statistics
/status - Check bot & blockchain status
/help - Show this help message

<b>How it works:</b>
1. Add wallet addresses to watch
2. Optionally track SPL tokens for each wallet
3. Configure your notification preferences
4. Get instant alerts when there's activity!

<b>Tips:</b>
• You can watch up to ${config.maxWalletsPerUser} wallets
• Track up to 10 SPL tokens per wallet
• Use labels to easily identify wallets
• Set minimum value to filter small transactions

<b>X1 Blockchain:</b>
X1 is SVM-based. Send any valid X1 wallet address (base58 public key)!
  `;

  await ctx.editMessageText(helpText, { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() });
}

// Handle adding a token to a wallet
async function handleAddToken(ctx: MyContext, walletAddress: string, tokenAddress: string): Promise<void> {
  if (!ctx.from) return;

  // Ensure user exists in storage
  getOrCreateUser(ctx.from.id, ctx.from.username);

  // Validate token address
  if (!isValidAddress(tokenAddress)) {
    await ctx.reply(
      '❌ <b>Invalid address!</b>\n\nPlease provide a valid token contract address.',
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
    return;
  }

  const checksumToken = getChecksumAddress(tokenAddress);

  // Show loading message
  const loadingMsg = await ctx.reply('🔍 Validating token contract...');

  try {
    // Get token info
    const tokenInfo = await getTokenInfo(checksumToken);
    
    if (!tokenInfo) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        loadingMsg.message_id,
        '❌ <b>Invalid Token!</b>\n\nThis doesn\'t appear to be a valid SPL token mint.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Create token object
    const token: TrackedToken = {
      contractAddress: checksumToken,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      program: tokenInfo.program,
    };

    // Add token to wallet
    const result = addTokenToWallet(ctx.from.id, walletAddress, token);

    if (result.success) {
      // Get current balance
      let balanceInfo = '';
      try {
        const balance = await getTokenBalance(checksumToken, walletAddress);
        if (balance) {
          balanceInfo = `\n💰 Current Balance: <b>${formatTokenBalance(balance, token.symbol)}</b>`;
        }
      } catch (e) {
        // Ignore balance fetch errors
      }

      const programLabel = tokenInfo.program === 'token-2022' ? '🆕 Token-2022' : '🔷 SPL Token';
      
      await ctx.api.editMessageText(
        ctx.chat!.id,
        loadingMsg.message_id,
        `✅ <b>Token Added!</b>\n\n` +
        `🪙 <b>Token:</b> ${tokenInfo.name} (${tokenInfo.symbol})\n` +
        `📍 <b>Mint:</b> <code>${checksumToken}</code>\n` +
        `⚙️ <b>Program:</b> ${programLabel}` +
        balanceInfo +
        `\n\nI'll notify you when this token balance changes!`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        loadingMsg.message_id,
        `❌ ${result.message}`,
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    logger.error('Error adding token:', error);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMsg.message_id,
      '❌ Error validating token. Please try again.',
      { parse_mode: 'HTML' }
    );
  }
}

// View all pending alerts across all wallets
async function viewAllAlerts(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);
  
  // Collect all alerts from all wallets
  const allAlerts: Array<{wallet: WatchedWallet, alert: any}> = [];
  wallets.forEach(wallet => {
    if (wallet.pendingAlerts && wallet.pendingAlerts.length > 0) {
      wallet.pendingAlerts.forEach(alert => {
        allAlerts.push({ wallet, alert });
      });
    }
  });

  if (allAlerts.length === 0) {
    await ctx.editMessageText(
      '🚨 <b>Rugger Alerts</b>\n\nNo pending alerts.\n\nAlerts will appear here when watched wallets deploy tokens or add/remove LP.',
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
    return;
  }

  // Sort by timestamp (newest first)
  allAlerts.sort((a, b) => b.alert.timestamp - a.alert.timestamp);

  let message = `🚨 <b>Rugger Alerts</b> (${allAlerts.length})\n\n`;

  allAlerts.forEach(({ wallet, alert }, index) => {
    const label = wallet.label || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
    const time = new Date(alert.timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let icon = '🪙';
    if (alert.type === 'lp_added') icon = '💧';
    if (alert.type === 'lp_removed') icon = '⚠️';

    message += `${icon} <b>${label}</b>\n`;
    message += `   ${alert.details}\n`;
    message += `   <i>${time}</i>\n\n`;
  });

  const keyboard = new InlineKeyboard();
  
  // Add "Clear All" button
  keyboard.text('🗑️ Clear All Alerts', 'clear_all_alerts').row();
  keyboard.text('« Back to Wallets', 'list_wallets');

  await ctx.editMessageText(message, { 
    parse_mode: 'HTML', 
    reply_markup: keyboard
  });
}

// Clear alerts for a specific wallet
async function clearWalletAlerts(ctx: Context, address: string): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);
  const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());

  if (!wallet) {
    await ctx.answerCallbackQuery({ text: '❌ Wallet not found' });
    return;
  }

  wallet.pendingAlerts = [];

  await ctx.answerCallbackQuery({ text: '✅ Alerts cleared!' });
  await showWalletActionMenu(ctx, address);
}

// Toggle rugger alert for a wallet
async function toggleRuggerAlert(ctx: Context, address: string): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);
  const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());

  if (!wallet) {
    await ctx.answerCallbackQuery({ text: '❌ Wallet not found' });
    return;
  }

  // Toggle alert status
  wallet.alertsEnabled = !wallet.alertsEnabled;
  
  // Note: Wallet changes are automatically saved through storage reference
  // No need to explicitly save here as getUserWallets returns a reference

  const status = wallet.alertsEnabled ? 'enabled' : 'disabled';
  const icon = wallet.alertsEnabled ? '🔔' : '🔕';
  
  await ctx.answerCallbackQuery({ 
    text: `${icon} Rugger alerts ${status}!`,
    show_alert: true 
  });

  // Refresh the wallet menu to show updated button
  await showWalletActionMenu(ctx, address);
}

// Show wallet action menu (compact view with action buttons)
async function showWalletActionMenu(ctx: Context, address: string): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);
  const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());

  if (!wallet) {
    await ctx.editMessageText('❌ Wallet not found.', { reply_markup: backToMenuKeyboard() });
    return;
  }

  const label = wallet.label || `Wallet ${address.slice(0, 6)}...${address.slice(-4)}`;
  const balance = wallet.lastBalance || 'Loading...';
  
  // Fetch fresh balance
  let freshBalance = balance;
  try {
    freshBalance = await getBalance(address);
  } catch (e) {
    // Use cached
  }
  
  // Try to get wallet creation date
  let creationDate = '';
  try {
    const stats = await getWalletActivityStatsFast(wallet.address);
    if (stats.firstTxDate) {
      const walletAge = Math.floor((Date.now() - stats.firstTxDate.getTime()) / (1000 * 60 * 60 * 24));
      const dateStr = stats.firstTxDate.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = stats.firstTxDate.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
      creationDate = `\n⏰ Created: ${dateStr} at ${timeStr} UTC (~${walletAge} days ago)`;
    }
  } catch (e) {
    // Skip if error
  }
  
  let message = `📍 <b>${label}</b>\n\n`;
  message += `<code>${address}</code>\n\n`;
  message += `💰 <b>Balance:</b> ${freshBalance} XNT${creationDate}\n`;
  
  // Show rugger alert status if wallet is flagged
  if (wallet.isKnownRugger) {
    const alertStatus = wallet.alertsEnabled 
      ? '🔔 <b>Alerts: ENABLED</b>' 
      : '🔕 <i>Alerts: Disabled</i>';
    message += `\n🚨 <b>Status: KNOWN RUGGER</b>\n${alertStatus}\n`;
  }
  
  // Show pending alerts if any
  if (wallet.pendingAlerts && wallet.pendingAlerts.length > 0) {
    message += `\n🔴 <b>${wallet.pendingAlerts.length} Pending Alert${wallet.pendingAlerts.length > 1 ? 's' : ''}</b>\n`;
  }
  
  message += `\n<i>Choose an action:</i>`;

  await ctx.editMessageText(message, { 
    parse_mode: 'HTML', 
    reply_markup: walletActionKeyboard(wallet)
  });
}

// Send wallet detail view
async function sendWalletDetail(ctx: Context, address: string): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);
  const wallet = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());

  if (!wallet) {
    await ctx.editMessageText('❌ Wallet not found.', { reply_markup: backToMenuKeyboard() });
    return;
  }

  // Show loading message first
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
  await ctx.editMessageText(
    `📍 <b>Loading Wallet Details...</b>\n\n📍 ${shortAddr}\n\n⏳ Fetching balance, stats & security analysis...`,
    { parse_mode: 'HTML' }
  );

  const tokens = wallet.trackedTokens || [];
  let balance = wallet.lastBalance || 'Unknown';
  
  try {
    balance = await getBalance(wallet.address);
  } catch (e) {
    // Use cached balance
  }

  // Get blockchain activity stats (FULL version - scans all transactions up to 10,000)
  // This gives accurate wallet creation date
  let totalTxCount = '0';
  let last24h = '0';
  let last7d = '0';
  let firstActiveDate = '';
  
  try {
    const stats = await getWalletActivityStats(wallet.address);
    
    totalTxCount = stats.totalTransactions >= 50000 
      ? '50,000+' 
      : stats.totalTransactions.toLocaleString();
    last24h = stats.last24hTransactions.toLocaleString();
    last7d = stats.last7dTransactions.toLocaleString();
    
    if (stats.firstTxDate) {
      const dateStr = stats.firstTxDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        timeZone: 'UTC'
      });
      const timeStr = stats.firstTxDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'UTC'
      });
      firstActiveDate = `${dateStr} at ${timeStr} UTC`;
    }
  } catch (e) {
    // Skip blockchain stats on error
  }

  let message = `📍 <b>Wallet Details</b>\n\n`;
  message += wallet.label ? `🏷️ <b>${wallet.label}</b>\n` : '';
  message += `<code>${wallet.address}</code>\n\n`;
  
  // Balance section
  message += `💰 <b>Balance:</b> ${balance} XNT\n\n`;
  
  // Transaction stats section (prominent)
  message += `📊 <b>Recent Activity</b>\n`;
  message += `├ Recent Txs: <b>${totalTxCount}</b>\n`;
  message += `├ Last 24h: <b>${last24h}</b>\n`;
  message += `└ Last 7d: <b>${last7d}</b>\n\n`;
  
  // Other info
  message += `🪙 <b>Tracked Tokens:</b> ${tokens.length}\n`;
  if (firstActiveDate) {
    message += `🎂 <b>Wallet Created:</b> ${firstActiveDate}\n`;
  } else {
    message += `🎂 <b>Wallet Created:</b> Unknown\n`;
  }
  
  // Skip security check on wallet info - user can tap Security button for that
  message += `\n🛡️ <i>Tap Security button for rugger/deployer scan</i>\n`;
  
  if (tokens.length > 0) {
    message += '\n<b>Tokens:</b>\n';
    for (const token of tokens) {
      const tokenBal = token.lastBalance ? formatTokenBalance(token.lastBalance, token.symbol) : 'Loading...';
      const programIcon = token.program === 'token-2022' ? '🆕' : '🔷';
      message += `  ${programIcon} ${token.symbol}: ${tokenBal}\n`;
    }
  }

  message += `\n🔗 <a href="${getAddressExplorerUrl(wallet.address)}">View on Explorer</a>`;

  await ctx.editMessageText(message, { 
    parse_mode: 'HTML', 
    reply_markup: walletDetailKeyboard(wallet)
  });
}

// Perform deep security check on a wallet - focused on RUGGERS and DEPLOYERS
async function performSecurityCheck(ctx: Context, walletAddress: string): Promise<void> {
  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  
  // ===== INSTANT BLOCKLIST CHECK FIRST =====
  // Check blocklist IMMEDIATELY before blockchain scan (< 1ms)
  const quickCheck = performEnhancedSecurityScan(walletAddress, null);
  
  // If CRITICAL threat found in blocklist, show warning immediately
  if (quickCheck.recommendedAction === 'BLOCK') {
    let instantMessage = `🛡️ <b>SECURITY SCAN</b>\n\n`;
    instantMessage += `📍 <code>${shortAddr}</code>\n\n`;
    instantMessage += `🚨 <b>⚠️ INSTANT BLOCKLIST ALERT ⚠️</b>\n\n`;
    
    if (quickCheck.isKnownRugger && quickCheck.serialData) {
      instantMessage += `<b>🚨 KNOWN RUG PULLER DETECTED!</b>\n`;
      instantMessage += `This wallet is in our rug puller database.\n\n`;
      instantMessage += `📊 <b>Criminal Record:</b>\n`;
      instantMessage += `   • Total Rug Pulls: ${quickCheck.serialData.totalRugPulls}\n`;
      instantMessage += `   • Risk Score: ${quickCheck.serialData.riskScore}/100\n\n`;
      
      if (quickCheck.serialData.rugPullHistory.length > 0) {
        instantMessage += `📋 <b>Previous Scams:</b>\n`;
        quickCheck.serialData.rugPullHistory.forEach((rug, i) => {
          instantMessage += `   ${i + 1}. "${escapeHtml(rug.tokenSymbol)}" - ${rug.rugDate}\n`;
          instantMessage += `      └ ${rug.lpRemoved} LP removed, $${rug.estimatedLoss.toLocaleString()} stolen\n`;
        });
        instantMessage += `\n`;
      }
      
      instantMessage += `⛔ <b>DO NOT INTERACT WITH THIS WALLET!</b>\n\n`;
    } else if (quickCheck.inScamNetwork && quickCheck.networkRisk) {
      instantMessage += `<b>🕸️ SCAM NETWORK DETECTED!</b>\n`;
      instantMessage += `This wallet is part of an organized scam ring.\n\n`;
      instantMessage += `🔗 <b>Network Info:</b>\n`;
      instantMessage += `   • Network: ${quickCheck.networkRisk.networkId}\n`;
      instantMessage += `   • Total Rug Pulls: ${quickCheck.networkRisk.networkRugPulls}\n`;
      instantMessage += `   • Total Stolen: $${quickCheck.networkRisk.totalStolen.toLocaleString()}\n\n`;
      instantMessage += `🚨 <b>ORGANIZED CRIME OPERATION!</b>\n\n`;
    }
    
    instantMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    instantMessage += `🚨 <b>⛔ TRANSACTION BLOCKED ⛔</b>\n`;
    instantMessage += `This wallet is flagged in our security database.\n`;
    instantMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    instantMessage += `⏳ <i>Loading detailed blockchain analysis...</i>`;
    
    await ctx.editMessageText(instantMessage, { 
      parse_mode: 'HTML',
      reply_markup: securityKeyboard(walletAddress)
    });
    
    // Log the instant detection
    logger.warn(`🚨 INSTANT BLOCKLIST HIT: ${quickCheck.isKnownRugger ? 'Known rug puller' : 'Scam network'} - ${walletAddress.slice(0, 8)}...`);
  } else {
    // No critical blocklist hit, show normal loading message
    await ctx.editMessageText(
      `🛡️ <b>Rugger &amp; Deployer Scanner</b>\n\n` +
      `📍 <code>${shortAddr}</code>\n\n` +
      `⏳ <b>Scanning...</b>\n\n` +
      `Checking for deployers, ruggers, and threats.\n` +
      `This typically takes 3-8 seconds.`,
      { parse_mode: 'HTML' }
    );
  }

  try {
    // Note: config.disableAutoSecurityScan only affects automatic background scans
    // Manual scans triggered by user button clicks are always allowed
    
    const securityInfo = await checkWalletSecurity(walletAddress);
    
    // DEBUG: Check if fundingChain exists in securityInfo
    logger.error(`[FUNDING DEBUG] fundingChain in securityInfo: ${!!securityInfo.fundingChain}, length: ${securityInfo.fundingChain?.length || 0}, data:`, securityInfo.fundingChain);
    
    // ===== ENHANCED BLOCKLIST CHECK (with funding source now) =====
    // Re-check with funding source from blockchain scan
    const fundingSource = securityInfo.fundingChain?.[0] || securityInfo.fundingSource || null;
    const enhancedCheck = performEnhancedSecurityScan(walletAddress, fundingSource);
    
    // Log enhanced detection results
    if (enhancedCheck.isKnownRugger) {
      logger.warn(`🚨 BLOCKLIST HIT: Known rug puller detected - ${walletAddress.slice(0, 8)}... with ${enhancedCheck.serialData?.totalRugPulls} previous rug pull(s)`);
    }
    if (enhancedCheck.suspiciousFunding) {
      logger.warn(`⚠️ BLOCKLIST HIT: Suspicious funder detected - funded by wallet with ${enhancedCheck.fundingRisk?.confirmedRugPulls} rug pulls`);
    }
    if (enhancedCheck.inScamNetwork) {
      logger.warn(`🕸️ BLOCKLIST HIT: Scam network detected - part of network with ${enhancedCheck.networkRisk?.networkRugPulls} rug pulls`);
    }
    // ===== END ENHANCED CHECK =====
    
    // Calculate deployer/rugger specific stats
    const isDeployer = securityInfo.isDeployer;
    const tokenCount = securityInfo.deployedTokens.length;
    const ruggedTokens = securityInfo.deployedTokensAnalysis.filter(t => t.isRugpull);
    const rugCount = ruggedTokens.length;
    const connectedRuggers = securityInfo.connectedWallets.filter(w => w.isLpRugger || w.isHoneypotCreator || w.rugCount > 0);
    const connectedDeployers = securityInfo.connectedWallets.filter(w => w.isDeployer && w.deployedTokenCount >= 3);
    const isLpRugger = securityInfo.suspiciousPatterns.some(p => p.type === 'lp_rugger');
    
    // Determine threat level based on deployer/rugger activity + ENHANCED BLOCKLIST
    let threatLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER' | 'EXTREME';
    let threatEmoji: string;
    let threatColor: string;
    let threatBar: string;
    
    // ENHANCED: Blocklist checks override all other risk assessments
    if (enhancedCheck.recommendedAction === 'BLOCK') {
      threatLevel = 'EXTREME';
      threatEmoji = '🚨';
      if (enhancedCheck.isKnownRugger) {
        threatColor = `BLOCKLIST: KNOWN RUGGER (${enhancedCheck.serialData?.totalRugPulls}x)`;
      } else if (enhancedCheck.inScamNetwork) {
        threatColor = 'BLOCKLIST: SCAM NETWORK';
      } else {
        threatColor = 'BLOCKLIST: SUSPICIOUS FUNDER';
      }
      threatBar = '🔴🔴🔴🔴🔴';
    } else if (enhancedCheck.recommendedAction === 'WARN') {
      threatLevel = 'DANGER';
      threatEmoji = '🔴';
      threatColor = 'BLOCKLIST: HIGH RISK';
      threatBar = '🟠🟠🟠🟠⚪';
    } else if (isLpRugger || rugCount >= 2 || (isDeployer && tokenCount >= 10)) {
      threatLevel = 'EXTREME';
      threatEmoji = '🚨';
      threatColor = isLpRugger ? 'LP RUGGER' : 'SERIAL RUGGER';
      threatBar = '🔴🔴🔴🔴🔴';
    } else if (rugCount >= 1 || connectedRuggers.length >= 3) {
      threatLevel = 'DANGER';
      threatEmoji = '🔴';
      threatColor = 'KNOWN RUGGER';
      threatBar = '🟠🟠🟠🟠⚪';
    } else if (isDeployer && tokenCount >= 5) {
      threatLevel = 'WARNING';
      threatEmoji = '🟠';
      threatColor = 'SERIAL DEPLOYER';
      threatBar = '🟡🟡🟡⚪⚪';
    } else if (isDeployer || connectedRuggers.length >= 1 || connectedDeployers.length >= 2) {
      threatLevel = 'CAUTION';
      threatEmoji = '🟡';
      threatColor = 'SUSPICIOUS';
      threatBar = '🟡🟡⚪⚪⚪';
    } else {
      threatLevel = 'SAFE';
      threatEmoji = '🟢';
      threatColor = 'LOW RISK';
      threatBar = '🟢🟢⚪⚪⚪';
    }

    // MOBILE-FRIENDLY HEADER
    let message = `🛡️ <b>SECURITY SCAN</b>\n\n`;
    
    // Wallet address - compact
    message += `📍 <b>Wallet</b>\n`;
    message += `<code>${walletAddress}</code>\n\n`;
    
    // THREAT LEVEL - Compact single line with bold
    message += `${threatEmoji} <b>THREAT: ${threatLevel} - ${threatColor}</b>\n`;
    message += `${threatBar}\n\n`;
    message += `─────────────────────────\n\n`;
    
    // ===== ENHANCED BLOCKLIST WARNINGS =====
    // Show blocklist warnings at the top (most critical)
    if (enhancedCheck.isKnownRugger && enhancedCheck.serialData) {
      message += `🚨 <b>⚠️ BLOCKLIST ALERT ⚠️</b>\n\n`;
      message += `<b>KNOWN RUG PULLER DETECTED!</b>\n`;
      message += `This wallet is in our rug puller database.\n\n`;
      message += `📊 <b>Criminal Record:</b>\n`;
      message += `   • Total Rug Pulls: ${enhancedCheck.serialData.totalRugPulls}\n`;
      message += `   • Risk Score: ${enhancedCheck.serialData.riskScore}/100\n\n`;
      
      if (enhancedCheck.serialData.rugPullHistory.length > 0) {
        message += `📋 <b>Previous Scams:</b>\n`;
        enhancedCheck.serialData.rugPullHistory.forEach((rug, i) => {
          message += `   ${i + 1}. "${escapeHtml(rug.tokenSymbol)}" - ${rug.rugDate}\n`;
          message += `      └ ${rug.lpRemoved} LP removed\n`;
          message += `      └ $${rug.estimatedLoss.toLocaleString()} stolen\n`;
        });
        message += `\n`;
      }
      
      message += `⛔ <b>DO NOT INTERACT WITH THIS WALLET!</b>\n`;
      message += `─────────────────────────\n\n`;
    }
    
    if (enhancedCheck.suspiciousFunding && enhancedCheck.fundingRisk) {
      message += `⚠️ <b>SUSPICIOUS FUNDING DETECTED!</b>\n\n`;
      message += `This wallet was funded by a suspicious source.\n\n`;
      message += `💰 <b>Funder Analysis:</b>\n`;
      message += `   • Wallets Financed: ${enhancedCheck.fundingRisk.walletsFinanced}\n`;
      message += `   • Confirmed Rug Pulls: ${enhancedCheck.fundingRisk.confirmedRugPulls}\n`;
      message += `   • Risk Score: ${enhancedCheck.fundingRisk.riskScore}/100\n\n`;
      message += `⚠️ <b>HIGH PROBABILITY OF SCAM!</b>\n`;
      message += `─────────────────────────\n\n`;
    }
    
    if (enhancedCheck.inScamNetwork && enhancedCheck.networkRisk) {
      message += `🕸️ <b>SCAM NETWORK DETECTED!</b>\n\n`;
      message += `This wallet is part of an organized scam ring.\n\n`;
      message += `🔗 <b>Network Info:</b>\n`;
      message += `   • Network ID: ${enhancedCheck.networkRisk.networkId}\n`;
      message += `   • Role: ${enhancedCheck.networkRisk.role.toUpperCase()}\n`;
      message += `   • Network Rug Pulls: ${enhancedCheck.networkRisk.networkRugPulls}\n`;
      message += `   • Total Stolen: $${enhancedCheck.networkRisk.totalStolen.toLocaleString()}\n\n`;
      message += `🚨 <b>ORGANIZED CRIME OPERATION!</b>\n`;
      message += `─────────────────────────\n\n`;
    }
    // ===== END BLOCKLIST WARNINGS =====
    
    // LP RUGGER STATUS - Most critical
    const lpRugPattern = securityInfo.suspiciousPatterns.find(p => p.type === 'lp_rugger');
    if (lpRugPattern) {
      message += `🚨 <b>LP RUG DETECTED</b>\n`;
      message += `This wallet removed liquidity!\n\n`;
      message += `─────────────────────────\n\n`;
      
      // Show timestamp if available
      if (lpRugPattern.timestamp) {
        const dateStr = lpRugPattern.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
        const timeStr = lpRugPattern.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
        message += `<b>Rug Date: ${dateStr} at ${timeStr} UTC</b>\n`;
      }
      
      message += `\n`;
      
      // Show evidence
      for (const ev of lpRugPattern.evidence) {
        message += `   └ ${ev}\n`;
      }
      
      message += `\n`;
    }
    
    // FUNDING CHAIN - Professional display
    if (securityInfo.fundingChain && securityInfo.fundingChain.length > 0) {
      message += `💰 <b>FUNDER WALLET${securityInfo.fundingChain.length > 1 ? 'S' : ''}</b>\n\n`;
      
      securityInfo.fundingChain.forEach((addr, idx) => {
        const riskIcon = securityInfo.fundingSourceRisk === 'critical' ? '🚨' : 
                        securityInfo.fundingSourceRisk === 'high' ? '⚠️' : '✅';
        message += `${riskIcon} <b>#${idx + 1}</b>\n`;
        message += `<code>${addr}</code>\n\n`;
      });
      
      if (securityInfo.fundingSourceRisk === 'critical') {
        message += `🚨 High-risk source\n`;
      } else if (securityInfo.fundingSourceRisk === 'high') {
        message += `⚠️ Suspicious pattern\n`;
      } else {
        message += `✅ Verified source\n`;
      }
      message += `\n─────────────────────────\n\n`;
    } else if (securityInfo.fundingSource) {
      message += `💰 <b>FUNDER WALLET</b>\n\n`;
      
      const riskIcon = securityInfo.fundingSourceRisk === 'critical' ? '🚨' : 
                      securityInfo.fundingSourceRisk === 'high' ? '⚠️' : '✅';
      message += `${riskIcon} <b>Wallet</b>\n`;
      message += `<code>${securityInfo.fundingSource}</code>\n\n`;
      
      if (securityInfo.fundingSourceRisk === 'critical') {
        message += `🚨 High-risk source\n`;
      } else if (securityInfo.fundingSourceRisk === 'high') {
        message += `⚠️ Suspicious pattern\n`;
      } else {
        message += `✅ Verified source\n`;
      }
      message += `\n─────────────────────────\n\n`;
    } else {
      // No funding source found - new created wallet
      message += `💰 <b>FUNDER WALLET</b>\n\n`;
      message += `🆕 <i>New created wallet</i>\n`;
      message += `<i>No funding history detected</i>\n`;
      message += `\n─────────────────────────\n\n`;
    }
    
    // DEPLOYER STATUS - Primary focus
    message += `<b>📦 DEPLOYER STATUS</b>\n`;
    if (isDeployer) {
      if (tokenCount >= 10) {
        message += `🚨 <b>SERIAL DEPLOYER - ${tokenCount} TOKENS</b>\n`;
        message += `   ⚠️ High probability of scam operation\n`;
      } else if (tokenCount >= 5) {
        message += `🟠 <b>MULTIPLE DEPLOYER - ${tokenCount} TOKENS</b>\n`;
        message += `   ⚠️ Elevated risk - verify each token\n`;
      } else if (tokenCount >= 2) {
        message += `🟡 <b>DEPLOYER - ${tokenCount} TOKENS</b>\n`;
      } else {
        message += `📝 Deployed 1 token\n`;
      }
      
      // ALL DEPLOYED TOKENS - Show both rugged and at-risk
      if (tokenCount > 0) {
        message += `\n<b>📋 DEPLOYED TOKENS (${tokenCount})</b>\n`;
        
        // Show rugged tokens first
        if (rugCount > 0) {
          message += `\n<b>🚨 RUGGED (${rugCount}):</b>\n`;
          for (const rug of ruggedTokens.slice(0, 3)) {
            const displayName = getTokenDisplayName(rug);
            
            message += `\n   💀 <b>${escapeHtml(displayName)}</b> - <i>RUGGED</i>\n`;
            message += `   <code>${rug.mint}</code>\n`;
            
            // Show date and time if available
            if (rug.rugpullTimestamp) {
              const date = new Date(rug.rugpullTimestamp);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
              const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
              message += `      └ Rugged: ${dateStr} at ${timeStr} UTC\n`;
            } else if (rug.createdAt) {
              // Use creation date as fallback
              const date = new Date(rug.createdAt);
              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
              const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
              message += `      └ Created: ${dateStr} at ${timeStr} UTC\n`;
            }
            
            // Show rug indicators
            for (const indicator of rug.rugpullIndicators.slice(0, 2)) {
              message += `      └ ${indicator}\n`;
            }
          }
          if (rugCount > 3) {
            message += `\n   <i>...and ${rugCount - 3} more rugged tokens</i>\n`;
          }
        }
        
        // Show non-rugged tokens (at risk)
        const nonRuggedTokens = securityInfo.deployedTokensAnalysis.filter(t => !t.isRugpull);
        if (nonRuggedTokens.length > 0) {
          // If this wallet is an LP rugger, show "LP Rugged" instead
          const subtitle = isLpRugger ? '<i>LP Rugged</i>' : '<i>Not rugged yet, but deployer controls:</i>';
          message += `\n<b>⚠️ AT RISK (${nonRuggedTokens.length}):</b>\n`;
          message += `${subtitle}\n`;
          
          for (const token of nonRuggedTokens.slice(0, 3)) {
            const displayName = getTokenDisplayName(token);
            
            // Check if LP has been rugged (if the wallet is an LP rugger, all tokens are affected)
            const rugComment = isLpRugger ? ' - <i>LP Rugged</i>' : '';
            
            // Determine risk factors
            const risks: string[] = [];
            if (!token.mintAuthorityRevoked) {
              risks.push('Can mint more');
            }
            if (!token.freezeAuthorityRevoked) {
              risks.push('Can freeze');
            }
            if (token.topHolderPercentage && token.topHolderPercentage > 30) {
              risks.push(`${token.topHolderPercentage.toFixed(0)}% held`);
            }
            
            const riskLevel = risks.length >= 2 ? '🔴' : risks.length === 1 ? '🟠' : '🟡';
            const riskText = risks.length > 0 ? risks.join(' • ') : 'Low risk indicators';
            
            message += `\n   ${riskLevel} <b>${escapeHtml(displayName)}</b>${rugComment}\n`;
            message += `   <code>${token.mint}</code>\n`;
            message += `      �"" ${riskText}\n`;
          }
          if (nonRuggedTokens.length > 3) {
            message += `\n   <i>...and ${nonRuggedTokens.length - 3} more tokens at risk</i>\n`;
          }
        }
      }
    } else {
      message += `✅ <b>NOT A DEPLOYER</b>\n`;
      message += `   This wallet has not created any tokens\n`;
    }
    message += '\n';
    
    // CONNECTED RUGGERS/DEPLOYERS - Key protection info
    if (connectedRuggers.length > 0 || connectedDeployers.length > 0) {
      message += `<b>🔗 DANGEROUS CONNECTIONS</b>\n\n`;
      
      // Connected Ruggers
      if (connectedRuggers.length > 0) {
        message += `🚨 <b>CONNECTED TO ${connectedRuggers.length} RUGGER${connectedRuggers.length > 1 ? 'S' : ''}</b>\n`;
        
        for (const rugger of connectedRuggers.slice(0, 4)) {
          const addrShort = `${rugger.address.slice(0, 6)}...${rugger.address.slice(-4)}`;
          
          let badge = '💀 RUGGER';
          if (rugger.isLpRugger) badge = '💧 LP PULLER';
          if (rugger.isHoneypotCreator) badge = '🍯 HONEYPOT MAKER';
          if (rugger.rugCount >= 3) badge = '🚨 SERIAL RUGGER';
          
          message += `\n   ${badge}\n`;
          message += `   <code>${addrShort}</code>\n`;
          
          if (rugger.rugInvolvements.length > 0) {
            const rug = rugger.rugInvolvements[0];
            const mintShort = `${rug.tokenMint.slice(0, 6)}...${rug.tokenMint.slice(-4)}`;
            let rugInfo = rug.evidence[0] || `Rugged: ${mintShort}`;
            
            // Add date and time if available
            if (rug.timestamp) {
              const rugDate = new Date(rug.timestamp);
              const dateStr = rugDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
              const timeStr = rugDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' });
              rugInfo += ` (${dateStr} ${timeStr} UTC)`;
            }
            
            message += `   └ ${rugInfo}\n`;
          }
          
          if (rugger.deployedTokenCount > 0) {
            message += `   └ Deployed ${rugger.deployedTokenCount} token${rugger.deployedTokenCount > 1 ? 's' : ''}\n`;
          }
        }
        
        if (connectedRuggers.length > 4) {
          message += `\n   <i>⚠️ ${connectedRuggers.length - 4} more ruggers connected</i>\n`;
        }
        message += '\n';
      }
      
      // Connected Serial Deployers (not ruggers)
      const pureDeployers = connectedDeployers.filter(d => !connectedRuggers.includes(d));
      if (pureDeployers.length > 0) {
        message += `🟠 <b>SERIAL DEPLOYERS (${pureDeployers.length})</b>\n`;
        
        for (const deployer of pureDeployers.slice(0, 3)) {
          const addrShort = `${deployer.address.slice(0, 6)}...${deployer.address.slice(-4)}`;
          message += `   📦 <code>${addrShort}</code>\n`;
          message += `   └ ${deployer.deployedTokenCount} tokens deployed\n`;
        }
        
        if (pureDeployers.length > 3) {
          message += `   <i>...and ${pureDeployers.length - 3} more deployers</i>\n`;
        }
        message += '\n';
      }
    } else {
      message += `<b>🔗 DANGEROUS CONNECTIONS</b>\n`;
      message += `✅ No connected ruggers or serial deployers found\n\n`;
    }
    
    // QUICK STATS
    message += `<b>📊 QUICK STATS</b>\n`;
    if (securityInfo.activityAnalysis) {
      message += `├ Account Age: ${securityInfo.activityAnalysis.accountAge} days\n`;
      message += `├ Transactions: ${securityInfo.activityAnalysis.totalTransactions}+\n`;
    }
    message += `└ Risk Score: ${securityInfo.riskScore}/100\n`;
    
    // VERDICT - Enhanced with blocklist recommendations
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (enhancedCheck.recommendedAction === 'BLOCK') {
      message += `🚨 <b>⛔ TRANSACTION BLOCKED ⛔</b>\n`;
      if (enhancedCheck.isKnownRugger) {
        message += `This wallet is a CONFIRMED RUG PULLER.\n`;
        message += `Do NOT buy, trade, or interact with any tokens from this address.\n`;
      } else if (enhancedCheck.inScamNetwork) {
        message += `This wallet is part of an ORGANIZED SCAM RING.\n`;
        message += `Do NOT interact with this address or any connected wallets.\n`;
      } else {
        message += `This wallet has SUSPICIOUS FUNDING from known scammers.\n`;
        message += `High probability of rug pull - AVOID!\n`;
      }
    } else if (threatLevel === 'EXTREME' || threatLevel === 'DANGER') {
      message += `🚨 <b>AVOID THIS WALLET</b>\n`;
      message += `Do not interact with tokens from this address.\n`;
    } else if (threatLevel === 'WARNING') {
      message += `⚠️ <b>HIGH CAUTION ADVISED</b>\n`;
      message += `Verify all tokens before interacting.\n`;
    } else if (threatLevel === 'CAUTION') {
      message += `🟡 <b>PROCEED WITH CAUTION</b>\n`;
      message += `Some risk indicators detected.\n`;
    } else {
      message += `✅ <b>APPEARS SAFE</b>\n`;
      if (enhancedCheck.recommendedAction === 'ALLOW') {
        message += `No blocklist flags. No major rugger/deployer threats found.\n`;
        message += `<i>Always DYOR before investing.</i>\n`;
      } else {
        message += `No major rugger/deployer threats found.\n`;
      }
    }
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await ctx.editMessageText(message, { 
      parse_mode: 'HTML',
      reply_markup: securityKeyboard(walletAddress) 
    });
  } catch (error) {
    logger.error('Error performing security check:', error);
    await ctx.editMessageText(
      `❌ <b>Scan Failed</b>\n\n` +
      `Unable to complete the scan. Please try again.`,
      { parse_mode: 'HTML', reply_markup: securityKeyboard(walletAddress) }
    );
  }
}

// Show transaction details when user clicks "View Details"
async function showTransactionDetails(ctx: Context, walletAddress: string): Promise<void> {
  const transactions = getPendingTransactions(walletAddress);
  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  
  if (transactions.length === 0) {
    await ctx.editMessageText(
      `📋 <b>Transaction Details</b>\n\n📍 Wallet: ${shortAddr}\n\nNo recent transactions to show.`,
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  let message = `📋 <b>Transaction Details</b>\n\n`;
  message += `📍 Wallet: ${shortAddr}\n`;
  message += `📊 Showing ${Math.min(transactions.length, 10)} of ${transactions.length} transactions:\n\n`;
  
  // Show up to 10 most recent transactions
  const recentTxs = transactions.slice(0, 10);
  
  for (const tx of recentTxs) {
    const isIncoming = tx.to?.toLowerCase() === walletAddress.toLowerCase();
    const emoji = isIncoming ? '📥' : '📤';
    const value = parseFloat(tx.value);
    const valueStr = value < 0.0001 ? '< 0.0001' : value.toFixed(4);
    
    const time = tx.timestamp 
      ? new Date(tx.timestamp * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '';
    
    message += `${emoji} <b>${valueStr} XNT</b>`;
    if (time) message += ` (${time})`;
    message += `\n`;
    message += `   <a href="${getTxExplorerUrl(tx.hash)}">View tx</a>\n`;
  }
  
  if (transactions.length > 10) {
    message += `\n<i>...and ${transactions.length - 10} more transactions</i>`;
  }
  
  // Create keyboard to clear or go back
  const keyboard = new InlineKeyboard()
    .text('✅ Clear All', `dismiss_tx_${walletAddress}`)
    .text('🔄 Refresh', `view_tx_details_${walletAddress}`);
  
  await ctx.editMessageText(message, { 
    parse_mode: 'HTML',
    reply_markup: keyboard,
    // Disable link previews
  });
}

// Discover all tokens in a wallet
async function discoverWalletTokens(ctx: Context, walletAddress: string): Promise<void> {
  if (!ctx.from) return;

  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  
  // Show loading message with animation-like steps
  await ctx.editMessageText(
    `💼 <b>Portfolio Scanner</b>\n\n` +
    `📍 <code>${shortAddr}</code>\n\n` +
    `<b>Scanning blockchain...</b>\n\n` +
    `⏳ Finding token accounts...\n` +
    `⏳ Fetching token metadata...\n` +
    `⏳ Loading market prices...`,
    { parse_mode: 'HTML' }
  );

  try {
    logger.info('Discovering tokens for: ' + walletAddress.slice(0, 8) + '...');
    const tokens = await getAllTokenAccounts(walletAddress);
    logger.info('Found ' + tokens.length + ' tokens');
    
    if (tokens.length === 0) {
      await ctx.editMessageText(
        `💼 <b>Token Portfolio</b>\n\n` +
        `📍 <code>${shortAddr}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `     📭 <b>No tokens found</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `<i>This wallet doesn't hold any SPL or Token-2022 tokens yet.</i>`,
        { parse_mode: 'HTML', reply_markup: portfolioKeyboard(walletAddress) }
      );
      return;
    }

    // Fetch all token info and prices
    interface TokenDisplay {
      mint: string;
      name: string;
      ticker: string;
      balance: number;
      priceUsd: number | null;
      valueUsd: number;
      program: string;
    }
    
    const tokenDisplays: TokenDisplay[] = [];
    let totalPortfolioValue = 0;
    let tokensWithPrice = 0;
    
    for (const token of tokens.slice(0, 25)) {
      const balance = parseFloat(token.balance);
      let ticker = token.mint.slice(0, 4).toUpperCase();
      let name = '';
      let priceUsd: number | null = null;
      let valueUsd = 0;
      
      // Fetch token info
      try {
        const tokenInfo = await getTokenInfo(token.mint);
        if (tokenInfo?.symbol) {
          // Clean and escape token symbol - remove any non-printable chars
          ticker = escapeHtml(tokenInfo.symbol.replace(/[^\x20-\x7E]/g, '').trim()) || token.mint.slice(0, 4).toUpperCase();
          if (tokenInfo.name && tokenInfo.name !== tokenInfo.symbol) {
            // Clean and escape token name - remove any non-printable chars
            name = escapeHtml(tokenInfo.name.replace(/[^\x20-\x7E]/g, '').trim());
          }
        }
      } catch (e) {}
      
      // Fetch price
      try {
        const priceData = await getTokenPrice(token.mint);
        logger.info(`💰 Price for ${ticker}: ${priceData}`);
        if (priceData) {
          priceUsd = priceData;
          valueUsd = balance * priceUsd;
          totalPortfolioValue += valueUsd;
          tokensWithPrice++;
        }
      } catch (e) {
        logger.error(`❌ Price fetch error for ${ticker}:`, e);
      }
      
      tokenDisplays.push({
        mint: token.mint,
        name,
        ticker,
        balance,
        priceUsd,
        valueUsd,
        program: token.program
      });
    }
    
    // Sort by value (highest first), then by balance
    tokenDisplays.sort((a, b) => {
      if (b.valueUsd !== a.valueUsd) return b.valueUsd - a.valueUsd;
      return b.balance - a.balance;
    });
    
    // Build professional wallet display
    let message = `💼 <b>Token Portfolio</b>\n\n`;
    message += `📍 <code>${walletAddress}</code>\n\n`;
    
    // Portfolio summary header
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if (totalPortfolioValue > 0) {
      const totalValueStr = formatPortfolioValueFromModule(totalPortfolioValue);
      message += `💰 <b>Total Value:</b> ${totalValueStr}\n`;
    }
    message += `🪙 <b>Tokens:</b> ${tokens.length}\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Display tokens
    const displayLimit = 10;
    let displayedCount = 0;
    
    for (const token of tokenDisplays) {
      if (displayedCount >= displayLimit) break;
      
      const programIcon = token.program === 'token-2022' ? '🆕' : '🔷';
      const balanceStr = formatTokenBalanceCompact(token.balance);
      
      // Line 1: Icon + Ticker only
      message += `${programIcon} <b>${token.ticker}</b>\n`;
      
      // Line 2: Balance @ Price = Value (or just balance if no price)
      message += `     ${balanceStr}`;
      if (token.priceUsd !== null && token.priceUsd !== undefined && token.priceUsd > 0) {
        message += ` @ ${formatPrice(token.priceUsd)} = <b>${formatValueUsd(token.priceUsd, token.valueUsd)}</b>`;
      }
      message += `\n`;
      
      displayedCount++;
      
      // Add subtle separator between tokens (except last)
      if (displayedCount < Math.min(tokenDisplays.length, displayLimit)) {
        message += `\n`;
      }
    }
    
    // Show remaining count
    if (tokens.length > displayLimit) {
      message += `\n<i>···  ${tokens.length - displayLimit} more token${tokens.length - displayLimit !== 1 ? 's' : ''} not shown  ···</i>\n`;
    }
    
    await ctx.editMessageText(message, { 
      parse_mode: 'HTML', 
      reply_markup: portfolioKeyboard(walletAddress) 
    });
  } catch (error) {
    logger.error('Error discovering tokens:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await ctx.editMessageText(
      `❌ <b>Error Scanning Wallet</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<i>${escapeHtml(errorMsg)}</i>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Please try again later.`,
      { parse_mode: 'HTML', reply_markup: portfolioKeyboard(walletAddress) }
    );
  }
}

// formatPortfolioValue is imported from portfolio module (line 29) - removed duplicate

// Format token balance in compact form (HTML-safe)
function formatTokenBalanceCompact(amount: number): string {
  if (amount === 0) return '0';
  if (amount < 0.0001) return '&lt; 0.0001';
  if (amount < 0.01) return amount.toFixed(6);
  if (amount < 1) return amount.toFixed(4);
  if (amount < 100) return amount.toFixed(3);
  if (amount < 10000) return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (amount < 1000000) return `${(amount / 1000).toFixed(2)}K`;
  if (amount < 1000000000) return `${(amount / 1000000).toFixed(2)}M`;
  return `${(amount / 1000000000).toFixed(2)}B`;
}

// Send token list for a wallet
async function sendTokenList(ctx: Context, walletAddress: string): Promise<void> {
  if (!ctx.from) return;

  const tokens = getWalletTokens(ctx.from.id, walletAddress);
  const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;

  if (tokens.length === 0) {
    await ctx.editMessageText(
      `🪙 <b>Tracked Tokens</b>\n\n` +
      `📍 Wallet: ${shortAddr}\n\n` +
      `No tokens tracked yet.\n\nTap "Add Token" to start tracking SPL tokens!`,
      { parse_mode: 'HTML', reply_markup: tokenListKeyboard(walletAddress, tokens) }
    );
    return;
  }

  let message = `🪙 <b>Tracked Tokens</b> (${tokens.length}/10)\n\n`;
  message += `📍 Wallet: ${shortAddr}\n\n`;

  for (const token of tokens) {
    const balance = token.lastBalance ? formatTokenBalance(token.lastBalance, token.symbol) : 'Loading...';
    const programIcon = token.program === 'token-2022' ? '🆕' : '🔷';
    message += `${programIcon} <b>${token.symbol}</b>: ${balance}\n`;
  }

  message += '\n<i>Tap a token to remove it from tracking</i>';

  await ctx.editMessageText(message, { 
    parse_mode: 'HTML', 
    reply_markup: tokenListKeyboard(walletAddress, tokens) 
  });
}
