/**
 * Export Handlers
 * Handlers for data export functionality
 */

import { Context } from 'grammy';
import { exportWallets, ExportFormat, getExportFileExtension, getExportMimeType } from '../export';
import { checkCommandRateLimit } from '../validation';
import { EMOJI } from '../constants';
import { InputFile } from 'grammy';
import logger from '../logger';

/**
 * Handle /export command
 */
export async function handleExportCommand(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  const rateLimitCheck = checkCommandRateLimit(ctx.from.id);
  if (!rateLimitCheck.allowed) {
    await ctx.reply(rateLimitCheck.message!);
    return;
  }

  await ctx.reply(
    `${EMOJI.DOCUMENT} <b>Export Wallets</b>\n\n` +
    `Choose export format:\n\n` +
    `/export_json - JSON format (recommended)\n` +
    `/export_csv - CSV format (for Excel)\n` +
    `/export_txt - Plain text format`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle JSON export
 */
export async function handleExportJSON(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await performExport(ctx, 'json');
}

/**
 * Handle CSV export
 */
export async function handleExportCSV(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await performExport(ctx, 'csv');
}

/**
 * Handle TXT export
 */
export async function handleExportTXT(ctx: Context): Promise<void> {
  if (!ctx.from) return;

  await performExport(ctx, 'txt');
}

/**
 * Perform export
 */
async function performExport(ctx: Context, format: ExportFormat): Promise<void> {
  if (!ctx.from) return;

  try {
    await ctx.reply(`${EMOJI.LOADING} Generating export...`);

    const data = await exportWallets(ctx.from.id, format);
    const extension = getExportFileExtension(format);
    const mimeType = getExportMimeType(format);
    const filename = `wallets_${Date.now()}.${extension}`;

    // Send as document
    await ctx.replyWithDocument(
      new InputFile(Buffer.from(data), filename),
      {
        caption: `${EMOJI.SUCCESS} Export complete!\n\nFormat: ${format.toUpperCase()}`,
      }
    );

    logger.info(`User ${ctx.from.id} exported wallets in ${format} format`);
  } catch (error) {
    logger.error('Error exporting wallets:', error);
    await ctx.reply(`${EMOJI.ERROR} Export failed. Please try again.`);
  }
}
