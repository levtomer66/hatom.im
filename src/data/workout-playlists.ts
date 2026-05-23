// Curated SoundCloud workout playlists. Plain data module, no React imports
// so it can be consumed from server or client components alike.

export interface WorkoutPlaylist {
  /** Url-safe slug derived from the SoundCloud URL's last path segment. Used as React key. */
  id: string;
  /** Display title, verbatim from the source. */
  title: string;
  /** Pretty-printed duration: 'mm:ss' for <1h, 'h:mm:ss' for >=1h. */
  durationLabel: string;
  /** Total duration in seconds — handy for future sorting / aggregation. */
  durationSeconds: number;
  /** Full SoundCloud URL. Opens in a new tab. */
  url: string;
}

// Parse 'mm:ss' or 'hh:mm:ss' into seconds. Throws on malformed input so a
// typo in the source table fails the build instead of silently rendering NaN.
function parseDurationToSeconds(input: string): number {
  const parts = input.split(':').map(p => Number.parseInt(p, 10));
  if (parts.some(n => Number.isNaN(n) || n < 0)) {
    throw new Error(`Invalid duration: "${input}"`);
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  throw new Error(`Invalid duration: "${input}"`);
}

// Pretty-print a duration: keep mm:ss under 60 minutes, otherwise emit
// h:mm:ss. Always zero-pads minutes/seconds.
function formatDurationLabel(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    const mm = String(m).padStart(2, '0');
    return `${h}:${mm}:${ss}`;
  }
  return `${m}:${ss}`;
}

// Derive a stable slug from the SoundCloud URL's last path segment.
function slugFromUrl(url: string): string {
  const u = new URL(url);
  const segments = u.pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? url;
}

interface PlaylistInput {
  title: string;
  rawDuration: string; // 'mm:ss' or 'hh:mm:ss'
  url: string;
}

const RAW: readonly PlaylistInput[] = [
  { title: 'DJ Ben Azoulay Pres. Lift AFROHOSE VOL. 01',                                              rawDuration: '58:55',  url: 'https://soundcloud.com/lift-tlv/dj-ben-azoulay-pres-lift' },
  { title: "dj GAL BEN DAVID - Primal Workout Set X Gold's Gym",                                       rawDuration: '62:08',  url: 'https://soundcloud.com/gal-ben-david-5/primal-workout-set-x-golds-gym' },
  { title: 'Gil Lugasy - Welcome To My Symphony',                                                     rawDuration: '38:05',  url: 'https://soundcloud.com/gillugasy/gil-lugasy-welcome-to-my-symphony' },
  { title: 'Adidor & Ohad Paran For Boost Fitness Center Power DECEMBER 2023',                       rawDuration: '63:52',  url: 'https://soundcloud.com/boostfitnesscenter/adidor-ohad-paran-for-boost-fitness-center-power-december-2023' },
  { title: 'Shay Tsadik & Omer Kahalon Trance Set For LIFT (March 2024)',                            rawDuration: '55:15',  url: 'https://soundcloud.com/lift-tlv/shay-tsadik-omer-kahalon-trance-set-for-lift-march-2024' },
  { title: 'Gil Lugasy & Omri Karasso - Tomorrowland Festival Set 2023',                             rawDuration: '45:34',  url: 'https://soundcloud.com/gillugasy/gil-lugasy-omri-karasso-tomorrowland-fastival-set-2023' },
  { title: 'Adidor & Ohad Paran For Boost Pilates Power November 2025',                              rawDuration: '81:48',  url: 'https://soundcloud.com/boostfitnesscenter/adidor-ohad-paran-for-boost-pilates-power-november-2025' },
  { title: "Ayelet Fogel & Tomer Shefer - Let's Run 2025 Set",                                         rawDuration: '59:11',  url: 'https://soundcloud.com/tomershefer/ayelet-foget-tomer-shefer-2025' },
  { title: 'Gil Lugasy & Karasso - Live Set (Quarantine Mix) 19.4.2020',                             rawDuration: '48:58',  url: 'https://soundcloud.com/gillugasy/gil-lugasy-karasso-live-set-edm-quarantine-mix' },
  { title: 'Shay Tsadik x Locker Room 2.0',                                                          rawDuration: '55:19',  url: 'https://soundcloud.com/shay-tsadik/shay-tsadik-x-locker-room-2-0' },
  { title: 'Adidor & Soco For Boost Fitness Center Power July 2023',                                 rawDuration: '54:06',  url: 'https://soundcloud.com/boostfitnesscenter/adidor-soco-for-boost-fitness-center-power-july-2023' },
  { title: 'Nadav Shpilman & Chen Soco For Boost Fitness Center May 2025',                           rawDuration: '59:18',  url: 'https://soundcloud.com/boostfitnesscenter/nadav-shpilman-chen-soco-for-boost-fitness-center-may-2025' },
  { title: 'ELI MATANA LIVE SET @ RONIT FARM 3.3.18 M-FESTIVAL',                                     rawDuration: '58:41',  url: 'https://soundcloud.com/elimatana/live-set-ronit-farm-3318' },
  { title: 'ELI MATANA & OMER KAHALON 4 YOSSI PORAT STUDIO',                                         rawDuration: '57:42',  url: 'https://soundcloud.com/elimatana/yossiporatstudio' },
  { title: 'ELI MATANA WORKOUT SET 4 FIRSTUDIO 2022',                                                rawDuration: '61:44',  url: 'https://soundcloud.com/elimatana/firstudio' },
  { title: 'Omer Ossadon For Locker Room Hafla - June 24',                                           rawDuration: '56:26',  url: 'https://soundcloud.com/locker_room/omer-ossadon-for-locker-room-hafla-june-24' },
  { title: 'Eli Matana x Gil Lugasy 4 Hiit Studio 2024',                                             rawDuration: '58:44',  url: 'https://soundcloud.com/elimatana/hiit-studio-2024' },
  { title: 'Eli Matana x Gil Lugasy 4 Nastia Gutin 2022',                                            rawDuration: '56:01',  url: 'https://soundcloud.com/hypemusiccoil/4nastiagutin' },
  { title: 'JETFIRE - RETURN TO THE FUTURE - SUMMER SET 2025',                                       rawDuration: '76:10',  url: 'https://soundcloud.com/jetfiremusic/jetfire-summer-set-2025' },
  { title: 'Gil Lugasy X Eli Matana For Boost Fitness Center Power dec 2022',                        rawDuration: '52:03',  url: 'https://soundcloud.com/boostfitnesscenter/gil-lugasy-x-eli-matana-for-boost-fitness-center-power-dec-2022' },
  { title: 'Adidor x Chen Soco FOR BOOST HIIT HAFLA VIBE 2024',                                      rawDuration: '52:26',  url: 'https://soundcloud.com/boostfitnesscenter/adidor-x-chen-soco-for-boost-hiit-hafla-vibe-2024' },
  { title: 'Power Set For Likys - Tomer Ben Ami & Eli Matana',                                       rawDuration: '60:23',  url: 'https://soundcloud.com/likys/power-set-for-likys-tomer-ben-ami-eli-matana' },
  { title: 'Eli Matana & Tomer Ben Ami 4 Likys #3',                                                  rawDuration: '61:52',  url: 'https://soundcloud.com/likys/eli-matana-tomer-ben-ami-4' },
  { title: 'Nitzan Meiri x Mor Dahari - Mainstream Set 2025',                                        rawDuration: '45:53',  url: 'https://soundcloud.com/mordahari/nitzan-meiri-x-mor-dahari-mainstream-set-2025' },
  { title: 'Omri Karasso X Shahar Keidar - 6th Birthday Workout Set 2024',                           rawDuration: '56:52',  url: 'https://soundcloud.com/omri-karasso/omri-karasso-x-shahar-keidar-6th-birthday-workout-set-2024-hype' },
  { title: 'ITAY ITSHAKI - FUNJOYA 2022 SET - ATISUTO',                                              rawDuration: '54:48',  url: 'https://soundcloud.com/itayitshaki/itay-itshaki-funjoya-2022-set-atisuto' },
  { title: 'NEW YEAR PARTY AT THE JEMS MODIIN - 2020',                                               rawDuration: '191:16', url: 'https://soundcloud.com/itzikgutzait/new-year-party-at-the-jems-modiin-2020' },
];

export const WORKOUT_PLAYLISTS: readonly WorkoutPlaylist[] = RAW.map(({ title, rawDuration, url }) => {
  const durationSeconds = parseDurationToSeconds(rawDuration);
  return {
    id: slugFromUrl(url),
    title,
    durationLabel: formatDurationLabel(durationSeconds),
    durationSeconds,
    url,
  };
});
