export type PlayerId = 'tom' | 'tomer';

/** Dependency reference: "questionId.right" or "questionId.left" (required choice to show this question). */
export type DependencyRef = string;

export type SideChoice = 'right' | 'left';

export interface ExpectationsQuestion {
  id: string;
  /** Shown at top of swipe screen, e.g. "אני רוצה להיות..." */
  title: string;
  /** Short labels on sides: right = option 0 (swipe right), left = option 1 (swipe left). */
  sideLabels: Record<PlayerId, { left: string; right: string }>;
  /** Question is shown only if the player's answer to each ref matches (e.g. ["dominance.right"]). */
  dependsOn?: DependencyRef[];
}
