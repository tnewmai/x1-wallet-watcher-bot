// Telegram Bot Handlers for Cloudflare Workers
import { Bot, Context, InlineKeyboard } from 'grammy';
import { CloudflareStorage } from './storage';
import { X1Blockchain } from './blockchain';
import { Env } from './types';
import { checkWalletSecurity } from './security-simple';
import { performEnhancedSecurityScan } from './enhanced-security-scanner-cf';
import { 
  mainMenuKeyboard, 
  walletListKeyboard, 
  walletActionKeyboard,
  securityKeyboard,
  cancelKeyboard,
  backToMenuKeyboard
} from './keyboards';

export class BotHandlers {
  private bot: Bot;
  private storage: CloudflareStorage;
  private blockchain: X1Blockchain;

  constructor(bot: Bot, storage: CloudflareStorage, blockchain: X1Blockchain) {
    this.bot = bot;
    this.storage = storage;
    this.blockchain = blockchain;
    this.setupHandlers();
  }

  private setupHandlers() {
    // Start command
    this.bot.command('start', async (ctx) => {
      await this.handleStart(ctx);
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      await this.handleHelp(ctx);
    });

    // Watch wallet command
    this.bot.command('watch', async (ctx) => {
      await this.handleWatch(ctx);
    });

    // List wallets command
    this.bot.command('list', async (ctx) => {
      await this.handleList(ctx);
    });

    // Unwatch command
    this.bot.command('unwatch', async (ctx) => {
      await this.handleUnwatch(ctx);
    });

    // Settings command
    this.bot.command('settings', async (ctx) => {
      await this.handleSettings(ctx);
    });

    // Status command
    this.bot.command('status', async (ctx) => {
      await this.handleStatus(ctx);
    });

    // Add token command
    this.bot.command('addtoken', async (ctx) => {
      await this.handleAddToken(ctx);
    });

    // Callback query handler
    this.bot.on('callback_query:data', async (ctx) => {
      await this.handleCallbackQuery(ctx);
    });
  }

  private async handleStart(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    await this.storage.getUserOrCreate(
      userId,
      ctx.from?.username,
      ctx.from?.first_name
    );

    const user = await this.storage.getUser(userId);
    const settings = user?.settings;

    const welcomeMessage = `👋 <b>Welcome to X1 Wallet Sniffer!</b>

🛡️ <b>Your Shield Against Crypto Scams</b>

<b>What I Do:</b>
🚨 Detect ruggers & scammers instantly
🔍 Track funding chains to bad actors
⚠️ Real-time security risk analysis
📊 Monitor wallet activity & alerts

🚀 <b>Get Started:</b>
Tap "<b>➕ Add Wallet</b>" to scan your first address for threats.

💡 Monitor up to 10 wallets`;

    await ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      reply_markup: mainMenuKeyboard(settings?.notifyIncoming)
    });
  }

  private async handleHelp(ctx: Context) {
    const helpText = `
📖 *X1 Wallet Watcher Bot - Help*

*Commands:*
/start - Start the bot
/watch <address> [label] - Watch a wallet
/list - List your watched wallets
/unwatch <address> - Stop watching a wallet
/addtoken - Add token to track
/settings - Configure notifications
/status - Check bot status
/help - Show this help

*How to watch a wallet:*
\`/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU My Wallet\`

*Features:*
• Real-time transaction alerts
• Balance monitoring
• Token tracking (SPL + Token-2022)
• Customizable notifications

Need help? Contact @yourusername
    `.trim();

    await ctx.reply(helpText, { parse_mode: 'Markdown' });
  }

  private async handleWatch(ctx: Context) {
    console.log('handleWatch called');
    const userId = ctx.from?.id;
    if (!userId) {
      console.log('No userId found');
      return;
    }

    console.log('User ID:', userId);
    const args = ctx.message?.text?.split(' ').slice(1) || [];
    console.log('Args:', args);
    
    if (args.length === 0) {
      console.log('No arguments provided');
      await ctx.reply(
        '❌ Please provide a wallet address.\n\n' +
        '⚠️ *Important:* Send everything in ONE message!\n\n' +
        'Usage: `/watch <address> [label]`\n\n' +
        'Example (copy this):\n' +
        '`/watch 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU My Wallet`\n\n' +
        '❌ Don\'t type /watch and address separately!\n' +
        '✅ Type them together in one line!',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const address = args[0];
    const label = args.slice(1).join(' ') || `Wallet ${address.slice(0, 8)}...`;
    console.log('Address:', address, 'Label:', label);

    // Send immediate acknowledgment
    await ctx.reply('⏳ Checking wallet address...');

    // Validate address
    try {
      console.log('Checking user wallets...');
      // Check if user already has wallets
      const userWallets = await this.storage.getUserWallets(userId);
      console.log('User has', userWallets.length, 'wallets');
      
      if (userWallets.length >= 10) {
        await ctx.reply('❌ You can watch up to 10 wallets. Please remove some first.');
        return;
      }

      // Check if already watching
      if (userWallets.some(w => w.address === address)) {
        await ctx.reply('❌ You are already watching this wallet.');
        return;
      }

      console.log('Fetching balance from blockchain...');
      // Get initial balance
      const balance = await this.blockchain.getBalance(address);
      console.log('Balance:', balance);

      console.log('Adding wallet to storage...');
      // Add wallet
      await this.storage.addWallet(userId, address, label, balance);
      console.log('Wallet added successfully');

      const keyboard = new InlineKeyboard()
        .text('📊 View Wallets', 'list_wallets')
        .text('➕ Add Token', `add_token:${address}`);

      await ctx.reply(
        `✅ Now watching wallet!\n\n` +
        `📍 Label: ${label}\n` +
        `📫 Address: \`${address}\`\n` +
        `💰 Current Balance: ${balance.toFixed(6)} XN\n\n` +
        `You'll receive notifications for any transactions.`,
        { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        }
      );
    } catch (error: any) {
      console.error('Error watching wallet:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      await ctx.reply(`❌ Error: ${error.message}\n\nPlease check the wallet address and try again.`);
    }
  }

  private async handleList(ctx: Context) {
    console.log('📋 handleList called');
    const userId = ctx.from?.id;
    console.log('👤 User ID:', userId);
    if (!userId) {
      console.log('❌ No userId found');
      return;
    }

    console.log('🔍 Fetching wallets for user:', userId);
    const wallets = await this.storage.getUserWallets(userId);
    console.log('📊 Found wallets:', wallets.length);

    if (wallets.length === 0) {
      const keyboard = new InlineKeyboard()
        .text('➕ Watch Wallet', 'watch_wallet');
      
      await ctx.reply(
        '📭 You are not watching any wallets yet.\n\n' +
        'Use /watch to start monitoring a wallet!',
        { reply_markup: keyboard }
      );
      return;
    }

    let message = `📊 *Your Watched Wallets* (${wallets.length}/10)\n\n`;

    for (const wallet of wallets) {
      const tokensCount = wallet.tokens?.length || 0;
      message += `📍 *${wallet.label}*\n`;
      message += `   Address: \`${wallet.address}\`\n`;
      message += `   Balance: ${wallet.lastBalance.toFixed(6)} XN\n`;
      if (tokensCount > 0) {
        message += `   Tokens: ${tokensCount} tracked\n`;
      }
      message += '\n';
    }

    const keyboard = new InlineKeyboard()
      .text('➕ Watch Another', 'watch_wallet')
      .text('🗑️ Remove Wallet', 'unwatch_menu');

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }

  private async handleUnwatch(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const args = ctx.message?.text?.split(' ').slice(1) || [];
    if (args.length === 0) {
      await ctx.reply(
        '❌ Please provide a wallet address.\n\n' +
        'Usage: `/unwatch <address>`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const address = args[0];
    const removed = await this.storage.removeWallet(userId, address);

    if (removed) {
      await ctx.reply(`✅ Stopped watching wallet: \`${address}\``, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply('❌ Wallet not found in your watch list.');
    }
  }

  private async handleSettings(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = await this.storage.getUser(userId);
    if (!user) return;

    const settings = user.settings;
    
    const keyboard = new InlineKeyboard()
      .text(
        `${settings.notifyIncoming ? '✅' : '❌'} Incoming`,
        'toggle:notifyIncoming'
      )
      .text(
        `${settings.notifyOutgoing ? '✅' : '❌'} Outgoing`,
        'toggle:notifyOutgoing'
      ).row()
      .text(
        `${settings.notifyBalance ? '✅' : '❌'} Balance`,
        'toggle:notifyBalance'
      )
      .text(
        `${settings.notifyTokens ? '✅' : '❌'} Tokens`,
        'toggle:notifyTokens'
      );

    await ctx.reply(
      `⚙️ *Notification Settings*\n\n` +
      `Click to toggle notifications:\n\n` +
      `📥 Incoming: ${settings.notifyIncoming ? '✅ On' : '❌ Off'}\n` +
      `📤 Outgoing: ${settings.notifyOutgoing ? '✅ On' : '❌ Off'}\n` +
      `💰 Balance: ${settings.notifyBalance ? '✅ On' : '❌ Off'}\n` +
      `🔷 Tokens: ${settings.notifyTokens ? '✅ On' : '❌ Off'}\n\n` +
      `Min value filter: ${settings.minValueFilter} XN`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );
  }

  private async handleStatus(ctx: Context) {
    try {
      const healthy = await this.blockchain.healthCheck();
      const stats = await this.storage.getStats();
      
      const status = healthy ? '🟢 Online' : '🔴 Offline';
      
      await ctx.reply(
        `📊 *Bot Status*\n\n` +
        `Status: ${status}\n` +
        `Total Wallets Monitored: ${stats.totalWallets}\n` +
        `RPC Connection: ${healthy ? '✅ Connected' : '❌ Disconnected'}\n\n` +
        `_Powered by Cloudflare Workers_`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      await ctx.reply('❌ Error checking status.');
    }
  }

  private async handleAddToken(ctx: Context) {
    await ctx.reply(
      '🔷 *Add Token to Track*\n\n' +
      'This feature allows you to track SPL token balances.\n\n' +
      'Coming soon in this webhook version!',
      { parse_mode: 'Markdown' }
    );
  }

  private async handleCallbackQuery(ctx: Context) {
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    // Security check - SNIFF FOR RUGS button
    if (data.startsWith('security_check_')) {
      const walletAddress = data.replace('security_check_', '');
      await this.performSecurityCheck(ctx, walletAddress);
      return;
    }

    // Wallet menu - show wallet details with security button
    if (data.startsWith('wallet_menu_')) {
      const walletAddress = data.replace('wallet_menu_', '');
      await this.showWalletMenu(ctx, walletAddress);
      return;
    }

    if (data.startsWith('toggle:')) {
      const setting = data.split(':')[1];
      const userId = ctx.from?.id;
      if (!userId) return;

      const user = await this.storage.getUser(userId);
      if (user) {
        const currentValue = user.settings[setting as keyof typeof user.settings];
        await this.storage.updateUserSettings(userId, {
          [setting]: !currentValue
        });
        
        await ctx.answerCallbackQuery({ text: `${setting} toggled!` });
        await this.handleSettings(ctx);
      }
    } else if (data === 'list_wallets') {
      await this.handleListWithKeyboard(ctx);
    } else if (data === 'watch_wallet') {
      await ctx.reply('Use /watch <address> [label] to watch a wallet');
    } else if (data === 'settings') {
      await this.handleSettings(ctx);
    } else if (data === 'help') {
      await this.handleHelp(ctx);
    } else if (data === 'main_menu') {
      await this.handleStart(ctx);
    }

    await ctx.answerCallbackQuery();
  }

  private async handleListWithKeyboard(ctx: Context) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const wallets = await this.storage.getUserWallets(userId);

    if (wallets.length === 0) {
      await ctx.editMessageText(
        '📭 You are not watching any wallets yet.\n\n' +
        '💡 Add your first wallet to start tracking rugger activity!',
        { parse_mode: 'HTML', reply_markup: backToMenuKeyboard() }
      );
      return;
    }

    let message = `🔍 <b>Wallet Sniffer</b>\n\n`;
    message += `You're monitoring <b>${wallets.length}</b> wallet${wallets.length > 1 ? 's' : ''}.\n`;
    message += `Tap a wallet to scan for ruggers & deployers.\n\n`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: walletListKeyboard(wallets)
    });
  }

  private async showWalletMenu(ctx: Context, walletAddress: string) {
    const userId = ctx.from?.id;
    if (!userId) return;

    const wallets = await this.storage.getUserWallets(userId);
    const wallet = wallets.find(w => w.address === walletAddress);
    
    if (!wallet) {
      await ctx.answerCallbackQuery({ text: 'Wallet not found!' });
      return;
    }

    const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    
    let message = `📍 <b>Wallet Details</b>\n\n`;
    message += `<b>Label:</b> ${wallet.label}\n`;
    message += `<b>Address:</b>\n<code>${walletAddress}</code>\n\n`;
    message += `💰 <b>Balance:</b> ${wallet.lastBalance?.toFixed(6) || '0.000000'} XN\n\n`;
    message += `🛡️ <i>Tap "🚨 SNIFF FOR RUGS" to scan for threats</i>\n`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: walletActionKeyboard(wallet)
    });
  }

  private async performSecurityCheck(ctx: Context, walletAddress: string) {
    const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    
    // Show loading message
    await ctx.editMessageText(
      `🛡️ <b>Rugger &amp; Deployer Scanner</b>\n\n` +
      `📍 <code>${shortAddr}</code>\n\n` +
      `⏳ <b>Scanning...</b>\n\n` +
      `Checking for deployers, ruggers, and threats.\n` +
      `This typically takes 3-8 seconds.`,
      { parse_mode: 'HTML' }
    );

    try {
      // Quick blocklist check first
      const quickCheck = performEnhancedSecurityScan(walletAddress, null);
      
      // If critical threat found, show warning immediately
      if (quickCheck.recommendedAction === 'BLOCK' && quickCheck.isKnownRugger) {
        let instantMessage = `🛡️ <b>SECURITY SCAN</b>\n\n`;
        instantMessage += `📍 <code>${shortAddr}</code>\n\n`;
        instantMessage += `🚨 <b>⚠️ KNOWN RUG PULLER DETECTED! ⚠️</b>\n\n`;
        
        if (quickCheck.serialData) {
          instantMessage += `📊 <b>Criminal Record:</b>\n`;
          instantMessage += `   • Total Rug Pulls: ${quickCheck.serialData.totalRugPulls}\n`;
          instantMessage += `   • Risk Score: ${quickCheck.serialData.riskScore}/100\n\n`;
        }
        
        instantMessage += `⛔ <b>DO NOT INTERACT WITH THIS WALLET!</b>\n\n`;
        instantMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        instantMessage += `🚨 <b>⛔ TRANSACTION BLOCKED ⛔</b>\n`;
        instantMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        
        await ctx.editMessageText(instantMessage, {
          parse_mode: 'HTML',
          reply_markup: securityKeyboard(walletAddress)
        });
        return;
      }

      // Full blockchain security check
      const securityInfo = await checkWalletSecurity(walletAddress);
      const enhancedCheck = performEnhancedSecurityScan(
        walletAddress, 
        securityInfo.fundingSource
      );

      // Build security report
      let message = `🛡️ <b>SECURITY SCAN COMPLETE</b>\n\n`;
      message += `📍 <code>${shortAddr}</code>\n\n`;

      // Threat level
      const isDeployer = securityInfo.isDeployer;
      const rugCount = securityInfo.deployedTokensAnalysis.filter(t => t.isRugpull).length;
      
      let threatLevel = '🟢 CLEAN';
      let threatEmoji = '✅';
      
      if (enhancedCheck.isKnownRugger || rugCount >= 3) {
        threatLevel = '🔴 CRITICAL';
        threatEmoji = '🚨';
      } else if (rugCount >= 1 || enhancedCheck.suspiciousFunding) {
        threatLevel = '🟡 MEDIUM';
        threatEmoji = '⚠️';
      }

      message += `${threatEmoji} <b>Threat Level: ${threatLevel}</b>\n\n`;

      // Known rugger info
      if (enhancedCheck.isKnownRugger && enhancedCheck.serialData) {
        message += `🚨 <b>KNOWN RUG PULLER!</b>\n`;
        message += `Total Scams: ${enhancedCheck.serialData.totalRugPulls}\n`;
        message += `Risk Score: ${enhancedCheck.serialData.riskScore}/100\n\n`;
      }

      // Deployer info
      if (isDeployer) {
        message += `🏭 <b>Token Deployer</b>\n`;
        message += `Deployed: ${securityInfo.deployedTokens.length} tokens\n`;
        if (rugCount > 0) {
          message += `🚨 Rugged: ${rugCount} tokens\n`;
        }
        message += `\n`;
      }

      // Funding source
      if (securityInfo.fundingSource) {
        const fundShort = `${securityInfo.fundingSource.slice(0, 6)}...${securityInfo.fundingSource.slice(-4)}`;
        message += `💰 <b>Funded by:</b>\n<code>${fundShort}</code>\n`;
        if (enhancedCheck.suspiciousFunding) {
          message += `⚠️ Suspicious funder!\n`;
        }
        message += `\n`;
      }

      // Recommendations
      if (enhancedCheck.recommendedAction === 'BLOCK') {
        message += `🚨 <b>RECOMMENDATION: AVOID!</b>\n`;
      } else if (enhancedCheck.recommendedAction === 'WARN') {
        message += `⚠️ <b>RECOMMENDATION: EXTREME CAUTION</b>\n`;
      } else {
        message += `✅ No major threats detected.\n`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        reply_markup: securityKeyboard(walletAddress)
      });

    } catch (error) {
      console.error('Security check error:', error);
      await ctx.editMessageText(
        `❌ <b>Security Scan Failed</b>\n\n` +
        `Could not complete scan for ${shortAddr}.\n` +
        `Please try again later.`,
        {
          parse_mode: 'HTML',
          reply_markup: securityKeyboard(walletAddress)
        }
      );
    }
  }
}
