/** Master switch — set false to disable the tour without removing code. */
export const TOUR_ENABLED = true;

export const TOUR_STORAGE_KEY_PREFIX = '@salino/tour_completed_v3';

/**
 * Current "what's new" announcement; users who saw it are stored under this id.
 * History: 'trip_homes' (1.3.54) → 'ai_paste_v1' (AI paste, quick add, undo,
 * supermarket mode, recurring items).
 */
export const WHATS_NEW_ID = 'ai_paste_v1';
export const WHATS_NEW_STORAGE_KEY_PREFIX = '@salino/whats_new';

/** Wait after switching screens before showing a step. */
export const TOUR_ROUTE_SWITCH_MS = 450;

/** Wait after programmatic scroll before showing highlight. */
export const TOUR_SCROLL_SETTLE_MS = 300;

/** Approximate shopping-list top bar height (below safe area). */
export const TOUR_TOP_BAR_HEIGHT = 100;

/** Bottom FAB row clearance on shopping list. */
export const TOUR_FAB_ROW_HEIGHT = 80;

/** Standard bottom banner height + padding estimate. */
export const TOUR_AD_BANNER_HEIGHT = 58;

/** Approximate height of the tour bottom/top sheet card (px). */
export const TOUR_SHEET_APPROX_HEIGHT = 260;

/** Layout frames to wait before measuring anchor position. */
export const TOUR_LAYOUT_FRAMES = 3;
