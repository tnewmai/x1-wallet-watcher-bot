import fs from 'fs';
import path from 'path';
import { config } from './config';
import { StorageData, UserData, WatchedWallet, NotificationSettings, defaultNotificationSettings, TrackedToken } from './types';
import { createLogger } from './logger';

const logger = createLogger('Storage');

const STORAGE_FILE = path.join(config.dataPath, 'data.json');

// In-memory storage cache to avoid constant file reads
let storageCache: StorageData | null = null;
let storageDirty = false;
let lastFileModTime: number = 0; // Track file modification time

// Write batching to avoid excessive disk I/O
let pendingWrites = 0;
let writeTimeout: NodeJS.Timeout | null = null;
const WRITE_DEBOUNCE_MS = 1000; // Batch writes within 1 second
const MAX_PENDING_WRITES = 10; // Force write after 10 changes

// Initialize empty storage
function getEmptyStorage(): StorageData {
  return {
    users: {},
    stats: {
      totalUsers: 0,
      totalWallets: 0,
      totalNotificationsSent: 0,
    },
  };
}

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(config.dataPath)) {
    fs.mkdirSync(config.dataPath, { recursive: true });
  }
}

// Load storage from file (with caching)
export function loadStorage(): StorageData {
  ensureDataDir();
  
  if (!fs.existsSync(STORAGE_FILE)) {
    const emptyStorage = getEmptyStorage();
    storageCache = emptyStorage;
    lastFileModTime = 0;
    saveStorage(emptyStorage);
    return emptyStorage;
  }
  
  try {
    // Check if file has been modified externally
    const stats = fs.statSync(STORAGE_FILE);
    const currentModTime = stats.mtimeMs;
    
    // Return cached version if available, not dirty, and file hasn't been modified
    if (storageCache && !storageDirty && lastFileModTime > 0 && currentModTime === lastFileModTime) {
      return storageCache;
    }
    
    // File was modified externally or cache is invalid, reload from disk
    const data = fs.readFileSync(STORAGE_FILE, 'utf-8');
    storageCache = JSON.parse(data) as StorageData;
    lastFileModTime = currentModTime;
    
    // Validate structure to catch corrupted data
    if (!storageCache || typeof storageCache !== 'object' || 
        !storageCache.users || !storageCache.stats) {
      throw new Error('Invalid storage structure');
    }
    
    storageDirty = false;
    return storageCache;
  } catch (error: any) {
    logger.error('Error loading storage:', error.message);
    
    // Backup corrupted file if it exists
    if (fs.existsSync(STORAGE_FILE)) {
      const backupFile = STORAGE_FILE + '.corrupted.' + Date.now();
      try {
        fs.copyFileSync(STORAGE_FILE, backupFile);
        logger.info(`📦 Corrupted storage backed up to: ${backupFile}`);
      } catch (backupError) {
        logger.error('Failed to backup corrupted file:', backupError);
      }
    }
    
    const emptyStorage = getEmptyStorage();
    storageCache = emptyStorage;
    lastFileModTime = 0;
    saveStorage(emptyStorage);
    return emptyStorage;
  }
}

// Save storage to file (with batching and async writes)
export function saveStorage(data: StorageData): void {
  storageCache = data;
  storageDirty = true;
  pendingWrites++;
  
  // Always clear existing timeout before setting a new one to prevent leaks
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  
  // Force immediate write if we have too many pending changes
  if (pendingWrites >= MAX_PENDING_WRITES) {
    flushStorage();
    return;
  }
  
  // Otherwise, debounce the write
  writeTimeout = setTimeout(() => {
    flushStorage();
  }, WRITE_DEBOUNCE_MS);
}

// Flush storage immediately to disk
function flushStorage(): void {
  if (!storageCache || !storageDirty) return;
  
  ensureDataDir();
  
  // Clear timeout first to prevent race conditions
  if (writeTimeout) {
    clearTimeout(writeTimeout);
    writeTimeout = null;
  }
  
  try {
    // Use async write with temp file for atomicity
    const tempFile = STORAGE_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(storageCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, STORAGE_FILE);
    
    // Update modification time after successful write
    const stats = fs.statSync(STORAGE_FILE);
    lastFileModTime = stats.mtimeMs;
    
    storageDirty = false;
    pendingWrites = 0;
  } catch (error) {
    logger.error('Error flushing storage to disk:', error);
    // Don't clear dirty flag on error so retry can happen
  }
}

// Force flush on shutdown
export function forceFlushStorage(): void {
  flushStorage();
}

// Periodic flush (call this from main process every 30 seconds)
let flushInterval: NodeJS.Timeout | null = null;
export function startPeriodicFlush(intervalMs: number = 30000): void {
  if (flushInterval) return;
  
  flushInterval = setInterval(() => {
    if (storageDirty) {
      flushStorage();
    }
  }, intervalMs);
}

export function stopPeriodicFlush(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
  flushStorage(); // Final flush
}

// Get or create user
export function getOrCreateUser(telegramId: number, username?: string): UserData {
  const storage = loadStorage();
  const id = telegramId.toString();
  
  if (!storage.users[id]) {
    storage.users[id] = {
      visibleTelegramId: telegramId,
      username,
      wallets: [],
      settings: { ...defaultNotificationSettings },
      createdAt: Date.now(),
      isActive: true,
    };
    storage.stats.totalUsers++;
    saveStorage(storage);
  } else if (username && storage.users[id].username !== username) {
    // Update username if changed
    storage.users[id].username = username;
    saveStorage(storage);
  }
  
  return storage.users[id];
}

// Add wallet to user's watch list
export function addWallet(telegramId: number, address: string, label?: string): { success: boolean; message: string } {
  const storage = loadStorage();
  const id = telegramId.toString();
  let user = storage.users[id];
  
  // Create user if doesn't exist
  if (!user) {
    storage.users[id] = {
      visibleTelegramId: telegramId,
      wallets: [],
      settings: { ...defaultNotificationSettings },
      createdAt: Date.now(),
      isActive: true,
    };
    storage.stats.totalUsers++;
    user = storage.users[id];
  }
  
  if (user.wallets.length >= config.maxWalletsPerUser) {
    return { success: false, message: `Maximum ${config.maxWalletsPerUser} wallets allowed per user.` };
  }
  
  // Check if wallet already exists
  const existing = user.wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
  if (existing) {
    return { success: false, message: 'This wallet is already in your watch list.' };
  }
  
  user.wallets.push({
    address,
    label,
    addedAt: Date.now(),
  });
  
  storage.stats.totalWallets++;
  saveStorage(storage);
  
  return { success: true, message: 'Wallet added successfully!' };
}

// Remove wallet from user's watch list
export function removeWallet(telegramId: number, address: string): { success: boolean; message: string } {
  const storage = loadStorage();
  const id = telegramId.toString();
  const user = storage.users[id];
  
  if (!user) {
    logger.info(`❌ Remove wallet failed: User ${id} not found`);
    return { success: false, message: 'User not found.' };
  }
  
  const index = user.wallets.findIndex(w => w.address.toLowerCase() === address.toLowerCase());
  if (index === -1) {
    logger.info(`❌ Remove wallet failed: Wallet ${address} not found for user ${id}`);
    logger.info(`   User has ${user.wallets.length} wallets:`, user.wallets.map(w => w.address));
    return { success: false, message: 'Wallet not found in your watch list.' };
  }
  
  const removedWallet = user.wallets[index];
  logger.info(`🗑️ Removing wallet ${removedWallet.address} (label: ${removedWallet.label || 'none'}) for user ${id}`);
  
  user.wallets.splice(index, 1);
  storage.stats.totalWallets--;
  
  // Save and immediately flush to disk
  saveStorage(storage);
  forceFlushStorage();
  
  logger.info(`✅ Wallet removed. User now has ${user.wallets.length} wallets`);
  
  return { success: true, message: '✅ Wallet removed successfully!' };
}

// Get user's wallets
export function getUserWallets(telegramId: number): WatchedWallet[] {
  const storage = loadStorage();
  const id = telegramId.toString();
  return storage.users[id]?.wallets || [];
}

// Update user settings
export function updateUserSettings(telegramId: number, settings: Partial<NotificationSettings>): void {
  const storage = loadStorage();
  const id = telegramId.toString();
  
  if (storage.users[id]) {
    storage.users[id].settings = { ...storage.users[id].settings, ...settings };
    saveStorage(storage);
  }
}

// Get user settings
export function getUserSettings(telegramId: number): NotificationSettings {
  const storage = loadStorage();
  const id = telegramId.toString();
  return storage.users[id]?.settings || { ...defaultNotificationSettings };
}

// Update wallet data (balance, tx count)
export function updateWalletData(telegramId: number, address: string, data: Partial<WatchedWallet>): void {
  const storage = loadStorage();
  const id = telegramId.toString();
  const user = storage.users[id];
  
  if (user) {
    const wallet = user.wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (wallet) {
      Object.assign(wallet, data);
      saveStorage(storage);
    }
  }
}

// Get all users with their wallets (for the watcher service)
export function getAllUsersWithWallets(): { telegramId: number; wallets: WatchedWallet[]; settings: NotificationSettings }[] {
  const storage = loadStorage();
  
  return Object.entries(storage.users)
    .filter(([_, user]) => user.isActive && user.wallets.length > 0)
    .map(([_, user]) => ({
      telegramId: user.visibleTelegramId,
      wallets: user.wallets,
      settings: user.settings,
    }));
}

// Increment notification counter
export function incrementNotificationCount(): void {
  const storage = loadStorage();
  storage.stats.totalNotificationsSent++;
  saveStorage(storage);
}

// Get stats
export function getStats(): StorageData['stats'] {
  const storage = loadStorage();
  return storage.stats;
}

// ==================== TOKEN TRACKING ====================

// Add token to a wallet's tracking list
export function addTokenToWallet(
  telegramId: number, 
  walletAddress: string, 
  token: TrackedToken
): { success: boolean; message: string } {
  const storage = loadStorage();
  const id = telegramId.toString();
  const user = storage.users[id];
  
  if (!user) {
    return { success: false, message: 'User not found.' };
  }
  
  const wallet = user.wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
  if (!wallet) {
    return { success: false, message: 'Wallet not found in your watch list.' };
  }
  
  if (!wallet.trackedTokens) {
    wallet.trackedTokens = [];
  }
  
  // Check if token already tracked
  const existing = wallet.trackedTokens.find(
    t => t.contractAddress.toLowerCase() === token.contractAddress.toLowerCase()
  );
  if (existing) {
    return { success: false, message: `${token.symbol} is already being tracked for this wallet.` };
  }
  
  // Limit tokens per wallet
  if (wallet.trackedTokens.length >= 10) {
    return { success: false, message: 'Maximum 10 tokens per wallet allowed.' };
  }
  
  wallet.trackedTokens.push(token);
  saveStorage(storage);
  
  return { success: true, message: `${token.symbol} token added to tracking!` };
}

// Remove token from a wallet's tracking list
export function removeTokenFromWallet(
  telegramId: number, 
  walletAddress: string, 
  tokenAddress: string
): { success: boolean; message: string } {
  const storage = loadStorage();
  const id = telegramId.toString();
  const user = storage.users[id];
  
  if (!user) {
    return { success: false, message: 'User not found.' };
  }
  
  const wallet = user.wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
  if (!wallet || !wallet.trackedTokens) {
    return { success: false, message: 'Wallet or tokens not found.' };
  }
  
  const index = wallet.trackedTokens.findIndex(
    t => t.contractAddress.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (index === -1) {
    return { success: false, message: 'Token not found in tracking list.' };
  }
  
  const removed = wallet.trackedTokens.splice(index, 1)[0];
  saveStorage(storage);
  
  return { success: true, message: `${removed.symbol} removed from tracking.` };
}

// Get tokens tracked for a wallet
export function getWalletTokens(telegramId: number, walletAddress: string): TrackedToken[] {
  const storage = loadStorage();
  const id = telegramId.toString();
  const user = storage.users[id];
  
  if (!user) return [];
  
  const wallet = user.wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
  return wallet?.trackedTokens || [];
}

// Update token balance
export function updateTokenBalance(
  telegramId: number, 
  walletAddress: string, 
  tokenAddress: string, 
  balance: string
): void {
  const storage = loadStorage();
  const id = telegramId.toString();
  const user = storage.users[id];
  
  if (!user) return;
  
  const wallet = user.wallets.find(w => w.address.toLowerCase() === walletAddress.toLowerCase());
  if (!wallet || !wallet.trackedTokens) return;
  
  const token = wallet.trackedTokens.find(
    t => t.contractAddress.toLowerCase() === tokenAddress.toLowerCase()
  );
  if (token) {
    token.lastBalance = balance;
    saveStorage(storage);
  }
}
