/**
 * Normalizes item name for comparison and duplicate detection.
 * Mirrors Android's ItemTextNormalizer logic.
 */
export function normalizeItemName(name: string): string {
  let normalized = name.toLowerCase().trim();
  // Remove Hebrew niqqud (diacritics) U+0591-U+05C7
  normalized = normalized.replace(/[\u0591-\u05C7]/g, '');
  // Replace geresh/apostrophe with space
  normalized = normalized.replace(/[׳'`]/g, ' ');
  // Remove punctuation except spaces
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, '');
  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

/**
 * Generate a UUID-like string
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Format a timestamp for display as relative time
 */
export function formatRelativeTime(millis: number): string {
  const now = Date.now();
  const diff = now - millis;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(millis).toLocaleDateString();
}
