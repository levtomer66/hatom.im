// Trip journey — one document per trip day, storing the photos the admin
// uploaded + an optional free-text note. Photos live in Vercel Blob; the
// document keeps their URLs, the EXIF-derived timestamp, and GPS coords
// (when present) so we can pin them on the map and sort them within the day.

export interface JourneyPhoto {
  // Public Vercel Blob URL (access: 'public').
  blobUrl: string;
  // Path inside the Blob bucket (useful for DELETE).
  blobPath: string;
  // ISO datetime the photo was actually taken, not when it was uploaded.
  // Comes from EXIF DateTimeOriginal (+ OffsetTimeOriginal when present).
  takenAt: string;
  // Optional EXIF GPS. Absent when iOS "Include Location" was off on share.
  latitude?: number;
  longitude?: number;
  // Optional user caption for the individual photo.
  caption?: string;
  // Post-resize byte size (so we can audit quota use in the admin UI).
  sizeBytes: number;
  // Original MIME type before resize (e.g. 'image/heic').
  originalMime?: string;
}

export interface TripJourneyDay {
  // Calendar day this document covers, local to the trip, 'YYYY-MM-DD'.
  // Photos are routed here server-side from their `takenAt`.
  dayDate: string;
  // Ordered by `takenAt` ascending on read.
  photos: JourneyPhoto[];
  note?: string;
  createdAt: string;
  updatedAt: string;
}

// Special document for photos whose EXIF date couldn't be resolved. Rare;
// keyed by a sentinel so we can show an "unassigned" bucket in the admin UI
// and let the user manually assign each one to a day.
export const UNASSIGNED_DAY = '__unassigned__';

// Summary row returned by the list endpoint — lets the calendar render
// badges without pulling every photo's metadata.
export interface TripJourneySummary {
  dayDate: string;
  photoCount: number;
  hasNote: boolean;
  // Representative thumbnail (first photo of the day) for the modal teaser.
  thumbnailUrl?: string;
}
