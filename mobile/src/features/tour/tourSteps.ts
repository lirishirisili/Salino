import { Platform } from 'react-native';
import type { TourMode, TourStep } from './types';

/** Sharing a WhatsApp message into the app works on Android only (no iOS share extension yet). */
const PASTE_BODY_KEY =
  Platform.OS === 'android' ? 'tour.whatsNew.paste.bodyAndroid' : 'tour.whatsNew.paste.body';

/** Full guided tour — shopping list, settings, activity, and history. */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'hero',
    anchorId: 'list.hero',
    route: 'shopping-list',
    titleKey: 'tour.steps.hero.title',
    bodyKey: 'tour.steps.hero.body',
  },
  {
    id: 'quickAdd',
    anchorId: 'list.quickAdd',
    route: 'shopping-list',
    titleKey: 'tour.steps.quickAdd.title',
    bodyKey: 'tour.steps.quickAdd.body',
  },
  {
    id: 'filters',
    anchorId: 'list.filters',
    route: 'shopping-list',
    titleKey: 'tour.steps.filters.title',
    bodyKey: 'tour.steps.filters.body',
  },
  {
    id: 'addFab',
    anchorId: 'list.addFab',
    route: 'shopping-list',
    titleKey: 'tour.steps.addFab.title',
    bodyKey: 'tour.steps.addFab.body',
  },
  {
    id: 'supermarketFab',
    anchorId: 'list.supermarketFab',
    route: 'shopping-list',
    titleKey: 'tour.steps.supermarketFab.title',
    bodyKey: 'tour.steps.supermarketFab.body',
  },
  {
    id: 'homes',
    anchorId: 'list.homes',
    route: 'shopping-list',
    titleKey: 'tour.steps.homes.title',
    bodyKey: 'tour.steps.homes.body',
  },
  {
    id: 'settings',
    anchorId: 'list.settings',
    route: 'shopping-list',
    titleKey: 'tour.steps.settings.title',
    bodyKey: 'tour.steps.settings.body',
  },
  {
    id: 'invite',
    anchorId: 'settings.invite',
    route: 'settings',
    scrollIntoView: true,
    titleKey: 'tour.steps.invite.title',
    bodyKey: 'tour.steps.invite.body',
  },
  {
    id: 'activity',
    anchorId: 'list.activity',
    route: 'shopping-list',
    titleKey: 'tour.steps.activity.title',
    bodyKey: 'tour.steps.activity.body',
  },
  {
    id: 'history',
    anchorId: 'history.title',
    route: 'history',
    titleKey: 'tour.steps.history.title',
    bodyKey: 'tour.steps.history.body',
  },
  {
    id: 'done',
    route: 'shopping-list',
    titleKey: 'tour.steps.done.title',
    bodyKey: 'tour.steps.done.body',
  },
];

/**
 * Shown once to users who already finished the full tour before this release.
 * Bump WHATS_NEW_ID (config.ts) and replace these steps for the next feature.
 */
export const WHATS_NEW_STEPS: TourStep[] = [
  {
    id: 'whatsNew.paste',
    anchorId: 'list.paste',
    route: 'shopping-list',
    titleKey: 'tour.whatsNew.paste.title',
    bodyKey: PASTE_BODY_KEY,
  },
  {
    id: 'whatsNew.quickAdd',
    anchorId: 'list.quickAdd',
    route: 'shopping-list',
    titleKey: 'tour.whatsNew.quickAdd.title',
    bodyKey: 'tour.whatsNew.quickAdd.body',
  },
  {
    id: 'whatsNew.undo',
    route: 'shopping-list',
    titleKey: 'tour.whatsNew.undo.title',
    bodyKey: 'tour.whatsNew.undo.body',
  },
  {
    id: 'whatsNew.recurring',
    anchorId: 'settings.recurring',
    route: 'settings',
    scrollIntoView: true,
    titleKey: 'tour.whatsNew.recurring.title',
    bodyKey: 'tour.whatsNew.recurring.body',
  },
  // Last step back on the list, so the announcement ends where the user started.
  {
    id: 'whatsNew.supermarket',
    anchorId: 'list.supermarketFab',
    route: 'shopping-list',
    titleKey: 'tour.whatsNew.supermarket.title',
    bodyKey: 'tour.whatsNew.supermarket.body',
  },
];

export function stepsForUser(mode: TourMode = 'full'): TourStep[] {
  return mode === 'whatsNew' ? WHATS_NEW_STEPS : TOUR_STEPS;
}
