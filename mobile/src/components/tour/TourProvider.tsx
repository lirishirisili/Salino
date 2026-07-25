import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useSegments } from 'expo-router';

import { useAuthStore, useHouseholdStore, useShoppingStore } from '../../hooks';
import {
  TOUR_ENABLED,
  hasCompletedTour,
  markTourCompleted,
  stepsForUser,
  useTourStore,
} from '../../features/tour';
import { TOUR_ROUTE_SWITCH_MS } from '../../features/tour/config';
import { scrollTourAnchorIntoView } from '../../features/tour/tourScroll';
import { resolveSheetPlacement } from '../../features/tour/tourSheetPlacement';
import { waitForTourAnchor } from '../../features/tour/tourAnchors';
import type { TourRoute, TourStep } from '../../features/tour/types';

const ROUTE_PATHS: Record<TourRoute, `/(main)/${TourRoute}`> = {
  'shopping-list': '/(main)/shopping-list',
  settings: '/(main)/settings',
  history: '/(main)/history',
  activity: '/(main)/activity',
};

function tourRouteFromSegments(segments: string[]): TourRoute | null {
  const leaf = segments[segments.length - 1];
  if (leaf === 'shopping-list') return 'shopping-list';
  if (leaf === 'settings') return 'settings';
  if (leaf === 'history') return 'history';
  if (leaf === 'activity') return 'activity';
  return null;
}

/** Navigate only when the tour needs a different screen — avoids stack push + slide on same route. */
function goRouteIfNeeded(
  router: ReturnType<typeof useRouter>,
  target: TourRoute,
  current: TourRoute | null,
) {
  // Segments not settled yet — wait rather than navigate blindly (can duplicate routes).
  if (current === null) return;
  if (current === target) return;
  router.navigate(ROUTE_PATHS[target]);
}

async function waitForTourRoute(
  target: TourRoute,
  getCurrent: () => TourRoute | null,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getCurrent() === target) return;
    await sleep(50);
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Tour logic controller — lives inside the main stack for router access. */
export function TourController() {
  const { t } = useTranslation();
  const router = useRouter();
  const segments = useSegments();

  const uid = useAuthStore((s) => s.user?.uid);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  // Wait for the first Firestore snapshot before auto-starting — empty local
  // cache must not look "ready" or existing users briefly see tour demo data.
  const hasReceivedRemoteSnapshot = useShoppingStore((s) => s.hasReceivedRemoteSnapshot);
  const shoppingListReady = hasReceivedRemoteSnapshot;

  const active = useTourStore((s) => s.active);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const replayRequested = useTourStore((s) => s.replayRequested);
  const bootstrapStatus = useTourStore((s) => s.bootstrapStatus);
  const start = useTourStore((s) => s.start);
  const stop = useTourStore((s) => s.stop);
  const clearReplayRequest = useTourStore((s) => s.clearReplayRequest);
  const next = useTourStore((s) => s.next);
  const setActiveAnchorId = useTourStore((s) => s.setActiveAnchorId);
  const showOverlay = useTourStore((s) => s.showOverlay);
  const hideOverlay = useTourStore((s) => s.hideOverlay);
  const markBootstrapDone = useTourStore((s) => s.markBootstrapDone);
  const resetBootstrap = useTourStore((s) => s.resetBootstrap);

  const steps = useMemo(() => stepsForUser(), []);
  const currentStep: TourStep | null = steps[stepIndex] ?? null;

  const [, setReady] = useState(false);
  const autoStartChecked = useRef(false);
  const autoStartPending = useRef(false);
  const autoStartRequestId = useRef(0);
  const lastAutoStartHouseholdId = useRef<string | null>(null);
  const lastPreparedStepId = useRef<string | null>(null);

  const isMainStack = segments[0] === '(main)';
  const currentTourRoute = useMemo(() => tourRouteFromSegments(segments), [segments]);
  const currentTourRouteRef = useRef(currentTourRoute);
  currentTourRouteRef.current = currentTourRoute;
  const isOnShoppingList =
    isMainStack &&
    (segments.length === 1 || segments[segments.length - 1] === 'shopping-list');
  const canRun =
    TOUR_ENABLED &&
    active &&
    isMainStack &&
    isSignedIn &&
    !!activeHouseholdId &&
    shoppingListReady &&
    currentStep !== null;

  useLayoutEffect(() => {
    setReady(false);
    hideOverlay();
    setActiveAnchorId(null);
    lastPreparedStepId.current = null;
  }, [stepIndex, currentStep?.id, hideOverlay, setActiveAnchorId]);

  const finishTour = useCallback(
    async (completed: boolean) => {
      stop();
      setReady(false);
      lastPreparedStepId.current = null;
      markBootstrapDone();
      if (completed && uid) {
        await markTourCompleted(uid);
      }
    },
    [stop, uid, markBootstrapDone],
  );

  const handleSkip = useCallback(() => {
    void finishTour(true);
  }, [finishTour]);

  const handleNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      void finishTour(true);
      return;
    }
    next();
  }, [stepIndex, steps.length, next, finishTour]);

  // Tour disabled → notifications may proceed immediately.
  useEffect(() => {
    if (!TOUR_ENABLED && bootstrapStatus !== 'done') {
      markBootstrapDone();
    }
  }, [bootstrapStatus, markBootstrapDone]);

  useEffect(() => {
    if (activeHouseholdId && activeHouseholdId !== lastAutoStartHouseholdId.current) {
      autoStartChecked.current = false;
      autoStartPending.current = false;
      lastAutoStartHouseholdId.current = activeHouseholdId;
      if (!active) {
        resetBootstrap();
      }
    }
  }, [activeHouseholdId, active, resetBootstrap]);

  useEffect(() => {
    if (!TOUR_ENABLED || autoStartChecked.current || autoStartPending.current) return;
    if (!isSignedIn || !activeHouseholdId || !shoppingListReady || !isOnShoppingList || !uid) return;

    const requestId = ++autoStartRequestId.current;
    autoStartPending.current = true;

    void hasCompletedTour(uid).then((done) => {
      if (requestId !== autoStartRequestId.current) return;
      autoStartPending.current = false;
      if (autoStartChecked.current) return;
      autoStartChecked.current = true;
      if (done) {
        markBootstrapDone();
        return;
      }
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => start());
      });
    });

    return () => {
      // Invalidate in-flight check and clear pending so a remount can retry.
      if (requestId === autoStartRequestId.current) {
        autoStartRequestId.current += 1;
        autoStartPending.current = false;
      }
    };
  }, [
    isSignedIn,
    activeHouseholdId,
    shoppingListReady,
    isOnShoppingList,
    uid,
    start,
    markBootstrapDone,
  ]);

  useEffect(() => {
    if (!replayRequested || !isSignedIn || !activeHouseholdId || !shoppingListReady) return;

    clearReplayRequest();
    goRouteIfNeeded(router, 'shopping-list', currentTourRouteRef.current);
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => start());
    });
  }, [
    replayRequested,
    isSignedIn,
    activeHouseholdId,
    shoppingListReady,
    router,
    start,
    clearReplayRequest,
  ]);

  useEffect(() => {
    if (!canRun || !currentStep) {
      hideOverlay();
      setActiveAnchorId(null);
      setReady(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const needsPrepare = lastPreparedStepId.current !== currentStep.id;
      if (needsPrepare) {
        if (currentStep.route) {
          goRouteIfNeeded(router, currentStep.route, currentTourRouteRef.current);
          if (currentTourRouteRef.current !== currentStep.route) {
            await waitForTourRoute(currentStep.route, () => currentTourRouteRef.current);
            await sleep(TOUR_ROUTE_SWITCH_MS);
          }
        }

        if (currentStep.anchorId) {
          await waitForTourAnchor(currentStep.anchorId);
        }
      }

      if (currentStep.scrollIntoView && currentStep.anchorId) {
        await scrollTourAnchorIntoView(currentStep.anchorId);
      }

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      await sleep(80);
      if (cancelled) return;

      setActiveAnchorId(currentStep.anchorId ?? null);

      await sleep(60);
      if (cancelled) return;

      const sheetPlacement = await resolveSheetPlacement(currentStep.anchorId);

      const stepLabel = t('tour.stepOf', {
        current: stepIndex + 1,
        total: steps.length,
      });
      showOverlay({
        title: t(currentStep.titleKey),
        body: t(currentStep.bodyKey),
        stepLabel,
        isLast: stepIndex >= steps.length - 1,
        sheetPlacement,
      });
      lastPreparedStepId.current = currentStep.id;
      setReady(true);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    canRun,
    currentStep,
    stepIndex,
    steps.length,
    router,
    t,
    showOverlay,
    hideOverlay,
    setActiveAnchorId,
  ]);

  useEffect(() => {
    if (active && stepIndex >= steps.length) {
      void finishTour(true);
    }
  }, [active, stepIndex, steps.length, finishTour]);

  useEffect(() => {
    tourHandlers.onNext = handleNext;
    tourHandlers.onSkip = handleSkip;
  }, [handleNext, handleSkip]);

  return null;
}

/** Exposed handlers for the overlay to call (avoids needing navigation in overlay). */
export const tourHandlers = {
  onNext: () => {},
  onSkip: () => {},
};
