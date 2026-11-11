const mockGetIdToken = jest.fn(async () => 'id-token');
let mockUser: { getIdToken: typeof mockGetIdToken } | null = { getIdToken: mockGetIdToken };

jest.mock('../../remote/firebase', () => ({
  get auth() {
    return { currentUser: mockUser };
  },
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { aiProxyUrl: 'https://haserli-ai.example.workers.dev/' } } },
}));

import { ItemCategory, ItemUnit } from '../../models';
import { parseListLocally, parseListWithAi, sanitizeAiItems } from '../aiListParser';

const fetchMock = jest.fn();
(global as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;

function respond(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  mockUser = { getIdToken: mockGetIdToken };
});

describe('sanitizeAiItems', () => {
  it('keeps valid items and repairs bad fields', () => {
    const items = sanitizeAiItems([
      { name: ' חלב ', quantity: 2, unit: 'LITERS', category: 'DAIRY', note: '3%' },
      { name: 'x', quantity: -1, unit: 'BOX', category: 'NOPE', note: 5 },
      { name: '', quantity: 1 },
      'junk',
    ]);
    expect(items).toEqual([
      { name: 'חלב', quantity: 2, unit: ItemUnit.LITERS, category: ItemCategory.DAIRY, note: '3%' },
      { name: 'x', quantity: 1, unit: null, category: ItemCategory.OTHER, note: '' },
    ]);
  });

  it('is empty for a non-array', () => {
    expect(sanitizeAiItems({ items: [] })).toEqual([]);
  });
});

describe('parseListWithAi', () => {
  it('uses the worker answer and sends the ID token', async () => {
    fetchMock.mockResolvedValue(
      respond(200, { items: [{ name: 'לחם', quantity: 1, unit: null, category: 'BAKERY', note: '' }] })
    );
    const result = await parseListWithAi('לחם', { locale: 'he' });
    expect(result.source).toBe('ai');
    expect(result.items[0].category).toBe(ItemCategory.BAKERY);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://haserli-ai.example.workers.dev/v1/parse-list');
    expect(init.headers.Authorization).toBe('Bearer id-token');
    expect(JSON.parse(init.body)).toEqual({ text: 'לחם', locale: 'he' });
  });

  it('falls back to the local parser when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = await parseListWithAi('- 2 חלב\n- לחם', { locale: 'he' });
    expect(result.source).toBe('local');
    expect(result.notAList).toBeUndefined();
    expect(result.items.map((i) => [i.name, i.quantity])).toEqual([
      ['חלב', 2],
      ['לחם', 1],
    ]);
  });

  it('falls back on a 503 and flags a 422 "not a list"', async () => {
    fetchMock.mockResolvedValueOnce(respond(503, { error: 'all_providers_failed' }));
    expect((await parseListWithAi('חלב', { locale: 'he' })).source).toBe('local');

    fetchMock.mockResolvedValueOnce(respond(422, { error: 'not_a_list' }));
    const result = await parseListWithAi('מה שלומך', { locale: 'he' });
    expect(result.source).toBe('local');
    expect(result.notAList).toBe(true);
  });

  it('does not call the worker when signed out', async () => {
    mockUser = null;
    const result = await parseListWithAi('חלב', { locale: 'he' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.source).toBe('local');
  });
});

describe('parseListLocally', () => {
  it('gives every item a category', () => {
    for (const item of parseListLocally('חלב, עגבניות, בלה בלה')) {
      expect(Object.values(ItemCategory)).toContain(item.category);
    }
  });
});
