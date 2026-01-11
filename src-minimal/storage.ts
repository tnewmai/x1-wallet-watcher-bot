/**
 * Ultra-Simple JSON File Storage
 * Replaces PostgreSQL + Prisma (428 lines → 150 lines)
 */
import fs from 'fs';
import path from 'path';
import { UserData, UserSettings, WatchedWallet } from './types';
import { createLogger } from './logger';

const logger = createLogger('Storage');

interface StorageData {
  users: Map<number, UserData>;
  version: number;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const BACKUP_FILE = path.join(DATA_DIR, 'data.backup.json');

let storage: StorageData = {
  users: new Map(),
  version: 1,
};

let saveTimeout: NodeJS.Timeout | null = null;
let isLoaded = false;

/**
 * Load storage from disk
 */
export function loadStorage(): void {
  if (isLoaded) return;
  
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      logger.info('Created data directory');
    }
    
    // Load existing data
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      
      // Convert plain object to Map
      if (parsed.users) {
        storage.users = new Map(Object.entries(parsed.users).map(([k, v]) => [parseInt(k), v as UserData]));
      }
      storage.version = parsed.version || 1;
      
      logger.info(`Loaded ${storage.users.size} users from storage`);
    } else {
      logger.info('No existing data file, starting fresh');
    }
    
    isLoaded = true;
  } catch (error) {
    logger.error('Failed to load storage', error);
    
    // Try backup
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const raw = fs.readFileSync(BACKUP_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        storage.users = new Map(Object.entries(parsed.users).map(([k, v]) => [parseInt(k), v as UserData]));
        logger.info('Restored from backup');
      } catch (backupError) {
        logger.error('Backup restoration failed', backupError);
      }
    }
  }
}

/**
 * Save storage to disk (debounced)
 */
export function saveStorage(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = setTimeout(() => {
    forceFlushStorage();
  }, 2000); // Debounce 2 seconds
}

/**
 * Force immediate save
 */
export function forceFlushStorage(): void {
  try {
    // Create backup of current file
    if (fs.existsSync(DATA_FILE)) {
      fs.copyFileSync(DATA_FILE, BACKUP_FILE);
    }
    
    // Convert Map to plain object for JSON serialization
    const dataToSave = {
      users: Object.fromEntries(storage.users),
      version: storage.version,
      lastSaved: Date.now(),
    };
    
    // Write to temp file first, then rename (atomic)
    const tempFile = DATA_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(dataToSave, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
    
    logger.debug(`Storage saved: ${storage.users.size} users`);
  } catch (error) {
    logger.error('Failed to save storage', error);
  }
}

/**
 * Get or create user
 */
export function getUser(telegramId: number, username?: string): UserData {
  let user = storage.users.get(telegramId);
  
  if (!user) {
    user = {
      telegramId,
      username,
      wallets: [],
      settings: getDefaultSettings(),
      createdAt: Date.now(),
    };
    storage.users.set(telegramId, user);
    saveStorage();
  }
  
  return user;
}

/**
 * Get all users
 */
export function getAllUsers(): UserData[] {
  return Array.from(storage.users.values());
}

/**
 * Update user settings
 */
export function updateSettings(telegramId: number, settings: Partial<UserSettings>): void {
  const user = getUser(telegramId);
  user.settings = { ...user.settings, ...settings };
  saveStorage();
}

/**
 * Add wallet to user
 */
export function addWallet(telegramId: number, address: string, label?: string): WatchedWallet {
  const user = getUser(telegramId);
  
  // Check if already exists
  const existing = user.wallets.find(w => w.address === address);
  if (existing) {
    throw new Error('Wallet already being watched');
  }
  
  const wallet: WatchedWallet = {
    address,
    label,
    addedAt: Date.now(),
    alertsEnabled: true,
  };
  
  user.wallets.push(wallet);
  saveStorage();
  
  return wallet;
}

/**
 * Remove wallet from user
 */
export function removeWallet(telegramId: number, address: string): boolean {
  const user = getUser(telegramId);
  const index = user.wallets.findIndex(w => w.address === address);
  
  if (index === -1) return false;
  
  user.wallets.splice(index, 1);
  saveStorage();
  
  return true;
}

/**
 * Get user's wallets
 */
export function getWallets(telegramId: number): WatchedWallet[] {
  const user = storage.users.get(telegramId);
  return user?.wallets || [];
}

/**
 * Update wallet data
 */
export function updateWallet(
  telegramId: number,
  address: string,
  updates: Partial<WatchedWallet>
): void {
  const user = getUser(telegramId);
  const wallet = user.wallets.find(w => w.address === address);
  
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  
  Object.assign(wallet, updates);
  saveStorage();
}

/**
 * Get all watched wallets across all users
 */
export function getAllWatchedWallets(): Array<{ telegramId: number; wallet: WatchedWallet }> {
  const result: Array<{ telegramId: number; wallet: WatchedWallet }> = [];
  
  for (const [telegramId, user] of storage.users) {
    for (const wallet of user.wallets) {
      if (wallet.alertsEnabled) {
        result.push({ telegramId, wallet });
      }
    }
  }
  
  return result;
}

/**
 * Get default user settings
 */
function getDefaultSettings(): UserSettings {
  return {
    notifyIncoming: true,
    notifyOutgoing: true,
    notifyBalanceChange: true,
    minValueXn: 0.001,
  };
}

/**
 * Get storage statistics
 */
export function getStats() {
  const totalWallets = Array.from(storage.users.values()).reduce(
    (sum, user) => sum + user.wallets.length,
    0
  );
  
  return {
    totalUsers: storage.users.size,
    totalWallets,
    storageVersion: storage.version,
  };
}

/**
 * Auto-save interval
 */
let autoSaveInterval: NodeJS.Timeout | null = null;

export function startAutoSave(intervalMs: number = 30000): void {
  if (autoSaveInterval) return;
  
  autoSaveInterval = setInterval(() => {
    forceFlushStorage();
  }, intervalMs);
  
  logger.info(`Auto-save started (every ${intervalMs / 1000}s)`);
}

export function stopAutoSave(): void {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    forceFlushStorage(); // Final save
  }
}
