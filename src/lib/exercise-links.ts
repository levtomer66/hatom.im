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
  // Use Instagram's hashtag page (`/explore/tags/{slug}/`). Reason: it's a
  // proper universal link — tapping it on mobile opens the Instagram app's
  // in-app hashtag view directly. The generic `/explore/search/keyword/?q=…`
  // path is NOT a universal link and falls back to Instagram's in-app web
  // browser on iOS/Android, which is what the user was seeing.
  //
  // Hashtags must be [a-z0-9] only, so strip spaces, hyphens, and any other
  // punctuation: "Bench Press" → "benchpress", "Pull-Up" → "pullup".
  const slug = englishName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!slug) {
    // Defensive: fall back to keyword search if the name somehow slugs away
    // to nothing. Shouldn't happen for any library entry in practice.
    return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(englishName)}`;
  }
  return `https://www.instagram.com/explore/tags/${slug}/`;
}
