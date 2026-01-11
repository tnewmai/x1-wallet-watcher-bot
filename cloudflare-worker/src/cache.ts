// Simple cache stubs for Cloudflare Workers
export const getCachedBalance = async (address: string) => null;
export const setCachedBalance = async (address: string, balance: number) => {};
export const getCachedTokenBalance = async (wallet: string, mint: string) => null;
export const setCachedTokenBalance = async (wallet: string, mint: string, balance: number) => {};
