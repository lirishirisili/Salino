import Constants from 'expo-constants';
import { ItemCategory, ItemUnit } from '../models';
import { auth } from '../remote/firebase';
import { detectCategory } from './categoryDetector';
import { parseQuickAddText } from './quickAddParser';

/**
 * Turns pasted / shared text into shopping items with the free AI worker
 * (workers/haserli-ai, POST /v1/parse-list), falling back to the on-device
 * parser when the worker is unreachable, slow or says "not a list".
 */

export interface ListDraftItem {
  name: string;
  quantity: number;
  unit: ItemUnit | null;
  category: ItemCategory;
  note: string;
}

export type ListParseSource = 'ai' | 'local';

export interface ListParseResult {
  items: ListDraftItem[];
  source: ListParseSource;
  /** Set when the AI said the text has nothing to buy (vs. an error / offline). */
  notAList?: boolean;
}

export const MAX_PASTE_CHARS = 4_000;
const MAX_ITEMS = 100;
const REQUEST_TIMEOUT_MS = 20_000;

const CATEGORY_VALUES = new Set<string>(Object.values(ItemCategory));
const UNIT_VALUES = new Set<string>(Object.values(ItemUnit));

function getAiProxyUrl(): string | null {
  const url = (Constants.expoConfig?.extra as { aiProxyUrl?: unknown } | undefined)?.aiProxyUrl;
  return typeof url === 'string' && url.startsWith('https://') ? url.replace(/\/+$/, '') : null;
}

/** Local parse: same splitting / quantities as quick add, categories from keywords. */
export function parseListLocally(text: string): ListDraftItem[] {
  return parseQuickAddText(text.slice(0, MAX_PASTE_CHARS))
    .slice(0, MAX_ITEMS)
    .map((p) => ({
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      category: detectCategory(p.name) ?? ItemCategory.OTHER,
      note: '',
    }));
}

/** Never trust the network shape: keep only valid, bounded fields. */
export function sanitizeAiItems(raw: unknown): ListDraftItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ListDraftItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!name) continue;
    const quantity =
      typeof e.quantity === 'number' && Number.isFinite(e.quantity) && e.quantity > 0
        ? Math.min(e.quantity, 999)
        : 1;
    const unit = typeof e.unit === 'string' && UNIT_VALUES.has(e.unit) ? (e.unit as ItemUnit) : null;
    const category =
      typeof e.category === 'string' && CATEGORY_VALUES.has(e.category)
        ? (e.category as ItemCategory)
        : detectCategory(name) ?? ItemCategory.OTHER;
    const note = typeof e.note === 'string' ? e.note.trim().slice(0, 120) : '';
    out.push({ name, quantity, unit, category, note });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

export type AiOutcome =
  | { kind: 'items'; items: ListDraftItem[] }
  | { kind: 'not_a_list' }
  | { kind: 'quota' }
  | { kind: 'failed' };

async function callWorker(text: string, locale: string, signal?: AbortSignal): Promise<AiOutcome> {
  return postToWorker('/v1/parse-list', { text: text.slice(0, MAX_PASTE_CHARS), locale }, signal);
}

async function postToWorker(
  path: string,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<AiOutcome> {
  const baseUrl = getAiProxyUrl();
  const user = auth.currentUser;
  if (!baseUrl || !user) return { kind: 'failed' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.status === 422) return { kind: 'not_a_list' };
    if (response.status === 429) {
      const data = (await response.json().catch(() => ({}))) as { error?: unknown };
      if (data.error === 'daily_quota') return { kind: 'quota' };
    }
    if (!response.ok) return { kind: 'failed' };
    const data = (await response.json()) as { items?: unknown };
    const items = sanitizeAiItems(data.items);
    return items.length > 0 ? { kind: 'items', items } : { kind: 'not_a_list' };
  } catch {
    return { kind: 'failed' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * AI first; on any failure the local parse. "Not a list" from the AI still
 * returns the local parse (the user can delete rows), flagged so the UI can say so.
 */
export async function parseListWithAi(
  text: string,
  options: { locale: string; signal?: AbortSignal }
): Promise<ListParseResult> {
  const outcome = await callWorker(text, options.locale, options.signal);
  if (outcome.kind === 'items') return { items: outcome.items, source: 'ai' };
  return {
    items: parseListLocally(text),
    source: 'local',
    ...(outcome.kind === 'not_a_list' ? { notAList: true } : {}),
  };
}

/** Vision calls take longer (upload + reading handwriting). */
const IMAGE_TIMEOUT_MS = 30_000;
export const MAX_SMART_REQUEST_CHARS = 300;

/** Photo / screenshot → items (AI only; there is no on-device fallback for images). */
export function parseImageWithAi(
  imageBase64: string,
  mimeType: string,
  options: { locale: string; signal?: AbortSignal },
): Promise<AiOutcome> {
  return postToWorker(
    '/v1/parse-image',
    { image: imageBase64, mimeType, locale: options.locale },
    options.signal,
    IMAGE_TIMEOUT_MS,
  );
}

/** "Friday dinner for 8" → items. */
export function generateListWithAi(
  request: string,
  options: { locale: string; people?: number; signal?: AbortSignal },
): Promise<AiOutcome> {
  return postToWorker(
    '/v1/generate-list',
    {
      request: request.trim().slice(0, MAX_SMART_REQUEST_CHARS),
      locale: options.locale,
      ...(options.people ? { people: options.people } : {}),
    },
    options.signal,
  );
}
