import { useCallback, useRef } from 'react';
import { ItemCategory } from '../models';
import {
  detectWithKeywords,
  detectWithAi,
  isAutoDetectable,
} from '../services/categoryDetectionCoordinator';

const KEYWORD_DEBOUNCE_MS = 280;
const AI_DEBOUNCE_MS = 400;
const MIN_AI_NAME_LENGTH = 2;

/**
 * Encapsulates the two-stage (keyword → AI) category auto-detection with
 * debounce, stale-result guards, and manual-override semantics.
 *
 * Mirrors Android `AddItemViewModel.scheduleNameDerivatives` +
 * `scheduleAiCategoryDetection` + `categoryManuallyChanged` flag.
 */
export function useCategoryAutoDetection(opts: {
  setCategory: (updater: (prev: ItemCategory) => ItemCategory) => void;
  setAutoDetected: (v: boolean) => void;
}) {
  const { setCategory, setAutoDetected } = opts;

  const categoryManuallyChangedRef = useRef(false);
  const keywordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Monotonically increasing counter to discard stale AI results. */
  const aiGenerationRef = useRef(0);

  /** Call when the user manually selects a category chip. */
  const onManualCategorySelect = useCallback(
    (category: ItemCategory) => {
      categoryManuallyChangedRef.current = true;
      if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      aiGenerationRef.current++;
      setCategory(() => category);
      setAutoDetected(false);
    },
    [setCategory, setAutoDetected],
  );

  /** Call when an autocomplete suggestion or voice input sets the category. */
  const onSuggestionCategory = useCallback(
    (category: ItemCategory) => {
      categoryManuallyChangedRef.current = false;
      if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      aiGenerationRef.current++;
      setCategory(() => category);
      setAutoDetected(false);
    },
    [setCategory, setAutoDetected],
  );

  /** Call on every name change to schedule keyword + AI detection. */
  const scheduleDetection = useCallback(
    (name: string) => {
      if (keywordTimerRef.current) clearTimeout(keywordTimerRef.current);
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      aiGenerationRef.current++;

      if (categoryManuallyChangedRef.current) return;

      keywordTimerRef.current = setTimeout(() => {
        const trimmed = name.trim();
        if (trimmed.length < MIN_AI_NAME_LENGTH) {
          setAutoDetected(false);
          return;
        }

        const kwResult = detectWithKeywords(trimmed);
        if (kwResult) {
          setCategory((prev) => {
            if (kwResult !== prev) {
              setAutoDetected(isAutoDetectable(kwResult));
              return kwResult;
            }
            setAutoDetected(isAutoDetectable(prev));
            return prev;
          });
          return;
        }

        // Keywords abstain — schedule AI after an additional delay.
        setAutoDetected(false);
        const gen = ++aiGenerationRef.current;

        aiTimerRef.current = setTimeout(() => {
          if (categoryManuallyChangedRef.current) return;

          void (async () => {
            const aiResult = await detectWithAi(trimmed);
            // Discard if another detection cycle started or user picked manually.
            if (aiGenerationRef.current !== gen) return;
            if (categoryManuallyChangedRef.current) return;

            if (aiResult) {
              setCategory(() => aiResult);
              setAutoDetected(isAutoDetectable(aiResult));
            }
          })();
        }, AI_DEBOUNCE_MS);
      }, KEYWORD_DEBOUNCE_MS);
    },
    [setCategory, setAutoDetected],
  );

  /** Reset the manual-override flag (e.g. when switching items). */
  const resetManualOverride = useCallback(() => {
    categoryManuallyChangedRef.current = false;
  }, []);

  return {
    scheduleDetection,
    onManualCategorySelect,
    onSuggestionCategory,
    resetManualOverride,
    categoryManuallyChangedRef,
  };
}
