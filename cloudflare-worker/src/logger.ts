// Simple logger for Cloudflare Workers
export const createLogger = (module: string) => ({
  info: (...args: any[]) => console.log(`[${module}]`, ...args),
  warn: (...args: any[]) => console.warn(`[${module}]`, ...args),
  error: (...args: any[]) => console.error(`[${module}]`, ...args),
  debug: (...args: any[]) => console.log(`[${module} DEBUG]`, ...args),
});
