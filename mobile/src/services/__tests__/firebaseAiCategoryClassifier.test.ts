const mockCallable = jest.fn();

jest.mock('firebase/firestore', () => ({
  Timestamp: { fromMillis: jest.fn(), now: jest.fn() },
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('../../remote/firebase', () => ({
  functions: {},
}));

import { classifyWithAi } from '../firebaseAiCategoryClassifier';
import { ItemCategory } from '../../models';

beforeEach(() => {
  mockCallable.mockReset();
});

describe('classifyWithAi', () => {
  it('returns null for short names', async () => {
    expect(await classifyWithAi('a')).toBeNull();
    expect(mockCallable).not.toHaveBeenCalled();
  });

  it('maps valid category from response', async () => {
    mockCallable.mockResolvedValue({ data: { category: 'DAIRY' } });
    expect(await classifyWithAi('חלב טרי')).toBe(ItemCategory.DAIRY);
  });

  it('returns null when category is null in response', async () => {
    mockCallable.mockResolvedValue({ data: { category: null } });
    expect(await classifyWithAi('something')).toBeNull();
  });

  it('returns null on network error', async () => {
    mockCallable.mockRejectedValue(new Error('network'));
    expect(await classifyWithAi('something')).toBeNull();
  });

  it('returns null for invalid category string', async () => {
    mockCallable.mockResolvedValue({ data: { category: 'NOT_A_CATEGORY' } });
    expect(await classifyWithAi('something')).toBeNull();
  });

  it('handles case insensitive category mapping', async () => {
    mockCallable.mockResolvedValue({ data: { category: 'dairy' } });
    expect(await classifyWithAi('חלב טרי')).toBe(ItemCategory.DAIRY);
  });
});
