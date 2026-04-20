// Build external search URLs for an exercise by its canonical English name.
// We deliberately search the English name (not the localised one) because
// YouTube and Instagram fitness content is overwhelmingly tagged in English,
// which gives the richest results regardless of the app's current language.

export function youtubeSearchUrl(englishName: string): string {
  // Appending "exercise" narrows to instructional clips vs random matches.
  const q = encodeURIComponent(`${englishName} exercise`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

export function instagramSearchUrl(englishName: string): string {
  const q = encodeURIComponent(englishName);
  return `https://www.instagram.com/explore/search/keyword/?q=${q}`;
}
