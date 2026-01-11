/**
 * Settings Handlers
 * Handlers for bot settings and notifications
 */

import { Context } from 'grammy';
import { getStorage } from '../storage-v2';
import { checkCommandRateLimit } from '../validation';
import { EMOJI, MIN_VALUE_OPTIONS } from '../constants';
import { settingsKeyboard, mainMenuKeyboard, minValueKeyboard, backToMenuKeyboard } from '../keyboards-helpers';
import logger from '../logger';

/**
 * Handle /settings command
 */
export async function handleSettingsCommand(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const rateLimitCheck = checkCommandRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.reply(rateLimitCheck.message!);
    return;
  }

  await sendSettings(ctx);
}

/**
 * Send settings menu
 */
export async function sendSettings(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  
  const storage = getStorage();
  const settings = await storage.getUserSettings(ctx.from.id);
  
  await ctx.reply(
    `${EMOJI.SETTINGS} <b>Notification Settings</b>\n\n` +
    `Customize what transactions you want to be notified about:`,
    { parse_mode: 'HTML', reply_markup: settingsKeyboard(settings) }
  );
}

/**
 * Send settings menu (edit version)
 */
export async function sendSettingsEdit(ctx: Context): Promise<void> {
  if (!ctx.from) return;
  
  const storage = getStorage();
  const settings = await storage.getUserSettings(ctx.from.id);
  
  await ctx.editMessageText(
    `${EMOJI.SETTINGS} <b>Notification Settings</b>\n\n` +
    `Customize what transactions you want to be notified about:`,
    { parse_mode: 'HTML', reply_markup: settingsKeyboard(settings) }
  );
}

/**
 * Toggle master notifications
 */
export async function handleToggleNotifications(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const settings = await storage.getUserSettings(ctx.from.id);
  const newStatus = !settings.transactionsEnabled;
  
  await storage.updateUserSettings(ctx.from.id, { transactionsEnabled: newStatus });
  
  const statusText = newStatus ? 'Notifications ON' : 'Notifications OFF';
  const emoji = newStatus ? EMOJI.ALERT : EMOJI.MUTE;
  
  await ctx.answerCallbackQuery({ text: `${emoji} ${statusText}` });
  await sendSettingsEdit(ctx);
  
  logger.info(`User ${ctx.from.id} ${newStatus ? 'enabled' : 'disabled'} notifications`);
}

/**
 * Toggle incoming transaction notifications
 */
export async function handleToggleIncoming(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const settings = await storage.getUserSettings(ctx.from.id);
  await storage.updateUserSettings(ctx.from.id, { incoming: !settings.incoming });
  
  await sendSettingsEdit(ctx);
}

/**
 * Toggle outgoing transaction notifications
 */
export async function handleToggleOutgoing(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const settings = await storage.getUserSettings(ctx.from.id);
  await storage.updateUserSettings(ctx.from.id, { outgoing: !settings.outgoing });
  
  await sendSettingsEdit(ctx);
}

/**
 * Toggle contract interaction notifications
 */
export async function handleToggleContracts(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const settings = await storage.getUserSettings(ctx.from.id);
  await storage.updateUserSettings(ctx.from.id, { contractInteractions: !settings.contractInteractions });
  
  await sendSettingsEdit(ctx);
}

/**
 * Toggle balance alerts
 */
export async function handleToggleBalanceAlerts(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  const settings = await storage.getUserSettings(ctx.from.id);
  await storage.updateUserSettings(ctx.from.id, { balanceAlerts: !settings.balanceAlerts });
  
  await sendSettingsEdit(ctx);
}

/**
 * Show minimum value selection
 */
export async function handleSetMinValue(ctx: Context): Promise<void> {
  await ctx.editMessageText(
    `${EMOJI.BALANCE} <b>Set Minimum Value</b>\n\n` +
    `Choose the minimum transaction value to be notified about:`,
    { parse_mode: 'HTML', reply_markup: minValueKeyboard() }
  );
}

/**
 * Update minimum value
 */
export async function handleUpdateMinValue(ctx: Context, value: number): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  await storage.updateUserSettings(ctx.from.id, { minValue: value });
  
  await ctx.answerCallbackQuery({ 
    text: `${EMOJI.CHECK} Minimum value set to ${value} XNT` 
  });
  await sendSettingsEdit(ctx);
  
  logger.info(`User ${ctx.from.id} set min value to ${value}`);
}

/**
 * Reset settings to default
 */
export async function handleResetSettings(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const storage = getStorage();
  await storage.updateUserSettings(ctx.from.id, {
    transactionsEnabled: true,
    incoming: true,
    outgoing: true,
    contractInteractions: true,
    balanceAlerts: true,
    minValue: 0,
  });
  
  await ctx.answerCallbackQuery({ text: `${EMOJI.SUCCESS} Settings reset to default` });
  await sendSettingsEdit(ctx);
  
  logger.info(`User ${ctx.from.id} reset settings to default`);
}
