import type { ExpectationsQuestion } from '@/types/expectations';

/**
 * Valentine Sex Session Expectation Match — full question graph with dependencies.
 * Order and dependsOn respect the build-up flow; branches are skipped based on earlier answers.
 */
export const EXPECTATIONS_QUESTIONS: ExpectationsQuestion[] = [
  // ─── 0) Session Type ─────────────────────────────────────────────────────
  {
    id: 'session_type',
    title: 'הלילה בא לי...',
    sideLabels: {
      tom: { right: 'רומנטי ואינטימי', left: 'פרוע ואינטנסיבי' },
      tomer: { right: 'רומנטי ואינטימי', left: 'פרוע ואינטנסיבי' },
    },
  },

  {
    id: 'hits',
    title: 'אני רוצה',
    sideLabels: {
      tom: { right: 'שתרביץ לי', left: 'שתיגע בי בעדינות' },
      tomer: { right: 'להרביץ לך', left: 'לגעת בך בעדינות' },
    },
  },

  {
    id: 'hits_type',
    title: 'כמה חזק?',
    dependsOn: ['hits.right'],
    sideLabels: {
      tom: { right: 'ממש חזק', left: 'לא להגזים' },
      tomer: { right: 'ממש חזק', left: 'לא להגזים' },
    },
  },

  // ─── 2) Communication Style (Q4–Q6 only if Q3 = talking) ─────────────────
  {
    id: 'communication_talk_silent',
    title: 'בזמן הסקס אני...',
    sideLabels: {
      tom: { right: 'מעדיפה לתת לך משוב', left: 'מעדיפה שקט' },
      tomer: { right: 'מעדיף שתתני לי משוב', left: 'מעדיף שקט' },
    },
  },
  {
    id: 'communication_praise_dirty',
    title: 'יותר...',
    sideLabels: {
      tom: { right: 'מחמאות רומנטיות', left: 'דירטי טוק' },
      tomer: { right: 'מחמאות רומנטיות', left: 'דירטי טוק' },
    },
  },
  {
    id: 'dirty_level',
    title: 'כמה דירטי?',
    dependsOn: ['communication_praise_dirty.left'],
    sideLabels: {
      tom: { right: 'ממש מלוכלך (תקלל אותי)', left: 'עד גבול מסוים' },
      tomer: { right: 'ממש מלוכלך (לקלל אותך)', left: 'עד גבול מסוים' },
    },
  },


  // ─── 3) Power & Control (Q8–Q12 only if Q7 = power play) ───────────────────

  {
    id: 'power_dominant_submissive',
    title: 'אני',
    sideLabels: {
      tom: { right: 'רוצה להיות דומיננטית ושולטת', left: 'רוצה להיות כנועה ונשלטת' },
      tomer: { left: 'רוצה להיות דומיננטי ושולט', right: 'רוצה להית כנועה ונשלט' },
    },
  },

  {
    id: 'power_tension',
    title: 'בא לי את זה',
    sideLabels: {
      tom: { right: 'ישר לעניינים', left: 'נבנה לאט' },
      tomer: { right: 'ישר לעניינים', left: 'נבנה לאט' },
    },
  },
  // {
  //   id: 'power_rules_chaos',
  //   title: 'יותר...',
  //   sideLabels: {
  //     tom: { right: 'כללים ומבנה', left: 'כאוס וספונטניות' },
  //     tomer: { right: 'כללים ומבנה', left: 'כאוס וספונטניות' },
  //   },
  // },

  // ─── 4) Touch & Intensity ───────────────────────────────────────────────
  {
    id: 'touch_gentle_wild',
    title: 'אני רוצה ',
    sideLabels: {
      tom: { right: 'שתיגע בי בעדינות', left: 'שתיגע בי בצורה פרעית' },
      tomer: { right: 'לגעת בך בעדינות', left: 'לגעת בך בצורה פרעית' },
    },
  },


  // ─── 5) Visual & Attention ──────────────────────────────────────────────
  // {
  //   id: 'watching_watched',
  //   title: 'אני רוצה.',
  //   sideLabels: {
  //     tom: { right: 'לראות את כל מה שקורה', left: 'לא לראות כלום' },
  //     tomer: { right: 'לראות את כל מה שקורה', left: 'לא לראות כלום' },
  //   },
  // },


  // ─── 8) Toys (Q27–Q34 only if Q26 = yes; Q29–Q31 only if Q28 = vibrator) ─
  {
    id: 'toys_yes_no',
    title: 'הלילה',
    sideLabels: {
      tom: { right: 'עם צעצועים', left: 'בלי צעצועים' },
      tomer: { right: 'עם צעצועים', left: 'בלי צעצועים' },
    },
  },
  {
    id: 'toy_role',
    title: 'תפקיד הצעצוע הוא',
    dependsOn: ['toys_yes_no.right'],
    sideLabels: {
      tom: { right: 'להשלמה בלבד', left: 'לאירוע הראשי' },
      tomer: { right: 'להשלמה בלבד', left: 'לאירוע הראשי' },
    },
  },

  {
    id: 'toy_familiarity',
    title: 'בא לי...',
    sideLabels: {
      tom: { right: 'מועדף מוכר', left: 'לנסות משהו חדש' },
      tomer: { right: 'מועדף מוכר', left: 'לנסות משהו חדש' },
    },
  },

  {
    id: 'toy_control',
    title: 'מבחינת שליטה',
    dependsOn: ['toys_yes_no.right'],
    sideLabels: {
      tom: { right: 'אתה שולט בצעצוע', left: 'אני שולטת בצעצוע' },
      tomer: { right: 'אני שולט בצעצוע', left: 'את שולטת בצעצוע' },
    },
  },

  // ─── 9) Restraints / Sensory (Q36–Q41 only if Q35 = yes) ─────────────────
  {
    id: 'restraints_yes_no',
    title: 'אני רוצה',
    sideLabels: {
      tom: { right: 'שתקשור אותי', left: 'להיות חופשיה' },
      tomer: { right: 'לקשור אותך', left: 'שתהיי חופשיה' },
    },
  },
  {
    id: 'sensory_blindfold',
    title: 'בא לי',
    dependsOn: ['restraints_yes_no.right'],
    sideLabels: {
      tom: { right: 'שתכסה לי את העיניים', left: 'לראות הכל' },
      tomer: { right: 'לכסות לך את העיניים', left: 'שתראי הכל' },
    },
  },

  {
    id: 'worshipped_claimed',
    title: 'יותר...',
    sideLabels: {
      tom: { right: 'תשאל אותי', left: 'תכפה עלי לעשות דברים' },
      tomer: { left: 'לכפות עלייך לעשות דברים', right: 'לשאול אותך מה לעשות' },
    },
  },

];
