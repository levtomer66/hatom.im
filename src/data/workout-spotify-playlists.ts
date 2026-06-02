// Tomer's curated Spotify workout playlists, rendered as embedded players on
// the /workout/music "Spotify" tab. Plain data module (no React imports) so
// it can be consumed from a server or client component.
//
// `id` is the Spotify playlist id — the segment after /playlist/ in the share
// URL, with the ?si=… share token stripped. The embed URL is built as
//   https://open.spotify.com/embed/playlist/<id>?utm_source=generator
// (the parent CSP allows the open.spotify.com frame; the player loads its own
// assets inside the iframe under Spotify's origin).

export interface SpotifyPlaylist {
  /** Spotify playlist id — used in the embed URL and as the React key. */
  id: string;
  /** Display title, verbatim from the source. */
  title: string;
}

export const WORKOUT_SPOTIFY_PLAYLISTS: readonly SpotifyPlaylist[] = [
  { title: 'Techno For Gym',       id: '1F5TebSy3k7lD2JayULYWF' },
  { title: 'Afrohouse Collection', id: '1ZSxXNwNRQAtxtD2d9RkFg' },
  { title: 'Uplifting HipHop',     id: '74KU4KGYQXh1DV9N3F6PFs' },
  { title: 'British Drill',        id: '7A7uiTiKLuoONuAeKIeBVt' },
  { title: 'Israeli Rap',          id: '3pBqy53Gv0d7RnIemW6T1Z' },
  { title: 'Regaeton',             id: '7BxP6zaLBcFm27DdrR4Jt7' },
  { title: 'Classic Music',        id: '3jaheS24vs6GrzuI57Qx67' },
  { title: 'Deep Melodic House',   id: '2elk6L5BnSK3YNR8qg5Axq' },
];
