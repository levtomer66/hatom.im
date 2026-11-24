// The stage sheet's picture (docs/superpowers/specs/2026-11-24-pregnancy-design.md § The week):
// freely licensed pictures of fetal development on Wikimedia Commons (drawings,
// and ultrasounds of other people's pregnancies, labelled as such),
// hot-linked with their author and licence. No specimen photos. A week without
// its own picture shows the nearest one. Import-free.

/** `us`: an ultrasound of a real pregnancy (someone else's); `drawing`: an illustration. */
export interface Stage { week: number; img: string; page: string; author: string; license: string; kind: 'drawing' | 'us' }

/** By week, ascending. */
// Chosen 2026-11-24 from the research note: drawings, renders and ultrasounds only
// (realistic museum models and specimen-traced drawings left out).
export const STAGES: readonly Stage[] = [
  { week: 5, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/2909_Embryo_Week_3-02.jpg/500px-2909_Embryo_Week_3-02.jpg', page: 'https://commons.wikimedia.org/wiki/File:2909_Embryo_Week_3-02.jpg', author: 'OpenStax College', license: 'CC BY 3.0', kind: 'drawing' },
  { week: 6, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/4_week_embryo.jpg/500px-4_week_embryo.jpg', page: 'https://commons.wikimedia.org/wiki/File:4_week_embryo.jpg', author: 'Bonnie Urquhart Gruenberg', license: 'CC BY-SA 4.0', kind: 'drawing' },
  { week: 9, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/What_Every_Girl_Should_Know_-_fetus_in_the_uterus_at_two_months.png/500px-What_Every_Girl_Should_Know_-_fetus_in_the_uterus_at_two_months.png', page: 'https://commons.wikimedia.org/wiki/File:What_Every_Girl_Should_Know_-_fetus_in_the_uterus_at_two_months.png', author: 'What Every Girl Should Know (1914)', license: 'נחלת הכלל', kind: 'drawing' },
  { week: 12, img: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Ecograf%C3%ADa_4D_-_Feto_12semanas_D.jpg', page: 'https://commons.wikimedia.org/wiki/File:Ecograf%C3%ADa_4D_-_Feto_12semanas_D.jpg', author: 'Rizome', license: 'CC BY-SA 3.0', kind: 'us' },
  { week: 13, img: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Ultrasound_image_of_a_fetus.jpg', page: 'https://commons.wikimedia.org/wiki/File:Ultrasound_image_of_a_fetus.jpg', author: 'Biagio Azzarelli', license: 'CC BY-SA 2.0', kind: 'us' },
  { week: 14, img: 'https://upload.wikimedia.org/wikipedia/commons/2/2c/Ecograf%C3%ADa_4D_-_Feto_14semanas_D.jpg', page: 'https://commons.wikimedia.org/wiki/File:Ecograf%C3%ADa_4D_-_Feto_14semanas_D.jpg', author: 'Rizome', license: 'CC BY-SA 3.0', kind: 'us' },
  { week: 17, img: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Sucking_his_thumb_and_waving.jpg', page: 'https://commons.wikimedia.org/wiki/File:Sucking_his_thumb_and_waving.jpg', author: 'jenny cu', license: 'CC BY 2.0', kind: 'us' },
  { week: 20, img: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/3dultrasound_20_weeks.jpg', page: 'https://commons.wikimedia.org/wiki/File:3dultrasound_20_weeks.jpg', author: 'Staecker', license: 'נחלת הכלל', kind: 'us' },
  { week: 24, img: 'https://upload.wikimedia.org/wikipedia/commons/0/09/Gray38_%E2%80%93_Illustration_of_a_fetus_in_utero_between_the_fifth_and_sixth_months.png', page: 'https://commons.wikimedia.org/wiki/File:Gray38_%E2%80%93_Illustration_of_a_fetus_in_utero_between_the_fifth_and_sixth_months.png', author: 'Henry Vandyke Carter (Gray\u2019s Anatomy, 1918)', license: 'נחלת הכלל', kind: 'drawing' },
  { week: 30, img: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/Fetal_3D-Sonography.jpg', page: 'https://commons.wikimedia.org/wiki/File:Fetal_3D-Sonography.jpg', author: 'Mvandergaast', license: 'נחלת הכלל', kind: 'us' },
  { week: 36, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Blausen_0747_Pregnancy.png/500px-Blausen_0747_Pregnancy.png', page: 'https://commons.wikimedia.org/wiki/File:Blausen_0747_Pregnancy.png', author: 'Blausen.com staff (2014)', license: 'CC BY 3.0', kind: 'drawing' },
  { week: 40, img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Pregnant_Human_and_Fetus_in_Uterus_%28NIH_BioArt_420_-_633833%29.png/500px-Pregnant_Human_and_Fetus_in_Uterus_%28NIH_BioArt_420_-_633833%29.png', page: 'https://commons.wikimedia.org/wiki/File:Pregnant_Human_and_Fetus_in_Uterus_(NIH_BioArt_420_-_633833).png', author: 'NIAID / Ryan Kissinger', license: 'נחלת הכלל', kind: 'drawing' },
];

/** The picture nearest `week` (ties go to the earlier one); null when there are none. */
export function stageFor(week: number): Stage | null {
  let best: Stage | null = null;
  for (const s of STAGES) if (!best || Math.abs(s.week - week) < Math.abs(best.week - week)) best = s;
  return best;
}
