/**
 * Normalize item name for duplicate detection and search.
 * Lowercases, trims whitespace, collapses repeated spaces, strips simple punctuation,
 * and removes Hebrew niqqud so duplicate detection is more forgiving.
 */
export function normalizeItemName(name: string): string {
  if (!name || !name.trim()) return '';

  // Remove combining marks (Hebrew niqqud, accents, etc.)
  const withoutDiacritics = name.normalize('NFD').replace(/[\u0300-\u036f\u0591-\u05C7]/g, '');

  return withoutDiacritics
    .toLowerCase()
    .replace(/[׳'`".,!?()\[\]{}:;_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTimestamp(date: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

export function parseQuantity(value: string): number | null {
  const parsed = parseFloat(value.replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

export function formatQuantity(quantity: number): string {
  if (quantity === Math.floor(quantity)) {
    return Math.floor(quantity).toString();
  }
  return quantity.toString();
}

export function formatRelativeTime(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(date);
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
