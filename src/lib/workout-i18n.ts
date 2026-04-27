'use client';

import { useCallback } from 'react';
import { Language, ExerciseCategory } from '@/types/workout';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';

// Flat translation keys. One source of truth so TS flags any typo when the
// dictionary is keyed by `TranslationKey`.
const DICT = {
  // Navigation / chrome
  'nav.workouts':        { en: 'Workouts',                        he: 'אימונים' },
  'nav.exercises':       { en: 'Exercises',                       he: 'תרגילים' },
  'nav.history':         { en: 'History',                         he: 'היסטוריה' },
  'header.switch_user':  { en: 'Switch',                          he: 'החלף' },

  // Login
  'login.title':         { en: '💪 Workout Tracker',              he: '💪 יומן אימונים' },
  'login.subtitle':      { en: 'Select your profile to continue', he: 'בחר פרופיל כדי להמשיך' },

  // Workout main page
  'workout.title':                  { en: 'Workouts',                                       he: 'אימונים' },
  'workout.ready_title':            { en: 'Ready to train?',                                he: 'מוכן להתאמן?' },
  'workout.hint_in_progress':       { en: 'You have an in-progress workout. It will auto-resume.', he: 'יש לך אימון פתוח. הוא יתחדש אוטומטית.' },
  'workout.hint_select':            { en: 'Select a workout to start training',             he: 'בחר אימון כדי להתחיל' },
  'workout.hint_first':             { en: 'Create your first workout to get started',       he: 'צור את האימון הראשון שלך כדי להתחיל' },
  'workout.start_button':           { en: 'Start Workout',                                  he: 'התחל אימון' },
  'workout.create_button':          { en: 'Create Workout',                                 he: 'צור אימון' },
  'workout.resume_tip':             { en: 'Tap a workout in History to resume it',          he: 'הקש על אימון בהיסטוריה כדי לחדש אותו' },
  'workout.saving':                 { en: 'Saving…',                                        he: 'שומר…' },
  'workout.saved':                  { en: '✓ Auto-saved',                                   he: '✓ נשמר אוטומטית' },
  'workout.complete_button':        { en: '✓ Complete',                                     he: '✓ סיום' },
  'workout.no_exercises':           { en: 'No exercises yet. Add some to get started!',     he: 'אין תרגילים עדיין. הוסף כדי להתחיל!' },
  'workout.add_exercise':           { en: '+ Add Exercise',                                 he: '+ הוסף תרגיל' },

  // Exercise card
  'card.sets_label':                { en: 'Sets:',                                          he: 'סטים:' },
  'card.set_n':                     { en: 'Set',                                            he: 'סט' },
  'card.kg':                        { en: 'KG',                                             he: 'ק"ג' },
  'card.reps':                      { en: 'Reps',                                           he: 'חזרות' },
  'card.reps_placeholder':          { en: 'reps',                                           he: 'חזרות' },
  'card.notes_placeholder':         { en: 'Notes (optional)…',                              he: 'הערות (לא חובה)…' },
  'card.recommended_prefix':        { en: '💡 Recommended:',                                he: '💡 מומלץ:' },
  'card.completed_at_prefix':       { en: '✓ Completed at',                                 he: '✓ הושלם ב' },
  'card.tap_to_log':                { en: 'Tap to log sets',                                he: 'הקש כדי לתעד סטים' },
  'card.remove':                    { en: 'Remove exercise',                                he: 'הסר תרגיל' },
  'card.replace':                   { en: 'Replace exercise',                               he: 'החלף תרגיל' },
  'card.drag_to_reorder':           { en: 'Drag to reorder',                                he: 'גרור כדי לשנות סדר' },
  'card.history_empty':             { en: 'No records yet for this exercise',               he: 'אין עדיין רישומים לתרגיל הזה' },
  'card.history_completed':         { en: '✓ Completed',                                    he: '✓ הושלם' },
  'card.history_replaced_prefix':   { en: 'swapped from',                                   he: 'הוחלף מ־' },
  'card.toggle_to_time':            { en: 'Switch to timer',                                he: 'עבור לטיימר' },
  'card.toggle_to_reps':            { en: 'Switch to reps',                                 he: 'עבור לחזרות' },
  'card.sec':                       { en: 'Sec',                                            he: 'שנ׳' },
  'card.start_stopwatch':           { en: '▶ Start',                                        he: '▶ התחל' },
  'card.stop_stopwatch':            { en: '⏸ Stop',                                         he: '⏸ עצור' },
  'card.reset_stopwatch':           { en: 'Reset',                                          he: 'אפס' },
  'card.bw_label':                  { en: 'BW',                                             he: 'גוף' },
  'exercise_detail.hold_pb_label':  { en: 'Longest hold',                                   he: 'אחיזה הכי ארוכה' },
  'card.notes_label':               { en: 'Notes',                                          he: 'הערות' },
  'card.kg_suffix':                 { en: 'kg',                                              he: 'ק"ג' },
  'card.reps_suffix':               { en: 'reps',                                            he: 'חזרות' },

  // Exercise picker
  'picker.title':                   { en: 'Add Exercises',                                  he: 'הוסף תרגילים' },
  'picker.replace_title':           { en: 'Replace with…',                                  he: 'החלף ב…' },
  'picker.search':                  { en: 'Search exercises…',                              he: 'חפש תרגילים…' },
  'picker.none_found':              { en: 'No exercises found',                             he: 'לא נמצאו תרגילים' },
  'picker.custom_badge':            { en: 'Custom',                                         he: 'מותאם אישית' },
  'picker.add_selected_prefix':     { en: 'Add',                                            he: 'הוסף' },
  'picker.add_selected_one':        { en: 'exercise',                                       he: 'תרגיל' },
  'picker.add_selected_many':       { en: 'exercises',                                      he: 'תרגילים' },
  'picker.create_custom':           { en: '+ Create Custom Exercise',                       he: '+ צור תרגיל מותאם' },

  // Template editor
  'template.edit_title':            { en: 'Edit Workout',                                   he: 'ערוך אימון' },
  'template.create_title':          { en: 'Create Workout',                                 he: 'צור אימון' },
  'template.name_label':            { en: 'Workout Name',                                   he: 'שם האימון' },
  'template.name_placeholder':      { en: 'e.g., Push Day, Leg Day A…',                     he: 'למשל, יום דחיפה, יום רגליים א׳…' },
  'template.selected_prefix':       { en: 'Selected Exercises',                             he: 'תרגילים נבחרים' },
  'template.selected_hint':         { en: '— drag to reorder',                              he: '— גרור כדי לשנות סדר' },
  'template.add_section':           { en: 'Add Exercises',                                  he: 'הוסף תרגילים' },
  'template.save_changes':          { en: 'Save Changes',                                   he: 'שמור שינויים' },
  'template.save_creating':         { en: 'Saving…',                                        he: 'שומר…' },
  'template.row_notes_placeholder': { en: 'Notes for this exercise (optional)…',            he: 'הערות לתרגיל (לא חובה)…' },

  // Template selector
  'selector.title':                 { en: 'Start Workout',                                  he: 'התחל אימון' },
  'selector.no_templates':          { en: 'No workouts created yet',                        he: 'לא נוצרו עדיין אימונים' },
  'selector.create_first':          { en: '+ Create Your First Workout',                    he: '+ צור את האימון הראשון שלך' },
  'selector.create_new':            { en: '+ Create New Workout',                           he: '+ צור אימון חדש' },
  'selector.start':                 { en: 'Start',                                          he: 'התחל' },
  'selector.confirm_delete_prefix': { en: 'Delete',                                         he: 'למחוק' },

  // History list
  'history.title':                  { en: 'History',                                        he: 'היסטוריה' },
  'history.empty':                  { en: 'No workouts yet',                                he: 'אין אימונים עדיין' },
  'history.in_progress':            { en: 'In Progress',                                    he: 'בתהליך' },
  'history.completed':              { en: 'Completed',                                      he: 'הושלמו' },
  'history.resume':                 { en: 'Resume',                                         he: 'חדש' },
  'history.delete_confirm':         { en: 'Delete this workout? This action cannot be undone.', he: 'למחוק את האימון? לא ניתן לבטל.' },

  // History detail
  'history_detail.not_found':       { en: 'Workout not found',                              he: 'האימון לא נמצא' },
  'history_detail.no_exercises':    { en: 'No exercises in this workout',                   he: 'אין תרגילים באימון הזה' },

  // Exercise counts
  'count.exercise_one':             { en: 'exercise',                                       he: 'תרגיל' },
  'count.exercise_many':            { en: 'exercises',                                      he: 'תרגילים' },

  // Exercises page
  'exercises.title':                { en: 'Exercises',                                      he: 'תרגילים' },
  'exercises.all':                  { en: 'All',                                            he: 'הכל' },

  // Exercise detail page
  'exercise_detail.fallback_title': { en: 'Exercise',                                       he: 'תרגיל' },
  'exercise_detail.not_found':      { en: 'Exercise not found',                             he: 'התרגיל לא נמצא' },
  'exercise_detail.history_title':  { en: 'History',                                        he: 'היסטוריה' },
  'exercise_detail.pb_label':       { en: 'PB',                                             he: 'שיא' },
  'exercise_detail.working_label':  { en: 'Working',                                        he: 'עובד על' },
  'exercise_detail.next_rec_label': { en: 'Next recommended',                               he: 'מומלץ להמשך' },

  // Rest timer
  'timer.rest_label':               { en: '⏱ Rest',                                         he: '⏱ מנוחה' },
  'timer.rest_button':              { en: '⏱ Rest',                                         he: '⏱ מנוחה' },
  'timer.skip':                     { en: 'Skip',                                           he: 'דלג' },
  'timer.add_30':                   { en: '+30 seconds',                                    he: '+30 שניות' },
  'timer.minus_30':                 { en: '−30 seconds',                                    he: '−30 שניות' },
  'timer.done_label':               { en: '✓ Rest done!',                                   he: '✓ סיים מנוחה!' },
  'timer.settings_title':           { en: 'Rest timer',                                     he: 'טיימר מנוחה' },
  'timer.default_label':            { en: 'Default',                                        he: 'ברירת מחדל' },
  'timer.sound_label':              { en: 'Sound',                                          he: 'צליל' },
  'timer.settings_aria':            { en: 'Open timer settings',                            he: 'פתח הגדרות טיימר' },

  // Generic
  'generic.close':                  { en: 'Close',                                          he: 'סגור' },
  'generic.back':                   { en: 'Back',                                           he: 'חזור' },
  'generic.cancel':                 { en: 'Cancel',                                         he: 'ביטול' },
  'generic.save':                   { en: 'Save',                                           he: 'שמור' },
  'generic.delete':                 { en: 'Delete',                                         he: 'מחק' },
  'generic.loading':                { en: 'Loading…',                                       he: 'טוען…' },

  // Help / feedback floating button
  'help.button_aria':               { en: 'Missing exercise? Suggestions?',                 he: 'חסר תרגיל? הצעות לשיפור?' },
  'help.modal_title':               { en: 'Missing exercise? Suggestions?',                 he: 'חסר תרגיל? הצעות לשיפור?' },
  'help.modal_subtitle':            { en: 'Tell us what\u2019s missing or how we can improve.', he: 'ספרו לנו מה חסר או מה אפשר לשפר.' },
  'help.placeholder':               { en: 'Your feedback\u2026',                            he: 'המשוב שלכם\u2026' },
  'help.submit':                    { en: 'Send',                                           he: 'שלח' },
  'help.sending':                   { en: 'Sending\u2026',                                  he: 'שולח\u2026' },
  'help.sent':                      { en: 'Sent, thanks!',                                  he: 'נשלח, תודה!' },
  'help.error':                     { en: 'Failed to send. Try again?',                     he: 'השליחה נכשלה, לנסות שוב?' },
} as const;

export type TranslationKey = keyof typeof DICT;

export function translate(lang: Language, key: TranslationKey): string {
  return DICT[key][lang];
}

// Hook variant for components. Returns a `t(key)` function that reads
// the current language from context.
export function useT(): (key: TranslationKey) => string {
  const { language } = useWorkoutLanguage();
  return useCallback((key: TranslationKey) => DICT[key][language], [language]);
}

// Labels for the filter chips (Push / Pull / Legs / Calisthenics / Full Body + muscle groups).
// Keyed by the existing ExerciseCategory IDs so callers can pass an ID and get a localised label.
const CATEGORY_LABELS: Record<ExerciseCategory, { en: string; he: string }> = {
  'push':         { en: 'Push',         he: 'דחיפה' },
  'pull':         { en: 'Pull',         he: 'משיכה' },
  'legs':         { en: 'Legs',         he: 'רגליים' },
  'calisthenics': { en: 'Calisthenics', he: 'קליסתניקס' },
  'upper-body':   { en: 'Upper Body',   he: 'פלג גוף עליון' },
  'lower-body':   { en: 'Lower Body',   he: 'פלג גוף תחתון' },
  'full-body':    { en: 'Full Body',    he: 'גוף מלא' },
  'chest':        { en: 'Chest',        he: 'חזה' },
  'back':         { en: 'Back',         he: 'גב' },
  'shoulders':    { en: 'Shoulders',    he: 'כתפיים' },
  'biceps':       { en: 'Biceps',       he: 'ביצפס' },
  'triceps':      { en: 'Triceps',      he: 'טרייצפס' },
  'quads':        { en: 'Quads',        he: 'ארבע ראשי' },
  'hamstrings':   { en: 'Hamstrings',   he: 'שרירי ירך אחוריים' },
  'glutes':       { en: 'Glutes',       he: 'ישבן' },
  'calves':       { en: 'Calves',       he: 'שוקיים' },
  'abs':          { en: 'Abs',          he: 'בטן' },
};

export function getCategoryLabel(category: ExerciseCategory, language: Language): string {
  return CATEGORY_LABELS[category][language];
}

// Locale-aware date formatter. Use this in place of toLocaleDateString('en-US', …).
export function formatDate(
  date: Date | string,
  language: Language,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  return d.toLocaleDateString(locale, opts);
}

// English/Hebrew-aware simple count phrase, e.g. "3 exercises" / "3 תרגילים".
export function exerciseCount(n: number, language: Language): string {
  const word = n === 1
    ? translate(language, 'count.exercise_one')
    : translate(language, 'count.exercise_many');
  return `${n} ${word}`;
}

// Template / workout names are user-authored strings stored in the DB. When a
// well-known name has a canonical translation (Atlas program templates, plus
// the long-standing gym splits), surface the localised form. Anything we
// don't recognise falls back to the stored name so custom user-created
// templates keep rendering exactly as typed.
const TEMPLATE_NAME_TRANSLATIONS: Record<string, Record<Language, string>> = {
  'Tomers Upper Body':       { en: 'Tomers Upper Body',        he: 'גפה עליונה של תומר' },
  "Tomer's Pull Day":        { en: "Tomer's Pull Day",         he: 'יום משיכה של תומר' },
  "Tomer's Push Day - Chest": { en: "Tomer's Push Day - Chest", he: 'יום דחיפה של תומר – חזה' },
};

// Atlas templates follow a predictable "Atlas L<N> — <Upper|Lower>" pattern;
// translate them algorithmically so every level is covered without a per-row
// dictionary entry.
const ATLAS_NAME_RE = /^Atlas L(\d+) — (Upper|Lower)$/;

export function getLocalizedTemplateName(name: string, language: Language): string {
  if (language === 'en') return name;

  const direct = TEMPLATE_NAME_TRANSLATIONS[name]?.[language];
  if (direct) return direct;

  const m = ATLAS_NAME_RE.exec(name);
  if (m) {
    const level = m[1];
    const part = m[2] === 'Upper' ? 'עליון' : 'תחתון';
    return `אטלס רמה ${level} – ${part}`;
  }

  return name;
}
