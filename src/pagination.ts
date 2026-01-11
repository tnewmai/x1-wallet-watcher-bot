// Pagination utilities for large lists
import { InlineKeyboard } from 'grammy';

export interface PaginationOptions {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  callbackPrefix: string; // e.g., "wallet_page", "token_page"
}

/**
 * Create pagination keyboard buttons
 */
export function createPaginationKeyboard(options: PaginationOptions): InlineKeyboard {
  const { currentPage, totalPages, callbackPrefix } = options;
  const keyboard = new InlineKeyboard();

  if (totalPages <= 1) {
    return keyboard; // No pagination needed
  }

  const buttons: Array<{ text: string; data: string }> = [];

  // Previous page button
  if (currentPage > 0) {
    buttons.push({
      text: '◀️ Previous',
      data: `${callbackPrefix}_${currentPage - 1}`,
    });
  }

  // Page indicator
  buttons.push({
    text: `${currentPage + 1}/${totalPages}`,
    data: 'page_info', // No-op callback
  });

  // Next page button
  if (currentPage < totalPages - 1) {
    buttons.push({
      text: 'Next ▶️',
      data: `${callbackPrefix}_${currentPage + 1}`,
    });
  }

  // Add buttons to keyboard
  if (buttons.length > 0) {
    buttons.forEach((btn, index) => {
      keyboard.text(btn.text, btn.data);
      // Add row break after every 3 buttons
      if ((index + 1) % 3 === 0) {
        keyboard.row();
      }
    });
  }

  return keyboard;
}

/**
 * Paginate an array
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  itemsPerPage: number
): { items: T[]; currentPage: number; totalPages: number } {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;

  return {
    items: items.slice(start, end),
    currentPage,
    totalPages,
  };
}

/**
 * Extract page number from callback data
 */
export function extractPageNumber(callbackData: string, prefix: string): number {
  const parts = callbackData.replace(prefix + '_', '');
  const page = parseInt(parts, 10);
  return isNaN(page) ? 0 : page;
}
