// Position id is the filename (e.g. "Screenshot 2026-02-10 at 22.27.16.png")
export type PositionId = string;

// For future filters
export type PositionIntensity = 'soft' | 'medium' | 'intense';
export type PositionLevel = 'beginner' | 'intermediate' | 'advanced';
export type ToysFilter = 'with_toys' | 'without_toys' | 'any';

export interface SexPosition {
  id: PositionId;
  filename: string;
  // Extensible for future filters - add when you implement filters
  intensity?: PositionIntensity;
  level?: PositionLevel;
  withToys?: boolean;
}

export interface ValentineProgress {
  coupleId: string;
  experiencedPositionIds: PositionId[];
}
