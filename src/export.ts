/**
 * Export Functionality
 * Export wallet data and transactions to various formats
 */

import { getStorage } from './storage-v2';
import { WatchedWallet } from './types';
import logger from './logger';

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json' | 'txt';

/**
 * Export wallet data to CSV
 */
export async function exportWalletsToCSV(userId: number): Promise<string> {
  try {
    const storage = getStorage();
    const wallets = await storage.getWallets(userId);

    let csv = 'Address,Label,Added At,Alerts Enabled,Last Balance\n';
    
    for (const wallet of wallets) {
      const addedAt = new Date(wallet.addedAt).toISOString();
      const alertsEnabled = wallet.alertsEnabled ? 'Yes' : 'No';
      const balance = wallet.lastBalance || 'N/A';
      const label = (wallet.label || '').replace(/,/g, ';'); // Escape commas
      
      csv += `"${wallet.address}","${label}","${addedAt}","${alertsEnabled}","${balance}"\n`;
    }

    logger.info(`Exported ${wallets.length} wallets to CSV for user ${userId}`);
    return csv;
  } catch (error) {
    logger.error('Error exporting wallets to CSV:', error);
    throw error;
  }
}

/**
 * Export wallet data to JSON
 */
export async function exportWalletsToJSON(userId: number): Promise<string> {
  try {
    const storage = getStorage();
    const wallets = await storage.getWallets(userId);

    const exportData = {
      exportedAt: new Date().toISOString(),
      userId,
      walletCount: wallets.length,
      wallets: wallets.map(wallet => ({
        address: wallet.address,
        label: wallet.label,
        addedAt: new Date(wallet.addedAt).toISOString(),
        alertsEnabled: wallet.alertsEnabled,
        lastBalance: wallet.lastBalance,
      })),
    };

    logger.info(`Exported ${wallets.length} wallets to JSON for user ${userId}`);
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    logger.error('Error exporting wallets to JSON:', error);
    throw error;
  }
}

/**
 * Export wallet data to plain text
 */
export async function exportWalletsToText(userId: number): Promise<string> {
  try {
    const storage = getStorage();
    const wallets = await storage.getWallets(userId);

    let text = `WALLET EXPORT\n`;
    text += `Generated: ${new Date().toLocaleString()}\n`;
    text += `Total Wallets: ${wallets.length}\n`;
    text += `\n${'='.repeat(80)}\n\n`;

    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      const addedAt = new Date(wallet.addedAt).toLocaleString();
      
      text += `Wallet ${i + 1}:\n`;
      text += `  Address: ${wallet.address}\n`;
      if (wallet.label) {
        text += `  Label: ${wallet.label}\n`;
      }
      text += `  Added: ${addedAt}\n`;
      text += `  Alerts: ${wallet.alertsEnabled ? 'Enabled' : 'Disabled'}\n`;
      if (wallet.lastBalance) {
        text += `  Balance: ${wallet.lastBalance} XNT\n`;
      }
      text += `\n`;
    }

    logger.info(`Exported ${wallets.length} wallets to TEXT for user ${userId}`);
    return text;
  } catch (error) {
    logger.error('Error exporting wallets to TEXT:', error);
    throw error;
  }
}

/**
 * Export wallets with specified format
 */
export async function exportWallets(
  userId: number,
  format: ExportFormat = 'json'
): Promise<string> {
  switch (format) {
    case 'csv':
      return await exportWalletsToCSV(userId);
    case 'json':
      return await exportWalletsToJSON(userId);
    case 'txt':
      return await exportWalletsToText(userId);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Get export file extension
 */
export function getExportFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    case 'txt':
      return 'txt';
    default:
      return 'txt';
  }
}

/**
 * Get export MIME type
 */
export function getExportMimeType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'txt':
      return 'text/plain';
    default:
      return 'text/plain';
  }
}

/**
 * Generate export filename with timestamp
 */
export function generateExportFilename(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}_${timestamp}`;
}

/**
 * Export wallet transactions to CSV (placeholder for now)
 */
export async function exportWalletTransactionsCsv(wallet: WatchedWallet, limit: number = 100): Promise<string> {
  // Placeholder implementation - transactions would need to be fetched from blockchain
  let csv = 'Timestamp,Type,Amount,From,To,Signature\\n';
  csv += `# Export for wallet: ${wallet.address}\\n`;
  csv += `# Label: ${wallet.label || 'N/A'}\\n`;
  csv += `# Limit: ${limit} transactions\\n`;
  logger.info(`Exported transactions CSV for wallet ${wallet.address}`);
  return csv;
}

/**
 * Export all wallets transactions to CSV (placeholder for now)
 */
export async function exportAllWalletsCsv(wallets: WatchedWallet[], limitPerWallet: number = 50): Promise<string> {
  // Placeholder implementation
  let csv = 'Wallet Address,Label,Timestamp,Type,Amount,Signature\\n';
  csv += `# Export for ${wallets.length} wallets\\n`;
  csv += `# Limit: ${limitPerWallet} transactions per wallet\\n`;
  logger.info(`Exported all wallets transactions CSV (${wallets.length} wallets)`);
  return csv;
}
