// Shared form-state hook for AddCoffeeReviewForm / EditCoffeeReviewForm. Pure
// extraction of the `useState` block + submit-body builder + reset logic that
// used to be duplicated verbatim in both components — no new fields, no
// behavior change. Task 12 adds the new place-level fields here.

import { useState } from 'react';
import {
  CoffeeReview,
  CreateCoffeeReviewDto,
  type CoffeeCategory,
} from '@/types/coffee';

export interface CoffeeReviewFormState {
  placeName: string;
  setPlaceName: (v: string) => void;

  // Tom's ratings
  tomCoffeeRating: number;
  setTomCoffeeRating: (v: number) => void;
  tomFoodRating: number;
  setTomFoodRating: (v: number) => void;
  tomPastryRating: number;
  setTomPastryRating: (v: number) => void;
  tomAtmosphereRating: number;
  setTomAtmosphereRating: (v: number) => void;
  tomPriceRating: number;
  setTomPriceRating: (v: number) => void;

  // Tomer's ratings
  tomerCoffeeRating: number;
  setTomerCoffeeRating: (v: number) => void;
  tomerFoodRating: number;
  setTomerFoodRating: (v: number) => void;
  tomerPastryRating: number;
  setTomerPastryRating: (v: number) => void;
  tomerAtmosphereRating: number;
  setTomerAtmosphereRating: (v: number) => void;
  tomerPriceRating: number;
  setTomerPriceRating: (v: number) => void;

  photoUrl: string;
  setPhotoUrl: (v: string) => void;
  mapsUrl: string;
  setMapsUrl: (v: string) => void;
  instagramUrl: string;
  setInstagramUrl: (v: string) => void;

  // Per-place, not per-reviewer: a café with no kitchen has no food score for
  // either of us. Toggling one off removes its slider from BOTH tabs.
  disabledCategories: CoffeeCategory[];
  toggleCategory: (id: CoffeeCategory) => void;

  // Exactly today's POST/PATCH body shape.
  buildBody: () => CreateCoffeeReviewDto;
  // Used by Add on successful submit; Edit has no use for it.
  reset: () => void;
}

export function useCoffeeReviewForm(initial?: Partial<CoffeeReview>): CoffeeReviewFormState {
  const [placeName, setPlaceName] = useState(initial?.placeName ?? '');

  // Tom's ratings
  const [tomCoffeeRating, setTomCoffeeRating] = useState(initial?.tomCoffeeRating ?? 0);
  const [tomFoodRating, setTomFoodRating] = useState(initial?.tomFoodRating ?? 0);
  const [tomPastryRating, setTomPastryRating] = useState(initial?.tomPastryRating ?? 0);
  const [tomAtmosphereRating, setTomAtmosphereRating] = useState(initial?.tomAtmosphereRating ?? 0);
  const [tomPriceRating, setTomPriceRating] = useState(initial?.tomPriceRating ?? 0);

  // Tomer's ratings
  const [tomerCoffeeRating, setTomerCoffeeRating] = useState(initial?.tomerCoffeeRating ?? 0);
  const [tomerFoodRating, setTomerFoodRating] = useState(initial?.tomerFoodRating ?? 0);
  const [tomerPastryRating, setTomerPastryRating] = useState(initial?.tomerPastryRating ?? 0);
  const [tomerAtmosphereRating, setTomerAtmosphereRating] = useState(initial?.tomerAtmosphereRating ?? 0);
  const [tomerPriceRating, setTomerPriceRating] = useState(initial?.tomerPriceRating ?? 0);

  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? '');
  const [mapsUrl, setMapsUrl] = useState(initial?.mapsUrl ?? '');
  const [instagramUrl, setInstagramUrl] = useState(initial?.instagramUrl ?? '');

  const [disabledCategories, setDisabledCategories] = useState<CoffeeCategory[]>(
    initial?.disabledCategories ?? []
  );

  const toggleCategory = (id: CoffeeCategory) => {
    setDisabledCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const buildBody = (): CreateCoffeeReviewDto => ({
    placeName,
    disabledCategories,
    // Tom's ratings
    tomCoffeeRating,
    tomFoodRating,
    tomPastryRating,
    tomAtmosphereRating,
    tomPriceRating,
    // Tomer's ratings
    tomerCoffeeRating,
    tomerFoodRating,
    tomerPastryRating,
    tomerAtmosphereRating,
    tomerPriceRating,
    // Links
    photoUrl: photoUrl || undefined,
    mapsUrl: mapsUrl || undefined,
    instagramUrl: instagramUrl || undefined,
  });

  const reset = () => {
    setPlaceName('');
    // Reset Tom's ratings
    setTomCoffeeRating(0);
    setTomFoodRating(0);
    setTomPastryRating(0);
    setTomAtmosphereRating(0);
    setTomPriceRating(0);
    // Reset Tomer's ratings
    setTomerCoffeeRating(0);
    setTomerFoodRating(0);
    setTomerPastryRating(0);
    setTomerAtmosphereRating(0);
    setTomerPriceRating(0);
    // Reset link fields
    setPhotoUrl('');
    setMapsUrl('');
    setInstagramUrl('');
    setDisabledCategories([]);
  };

  return {
    placeName, setPlaceName,
    tomCoffeeRating, setTomCoffeeRating,
    tomFoodRating, setTomFoodRating,
    tomPastryRating, setTomPastryRating,
    tomAtmosphereRating, setTomAtmosphereRating,
    tomPriceRating, setTomPriceRating,
    tomerCoffeeRating, setTomerCoffeeRating,
    tomerFoodRating, setTomerFoodRating,
    tomerPastryRating, setTomerPastryRating,
    tomerAtmosphereRating, setTomerAtmosphereRating,
    tomerPriceRating, setTomerPriceRating,
    photoUrl, setPhotoUrl,
    mapsUrl, setMapsUrl,
    instagramUrl, setInstagramUrl,
    disabledCategories, toggleCategory,
    buildBody,
    reset,
  };
}
