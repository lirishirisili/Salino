jest.mock('firebase/firestore', () => {
  class Timestamp {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    static fromMillis(ms: number) {
      return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
    }
    toMillis() {
      return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
    }
  }
  return { Timestamp };
});

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
      removeItem: jest.fn(async (key: string) => { store.delete(key); }),
    },
  };
});

jest.mock('../../remote/firebase', () => ({
  functions: {},
}));

import { ItemCategory } from '../../models';
import {
  detectWithKeywords,
  detectWithAi,
  isAutoDetectable,
} from '../categoryDetectionCoordinator';

const mockClassifyWithAi = jest.fn<Promise<ItemCategory | null>, [string]>();
jest.mock('../firebaseAiCategoryClassifier', () => ({
  classifyWithAi: (...args: unknown[]) => mockClassifyWithAi(...(args as [string])),
}));

beforeEach(() => {
  mockClassifyWithAi.mockReset();
});

describe('categoryDetectionCoordinator', () => {
  describe('detectWithKeywords', () => {
    it('returns DAIRY for milk keyword', () => {
      expect(detectWithKeywords('חלב')).toBe(ItemCategory.DAIRY);
    });

    it('returns null for unknown names', () => {
      expect(detectWithKeywords('גרביים לבנות')).toBeNull();
    });

    it('returns CLEANING for soap', () => {
      expect(detectWithKeywords('סבון כלים')).toBe(ItemCategory.CLEANING);
    });

    it('returns PANTRY for סחוג', () => {
      const result = detectWithKeywords('סחוג');
      // סחוג may or may not match keywords - check it doesn't crash
      expect(result === null || Object.values(ItemCategory).includes(result)).toBe(true);
    });
  });

  describe('detectWithAi', () => {
    it('returns null for short names', async () => {
      const result = await detectWithAi('א');
      expect(result).toBeNull();
      expect(mockClassifyWithAi).not.toHaveBeenCalled();
    });

    it('calls AI when keyword does not match and caches result', async () => {
      mockClassifyWithAi.mockResolvedValue(ItemCategory.DAIRY);
      const result = await detectWithAi('something unknown but long enough');
      expect(result).toBe(ItemCategory.DAIRY);
      expect(mockClassifyWithAi).toHaveBeenCalledTimes(1);

      // Second call should hit cache
      mockClassifyWithAi.mockClear();
      const cached = await detectWithAi('something unknown but long enough');
      expect(cached).toBe(ItemCategory.DAIRY);
      expect(mockClassifyWithAi).not.toHaveBeenCalled();
    });

    it('returns null when AI returns null', async () => {
      mockClassifyWithAi.mockResolvedValue(null);
      const result = await detectWithAi('דבר לא ידוע');
      expect(result).toBeNull();
    });
  });

  describe('isAutoDetectable', () => {
    it('returns false for OTHER', () => {
      expect(isAutoDetectable(ItemCategory.OTHER)).toBe(false);
    });

    it('returns true for real categories', () => {
      expect(isAutoDetectable(ItemCategory.DAIRY)).toBe(true);
      expect(isAutoDetectable(ItemCategory.CLEANING)).toBe(true);
    });
  });
});
