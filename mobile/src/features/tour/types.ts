export type TourAnchorId =
  | 'list.hero'
  | 'list.filters'
  | 'list.addFab'
  | 'list.supermarketFab'
  | 'list.settings'
  | 'list.activity'
  | 'list.homes'
  | 'settings.invite'
  | 'history.title';

export type TourRoute = 'shopping-list' | 'settings' | 'history' | 'activity';

export type TourRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** 'full' = the onboarding tour; 'whatsNew' = a short one-off about a new feature. */
export type TourMode = 'full' | 'whatsNew';

export type TourStep = {
  id: string;
  anchorId?: TourAnchorId;
  titleKey: string;
  bodyKey: string;
  /** Navigate to this screen before showing the step. */
  route?: TourRoute;
  /** Scroll the screen so the anchor is visible before highlighting. */
  scrollIntoView?: boolean;
};
