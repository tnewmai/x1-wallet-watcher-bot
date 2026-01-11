/**
 * Ultra-Minimal Logger (replaces Winston - 400 lines → 40 lines)
 */
import { config } from './config';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[config.logLevel] || 1;

function log(level: keyof typeof LOG_LEVELS, module: string, message: string, data?: any) {
  if (LOG_LEVELS[level] < currentLevel) return;
  
  const timestamp = new Date().toISOString();
  const emoji = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' }[level];
  
  console.log(`${timestamp} ${emoji} [${module}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: any) => log('debug', module, msg, data),
    info: (msg: string, data?: any) => log('info', module, msg, data),
    warn: (msg: string, data?: any) => log('warn', module, msg, data),
    error: (msg: string, error?: Error | any) => {
      log('error', module, msg);
      if (error) {
        console.error(error);
      }
    },
  };
}
