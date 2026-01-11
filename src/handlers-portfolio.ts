// Portfolio and export handlers (separated for better organization)
import { Context, InputFile, InlineKeyboard } from 'grammy';
import { getUserWallets } from './storage';
import { getUserPortfolioSummary, formatPortfolioValue } from './portfolio';
import { exportWalletTransactionsCsv, exportAllWalletsCsv, generateExportFilename } from './export';
import { paginateArray, createPaginationKeyboard } from './pagination';
import { mainMenuKeyboard, backToMenuKeyboard } from './keyboards';
import { WatchedWallet } from './types';
import { createLogger } from './logger';

const logger = createLogger('Handlers-portfolio');

const WALLETS_PER_PAGE = 5;

/**
 * Send portfolio view with USD values
 */
export async function sendPortfolioView(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);

  if (wallets.length === 0) {
    await ctx.reply(
      '📊 <b>Portfolio</b>\n\n' +
      '❌ No wallets added yet.\n\n' +
      'Add wallets with /watch to see your portfolio value.',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  const loadingMsg = await ctx.reply('💼 <b>Loading Portfolio...</b>\n\n⏳ Calculating USD values...', {
    parse_mode: 'HTML',
  });

  try {
    const portfolio = await getUserPortfolioSummary(wallets);

    let message = '💼 <b>Portfolio Overview</b>\n\n';
    message += '━━━━━━━━━━━━━━━━━━━\n';
    message += `💰 <b>Total Value:</b> ${formatPortfolioValue(portfolio.totalValueUsd)}\n`;
    message += `├ Native (XNT): ${formatPortfolioValue(portfolio.nativeValueUsd)}\n`;
    message += `└ Tokens: ${formatPortfolioValue(portfolio.tokensValueUsd)}\n\n`;

    if (portfolio.topTokens.length > 0) {
      message += '🏆 <b>Top Holdings</b>\n';
      for (const token of portfolio.topTokens) {
        message += `  • ${token.symbol}: ${formatPortfolioValue(token.valueUsd)} (${token.percentage.toFixed(1)}%)\n`;
      }
      message += '\n';
    }

    message += '📊 <b>Wallets</b>\n';
    message += '━━━━━━━━━━━━━━━━━━━\n';

    // Show top 5 wallets by value
    const topWallets = portfolio.wallets.slice(0, 5);
    for (const wallet of topWallets) {
      const label = wallet.label || `${wallet.walletAddress.slice(0, 6)}...${wallet.walletAddress.slice(-4)}`;
      message += `\n📍 <b>${label}</b>\n`;
      message += `💰 ${formatPortfolioValue(wallet.totalValueUsd)}\n`;
      
      if (wallet.tokens.length > 0) {
        message += `🪙 ${wallet.tokens.length} token${wallet.tokens.length > 1 ? 's' : ''}\n`;
      }
    }

    if (portfolio.wallets.length > 5) {
      message += `\n<i>...and ${portfolio.wallets.length - 5} more wallets</i>\n`;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', 'portfolio').row()
      .text('« Back to Menu', 'main_menu');

    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error loading portfolio:', error);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMsg.message_id,
      '❌ <b>Error loading portfolio</b>\n\n' +
      'Failed to fetch price data. Please try again later.',
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
  }
}

/**
 * Send portfolio view (edit message version)
 */
export async function sendPortfolioViewEdit(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await ctx.editMessageText('💼 <b>Loading Portfolio...</b>\n\n⏳ Calculating USD values...', {
    parse_mode: 'HTML',
  });

  const wallets = getUserWallets(ctx.from.id);

  if (wallets.length === 0) {
    await ctx.editMessageText(
      '📊 <b>Portfolio</b>\n\n' +
      '❌ No wallets added yet.\n\n' +
      'Add wallets with /watch to see your portfolio value.',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  try {
    const portfolio = await getUserPortfolioSummary(wallets);

    let message = '💼 <b>Portfolio Overview</b>\n\n';
    message += '━━━━━━━━━━━━━━━━━━━\n';
    message += `💰 <b>Total Value:</b> ${formatPortfolioValue(portfolio.totalValueUsd)}\n`;
    message += `├ Native (XNT): ${formatPortfolioValue(portfolio.nativeValueUsd)}\n`;
    message += `└ Tokens: ${formatPortfolioValue(portfolio.tokensValueUsd)}\n\n`;

    if (portfolio.topTokens.length > 0) {
      message += '🏆 <b>Top Holdings</b>\n';
      for (const token of portfolio.topTokens) {
        message += `  • ${token.symbol}: ${formatPortfolioValue(token.valueUsd)} (${token.percentage.toFixed(1)}%)\n`;
      }
      message += '\n';
    }

    message += '📊 <b>Wallets</b>\n';
    message += '━━━━━━━━━━━━━━━━━━━\n';

    const topWallets = portfolio.wallets.slice(0, 5);
    for (const wallet of topWallets) {
      const label = wallet.label || `${wallet.walletAddress.slice(0, 6)}...${wallet.walletAddress.slice(-4)}`;
      message += `\n📍 <b>${label}</b>\n`;
      message += `💰 ${formatPortfolioValue(wallet.totalValueUsd)}\n`;
      
      if (wallet.tokens.length > 0) {
        message += `🪙 ${wallet.tokens.length} token${wallet.tokens.length > 1 ? 's' : ''}\n`;
      }
    }

    if (portfolio.wallets.length > 5) {
      message += `\n<i>...and ${portfolio.wallets.length - 5} more wallets</i>\n`;
    }

    const keyboard = new InlineKeyboard()
      .text('🔄 Refresh', 'portfolio').row()
      .text('« Back to Menu', 'main_menu');

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error('Error loading portfolio:', error);
    await ctx.editMessageText(
      '❌ <b>Error loading portfolio</b>\n\n' +
      'Failed to fetch price data. Please try again later.',
      { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
    );
  }
}

/**
 * Send export menu
 */
export async function sendExportMenu(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);

  if (wallets.length === 0) {
    await ctx.reply(
      '📤 <b>Export Transactions</b>\n\n' +
      '❌ No wallets to export.\n\n' +
      'Add wallets with /watch first.',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  let message = '📤 <b>Export Transactions</b>\n\n';
  message += 'Export your transaction history to CSV format.\n\n';
  message += '<b>Options:</b>\n';
  message += '• Export all wallets (combined)\n';
  message += '• Export individual wallets\n\n';
  message += '<i>CSV files can be opened in Excel, Google Sheets, etc.</i>';

  const keyboard = new InlineKeyboard()
    .text('📦 Export All Wallets', 'export_all').row();

  // Add individual wallet export buttons
  for (const wallet of wallets.slice(0, 5)) {
    const label = wallet.label || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
    keyboard.text(`📄 ${label}`, `export_wallet_${wallet.address}`).row();
  }

  keyboard.text('« Back to Menu', 'main_menu');

  await ctx.reply(message, { parse_mode: 'HTML', reply_markup: keyboard });
}

/**
 * Send export menu (edit version)
 */
export async function sendExportMenuEdit(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const wallets = getUserWallets(ctx.from.id);

  if (wallets.length === 0) {
    await ctx.editMessageText(
      '📤 <b>Export Transactions</b>\n\n' +
      '❌ No wallets to export.\n\n' +
      'Add wallets with /watch first.',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() }
    );
    return;
  }

  let message = '📤 <b>Export Transactions</b>\n\n';
  message += 'Export your transaction history to CSV format.\n\n';
  message += '<b>Options:</b>\n';
  message += '• Export all wallets (combined)\n';
  message += '• Export individual wallets\n\n';
  message += '<i>CSV files can be opened in Excel, Google Sheets, etc.</i>';

  const keyboard = new InlineKeyboard()
    .text('📦 Export All Wallets', 'export_all').row();

  for (const wallet of wallets.slice(0, 5)) {
    const label = wallet.label || `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
    keyboard.text(`📄 ${label}`, `export_wallet_${wallet.address}`).row();
  }

  keyboard.text('« Back to Menu', 'main_menu');

  await ctx.editMessageText(message, { parse_mode: 'HTML', reply_markup: keyboard });
}

/**
 * Handle exporting a single wallet
 */
export async function handleExportWallet(ctx: Context, walletAddress: string): Promise<void> {
  if (!ctx.from) return;

  await ctx.answerCallbackQuery({ text: '⏳ Generating export...' });

  const wallets = getUserWallets(ctx.from.id);
  const wallet = wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());

  if (!wallet) {
    await ctx.answerCallbackQuery({ text: '❌ Wallet not found' });
    return;
  }

  try {
    const csv = await exportWalletTransactionsCsv(wallet, 100);
    const filename = generateExportFilename(wallet.label || 'wallet');

    // Send as document
    await ctx.replyWithDocument(
      new InputFile(Buffer.from(csv), filename),
      {
        caption: `📄 <b>Transaction Export</b>\n\n` +
          `📍 Wallet: ${wallet.label || 'Unnamed'}\n` +
          `📊 Up to 100 recent transactions\n\n` +
          `<i>File: ${filename}</i>`,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    logger.error('Error exporting wallet:', error);
    await ctx.reply('❌ Error generating export. Please try again.');
  }
}

/**
 * Handle exporting all wallets
 */
export async function handleExportAllWallets(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await ctx.answerCallbackQuery({ text: '⏳ Generating export...' });

  const wallets = getUserWallets(ctx.from.id);

  try {
    const csv = await exportAllWalletsCsv(wallets, 50);
    const filename = generateExportFilename('all_wallets');

    // Send as document
    await ctx.replyWithDocument(
      new InputFile(Buffer.from(csv), filename),
      {
        caption: `📦 <b>All Wallets Export</b>\n\n` +
          `📍 Wallets: ${wallets.length}\n` +
          `📊 Up to 50 transactions per wallet\n\n` +
          `<i>File: ${filename}</i>`,
        parse_mode: 'HTML',
      }
    );
  } catch (error) {
    logger.error('Error exporting all wallets:', error);
    await ctx.reply('❌ Error generating export. Please try again.');
  }
}

/**
 * Handle muting a wallet for a period
 */
export async function handleMuteWallet(ctx: Context, walletAddress: string, minutes: number): Promise<void> {
  // This is a placeholder - you would need to add muting logic to your types and storage
  // For now, just acknowledge
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const duration = hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  
  await ctx.answerCallbackQuery({ 
    text: `🔕 Wallet muted for ${duration}`,
    show_alert: true 
  });
  
  // TODO: Implement muting logic in storage and watcher
  // This would involve:
  // 1. Add mutedUntil timestamp to WatchedWallet type
  // 2. Check mutedUntil in watcher before sending notifications
  // 3. Add unmute button to wallet action menu
}
