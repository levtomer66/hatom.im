'use client';

import { useCallback } from 'react';
import { Language, ExerciseCategory } from '@/types/workout';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { parseLocalDate } from '@/lib/workout-weeks';

// Flat translation keys. One source of truth so TS flags any typo when the
// dictionary is keyed by `TranslationKey`.
const DICT = {
  // Navigation / chrome
  'nav.workouts':        { en: 'Workouts',                        he: 'אימונים' },
  'nav.exercises':       { en: 'Exercises',                       he: 'תרגילים' },
  'nav.history':         { en: 'History',                         he: 'היסטוריה' },
  'nav.music':           { en: 'Music',                           he: 'מוזיקה' },
  'nav.feed':            { en: 'Feed',                            he: 'פיד' },
  'feed.title':          { en: 'Motivation Feed',                 he: 'פיד מוטיבציה' },
  'feed.completed':      { en: 'completed a workout',             he: 'השלים אימון' },
  'feed.share':          { en: 'Share to feed 📣',                he: 'שיתוף בפיד 📣' },
  'feed.shared':         { en: 'Shared ✓',                        he: 'שותף ✓' },
  'feed.unshare':        { en: 'Remove from feed',                he: 'הסרה מהפיד' },
  'feed.empty':          { en: 'Complete a workout and be the first to flex here 💪', he: 'סיימו אימון והיו הראשונים להשוויץ כאן 💪' },
  'feed.load_more':      { en: 'Load more',                       he: 'טען עוד' },
  'feed.like':           { en: 'Give a flex 💪',                  he: 'תנו כוח 💪' },
  'feed.likes':          { en: 'flexes',                          he: 'כוח' },
  // The Moving Car — shared group goal pinned on top of the feed
  'car.aria':            { en: 'Group progress: the 1-ton car',   he: 'התקדמות קבוצתית: הרכב של טון' },
  'car.title':           { en: 'The 1-ton car',                   he: 'הרכב של טון' },
  'car.rule':            { en: 'Every 1,000 kg lifted moves it 1 m', he: 'כל 1,000 ק"ג שמורמים מזיזים אותו מטר' },
  'car.level':           { en: 'Level',                           he: 'רמה' },
  'car.to_go':           { en: '{m} m to the finish line',        he: 'עוד {m} מ׳ לקו הסיום' },
  'car.level_up':        { en: 'Level up! The finish line just moved further away', he: 'עלינו רמה! קו הסיום התרחק' },
  'car.empty':           { en: 'Share a workout to give the car its first push', he: 'שתפו אימון כדי לתת לרכב את הדחיפה הראשונה' },
  'car.pushed':          { en: 'You pushed the car {m} m 🚗',    he: 'הרכב התקדם {m} מ׳ בזכותך 🚗' },
  'car.ton_short':       { en: 't',                               he: 'ט׳' },
  'car.meter_short':     { en: 'm',                               he: 'מ׳' },
  'header.switch_user':  { en: 'Switch',                          he: 'החלף' },

  // Profile menu (bodyweight + prefs)
  'profile.menu_aria':   { en: 'Profile & settings',              he: 'פרופיל והגדרות' },
  'profile.bodyweight':  { en: 'Bodyweight',                      he: 'משקל גוף' },
  'profile.language':    { en: 'Language',                        he: 'שפה' },
  'profile.units':       { en: 'Units',                           he: 'יחידות' },

  // Per-exercise load / gear (per-side, per-dumbbell, bar)
  'load.settings_aria':  { en: 'Weight entry settings',           he: 'הגדרות הזנת משקל' },
  'load.title':          { en: 'How do you enter the weight?',    he: 'איך מזינים את המשקל?' },
  'load.total':          { en: 'Total load',                      he: 'משקל כולל' },
  'load.per_side':       { en: 'Per side (+ bar)',                he: 'לכל צד (+ מוט)' },
  'load.per_dumbbell':   { en: 'Per dumbbell',                    he: 'לכל משקולת' },
  'load.bar_weight':     { en: 'Bar weight',                      he: 'משקל המוט' },
  'load.badge_side':     { en: '/side',                           he: 'לצד' },
  'load.badge_dumbbell': { en: '/dumbbell',                       he: 'למשקולת' },

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
  'workout.saved':                  { en: 'Auto-saved',                                     he: 'נשמר אוטומטית' },
  'workout.complete_button':        { en: '✓ Complete',                                     he: '✓ סיום' },
  'workout.complete_confirm':       { en: 'Mark this workout as complete?',                 he: 'לסמן את האימון כהושלם?' },
  'workout.no_exercises':           { en: 'No exercises yet. Add some to get started!',     he: 'אין תרגילים עדיין. הוסף כדי להתחיל!' },
  'workout.superset':               { en: 'Superset',                                       he: 'סופרסט' },
  'workout.watch_example':          { en: 'Watch example',                                  he: 'צפו בדוגמה' },
  'workout.add_exercise':           { en: '+ Add Exercise',                                 he: '+ הוסף תרגיל' },
  'workout.progress_label':         { en: 'Progress',                                       he: 'התקדמות' },
  'workout.summary.title':          { en: 'Workout complete!',                              he: 'האימון הושלם!' },
  'workout.summary.sets':           { en: 'Sets logged',                                    he: 'סטים שתועדו' },
  'workout.summary.exercises':      { en: 'Exercises',                                      he: 'תרגילים' },
  'workout.summary.volume':         { en: 'Total volume',                                   he: 'נפח כולל' },
  'workout.summary.cta':            { en: 'Nice work',                                      he: 'יפה מאד' },
  'workout.summary.unlocked':       { en: 'unlocked!',                                      he: 'נפתח!' },
  // Freestyle → save as template (shown only for template-less workouts)
  'workout.summary.save_title':     { en: 'Save this workout for next time?',               he: 'לשמור את האימון לפעם הבאה?' },
  'workout.summary.save_hint':      { en: 'It becomes a template in My Workouts with the exercises and sets you just did.', he: 'הוא יישמר כתבנית באימונים שלי עם התרגילים והסטים שביצעת.' },
  'workout.summary.save_placeholder': { en: 'Name it, e.g. Push Day',                       he: 'שם, למשל יום דחיפה' },
  'workout.summary.save_button':    { en: 'Save workout',                                   he: 'שמור אימון' },
  'workout.summary.save_saving':    { en: 'Saving…',                                        he: 'שומר…' },
  'workout.summary.save_saved':     { en: 'Saved to My Workouts ✓',                         he: 'נשמר באימונים שלי ✓' },
  'workout.summary.save_error':     { en: 'Couldn’t save — try again',                      he: 'השמירה נכשלה — נסו שוב' },

  // Exercise card
  'card.sets_label':                { en: 'Sets:',                                          he: 'סטים:' },
  'card.set_n':                     { en: 'Set',                                            he: 'סט' },
  'card.set_short':                 { en: 'S',                                              he: 'ס' },
  'card.kg':                        { en: 'KG',                                             he: 'ק"ג' },
  'card.reps':                      { en: 'Reps',                                           he: 'חזרות' },
  'card.reps_placeholder':          { en: 'reps',                                           he: 'חזרות' },
  'card.notes_placeholder':         { en: 'Notes (optional)…',                              he: 'הערות (לא חובה)…' },
  'card.recommended_prefix':        { en: '💡 Recommended:',                                he: '💡 מומלץ:' },
  'card.completed_at_prefix':       { en: '✓ Completed at',                                 he: '✓ הושלם ב' },
  'card.tap_to_log':                { en: 'Tap to log sets',                                he: 'הקש כדי לתעד סטים' },
  'card.remove':                    { en: 'Remove exercise',                                he: 'הסר תרגיל' },
  'card.remove_confirm':            { en: 'Remove this exercise from the workout?',         he: 'להסיר את התרגיל הזה מהאימון?' },
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
  // Calisthenics progression steps
  'card.step_pick':                 { en: 'Pick progression step',                          he: 'בחירת שלב בסקאלה' },
  'card.step_choose':               { en: 'Choose level',                                   he: 'בחר רמה' },
  'card.step_picker_title':         { en: 'Progression step',                               he: 'שלב בסקאלה' },
  'card.step_frontier':             { en: 'Your level',                                     he: 'הרמה שלך' },
  'card.step_ready':                { en: 'Ready to try ✨',                                 he: 'מוכן לנסות ✨' },
  'card.step_measure_hold':         { en: 'hold',                                           he: 'החזקה' },
  'card.step_measure_reps':         { en: 'reps',                                           he: 'חזרות' },
  'exercise_detail.hold_pb_label':  { en: 'Longest hold',                                   he: 'אחיזה הכי ארוכה' },
  'exercise_detail.bodyweight_pb_label': { en: 'Best set',                                  he: 'הסט הכי טוב' },
  'exercise_detail.ladder_title':   { en: 'Progression ladder',                             he: 'סולם התקדמות' },
  'skills.title':                   { en: 'Skills',                                         he: 'מיומנויות' },
  'skills.subtitle':                { en: 'Your calisthenics progressions',                 he: 'ההתקדמות שלך בקליסטניקס' },
  'skills.not_started':             { en: 'Not started',                                    he: 'טרם התחלת' },
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
  'picker.create_custom':           { en: '+ New custom exercise',                          he: '+ תרגיל מותאם אישית' },

  // Custom exercise form (user-added exercises)
  'customex.title':                 { en: 'Add Custom Exercise',                            he: 'הוספת תרגיל מותאם אישית' },
  'customex.name_label':            { en: 'Exercise name',                                  he: 'שם התרגיל' },
  'customex.name_placeholder':      { en: 'e.g. Incline Cable Fly',                         he: 'לדוגמה: פלייז בכבל בשיפוע' },
  'customex.categories_label':      { en: 'Categories (select all that apply)',             he: 'קטגוריות (בחר את כל המתאימות)' },
  'customex.bodyweight_label':      { en: 'Bodyweight exercise (counts bodyweight in volume)', he: 'תרגיל משקל גוף (משקל הגוף נספר בנפח)' },
  'customex.bw_factor_label':       { en: 'Bodyweight moved',                               he: 'אחוז ממשקל הגוף' },
  'customex.bw_factor_hint':        { en: 'of your bodyweight per rep',                     he: 'ממשקל הגוף לכל חזרה' },
  'customex.create':                { en: 'Create exercise',                                he: 'צור תרגיל' },
  'customex.creating':              { en: 'Creating…',                                      he: 'יוצר…' },
  'customex.err_name':              { en: 'Please enter an exercise name',                  he: 'נא להזין שם תרגיל' },
  'customex.err_category':          { en: 'Please select at least one category',            he: 'נא לבחור לפחות קטגוריה אחת' },
  'customex.err_generic':           { en: 'Failed to create exercise',                      he: 'יצירת התרגיל נכשלה' },
  'customex.cat_push':              { en: 'Push (Chest/Shoulders/Triceps)',                 he: 'דחיפה (חזה/כתפיים/יד אחורית)' },
  'customex.cat_pull':              { en: 'Pull (Back/Biceps)',                             he: 'משיכה (גב/יד קדמית)' },
  'customex.cat_legs':              { en: 'Legs',                                           he: 'רגליים' },
  'customex.cat_calisthenics':      { en: 'Calisthenics',                                   he: 'משקל גוף' },
  'customex.cat_full_body':         { en: 'Full Body / Abs',                                he: 'גוף מלא / בטן' },
  'customex.photo_label':           { en: 'Photo (optional)',                               he: 'תמונה (לא חובה)' },
  'customex.photo_add':             { en: 'Add photo',                                      he: 'הוסף תמונה' },
  'customex.photo_change':          { en: 'Change',                                         he: 'החלף' },
  'customex.photo_remove':          { en: 'Remove',                                         he: 'הסר' },
  'customex.err_photo':             { en: 'Photo upload failed',                            he: 'העלאת התמונה נכשלה' },
  'customex.remove':                { en: 'Remove exercise',                                he: 'הסר תרגיל' },
  'customex.restore':               { en: 'Restore',                                        he: 'שחזר' },
  'customex.retired_badge':         { en: 'Removed',                                        he: 'הוסר' },
  'customex.remove_confirm':        { en: 'Remove this custom exercise? It stays in your past workouts but is hidden from the lists.', he: 'להסיר את התרגיל המותאם? הוא יישאר באימונים הקודמים אך יוסתר מהרשימות.' },

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
  'template.protocol_label':        { en: 'Protocol / notes (optional)',                    he: 'פרוטוקול / הערות (לא חובה)' },
  'template.protocol_placeholder':  { en: 'e.g., 2 sets per superset · 8–10 heavy · 1.5m between sets, 2.5m between exercises', he: 'למשל: 2 סטים לכל סופרסט · 8–10 כבד · 1.5 דק׳ בין סטים, 2.5 דק׳ בין תרגילים' },
  'template.instagram_label':       { en: 'Example link (Instagram, optional)',             he: 'קישור לדוגמה (אינסטגרם, לא חובה)' },
  'template.superset_cycle':        { en: 'Superset group (cycle —/A/B/C/D)',                he: 'קבוצת סופרסט (החלף —/A/B/C/D)' },

  // Template selector
  'selector.title':                 { en: 'Start Workout',                                  he: 'התחל אימון' },
  'selector.no_templates':          { en: 'No workouts created yet',                        he: 'לא נוצרו עדיין אימונים' },
  'selector.create_first':          { en: '+ Create Your First Workout',                    he: '+ צור את האימון הראשון שלך' },
  'selector.create_new':            { en: '+ Create New Workout',                           he: '+ צור אימון חדש' },
  'selector.start_empty':           { en: '▶ Start Empty Workout',                          he: '▶ התחל אימון חופשי' },
  'selector.start_empty_hint':      { en: 'Pick exercises as you go',                       he: 'בוחרים תרגילים תוך כדי' },
  'selector.start':                 { en: 'Start',                                          he: 'התחל' },
  'selector.confirm_delete_prefix': { en: 'Delete',                                         he: 'למחוק' },
  'selector.tab.mine':              { en: 'My Workouts',                                    he: 'האימונים שלי' },
  'selector.tab.byTomer':           { en: 'Workouts by Tomer',                              he: 'אימונים של תומר' },
  'selector.tab.byTomer.empty':     { en: 'Tomer hasn’t shared any workouts yet.',     he: 'תומר עדיין לא שיתף אימונים' },
  'selector.share.on_title':        { en: 'Shared with everyone — tap to unshare',          he: 'משותף עם כולם — לחץ כדי לבטל' },
  'selector.share.off_title':       { en: 'Tap to share this workout with everyone',        he: 'לחץ כדי לשתף את האימון עם כולם' },
  'selector.shared.badge':          { en: 'Shared',                                         he: 'משותף' },
  'selector.edit_aria':             { en: 'Edit workout',                                   he: 'ערוך אימון' },
  'selector.delete_aria':           { en: 'Delete workout',                                 he: 'מחק אימון' },
  'selector.usage_n':               { en: '{n} sessions',                                   he: '{n} פעמים' },

  // History list
  'history.title':                  { en: 'History',                                        he: 'היסטוריה' },
  'history.empty':                  { en: 'No workouts yet',                                he: 'אין אימונים עדיין' },
  'history.in_progress':            { en: 'In Progress',                                    he: 'בתהליך' },
  'history.completed':              { en: 'Completed',                                      he: 'הושלמו' },
  'history.resume':                 { en: 'Resume',                                         he: 'חדש' },
  'history.resume_aria':            { en: 'Resume this in-progress workout',                he: 'חדש את האימון הפתוח' },
  'history.view':                   { en: 'View',                                           he: 'צפה' },
  'history.view_aria':              { en: 'View this completed workout',                    he: 'צפה באימון שהושלם' },
  'history.delete_aria':            { en: 'Delete workout',                                 he: 'מחק אימון' },
  'history.delete_confirm':         { en: 'Delete this workout? This action cannot be undone.', he: 'למחוק את האימון? לא ניתן לבטל.' },
  'history.load_more':              { en: 'Load more',                                      he: 'טען עוד' },
  'history.loading_more':           { en: 'Loading…',                                       he: 'טוען…' },
  'history.this_week':              { en: 'This week',                                      he: 'השבוע' },
  'history.last_week':              { en: 'Last week',                                      he: 'שבוע שעבר' },
  'history.load_error':             { en: 'Couldn’t load workouts — try again later.',      he: 'טעינת האימונים נכשלה — נסה שוב מאוחר יותר.' },

  // History detail
  'history_detail.not_found':       { en: 'Workout not found',                              he: 'האימון לא נמצא' },
  'history_detail.no_exercises':    { en: 'No exercises in this workout',                   he: 'אין תרגילים באימון הזה' },

  // Music / playlists
  'music.title':                    { en: 'Recommended Workout Sets by Tomer',              he: 'סטים מומלצים לאימון מאת תומר' },
  'music.duration':                 { en: 'Duration',                                       he: 'משך' },

  // Exercise counts
  'count.exercise_one':             { en: 'exercise',                                       he: 'תרגיל' },
  'count.exercise_many':            { en: 'exercises',                                      he: 'תרגילים' },
  'count.workout_one':              { en: 'workout',                                        he: 'אימון' },
  'count.workout_many':             { en: 'workouts',                                       he: 'אימונים' },

  // Exercises page
  'exercises.title':                { en: 'Exercises',                                      he: 'תרגילים' },
  'exercises.removed_section':      { en: 'Removed exercises',                              he: 'תרגילים שהוסרו' },
  'exercises.all':                  { en: 'All',                                            he: 'הכל' },

  // Exercise detail page
  'exercise_detail.fallback_title': { en: 'Exercise',                                       he: 'תרגיל' },
  'exercise_detail.not_found':      { en: 'Exercise not found',                             he: 'התרגיל לא נמצא' },
  'exercise_detail.history_title':  { en: 'History',                                        he: 'היסטוריה' },
  'exercise_detail.pb_label':       { en: 'PB',                                             he: 'שיא' },
  'exercise_detail.working_label':  { en: 'Working',                                        he: 'עובד על' },
  'exercise_detail.next_rec_label': { en: 'Next recommended',                               he: 'מומלץ להמשך' },
  'exercise_detail.chart_title_weight': { en: 'Best set over time',                          he: 'התקדמות במשקל' },
  'exercise_detail.chart_title_e1rm':   { en: 'Estimated 1RM over time',                    he: 'התקדמות בשיא משוער (1RM)' },
  'exercise_detail.chart_title_avg_weight': { en: 'Average weight over time',                he: 'משקל ממוצע לאורך זמן' },
  'exercise_detail.chart_avg_suffix':   { en: 'avg',                                         he: 'בממוצע' },
  'exercise_detail.chart_sets':         { en: 'sets',                                        he: 'סטים' },
  'exercise_detail.chart_title_time':   { en: 'Longest hold over time',                      he: 'התקדמות בזמן' },
  'exercise_detail.chart_hint':         { en: 'Tap a point for details',                     he: 'הקלק על נקודה לפרטים' },
  'exercise_detail.chart_workouts':     { en: 'workouts',                                    he: 'אימונים' },

  // Rest timer
  'timer.rest_label':               { en: '⏱ Rest',                                         he: '⏱ מנוחה' },
  'timer.rest_button':              { en: '⏱ Rest',                                         he: '⏱ מנוחה' },
  'timer.skip':                     { en: 'Skip',                                           he: 'דלג' },
  'timer.add_30':                   { en: '+30 seconds',                                    he: '+30 שניות' },
  'timer.minus_30':                 { en: '−30 seconds',                                    he: '−30 שניות' },
  'timer.add_15':                   { en: '+15 seconds',                                    he: '+15 שניות' },
  'timer.minus_15':                 { en: '−15 seconds',                                    he: '−15 שניות' },
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
  'forearms':     { en: 'Forearms',     he: 'אמות' },
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
// A bare `YYYY-MM-DD` (the shape Workout.date is stored in) is read as a LOCAL
// calendar day — `new Date('2026-09-03')` is UTC midnight, i.e. the previous
// evening in negative-UTC zones. Full ISO timestamps keep their instant.
const YMD_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export function formatDate(
  date: Date | string,
  language: Language,
  opts?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string'
    ? (YMD_ONLY.test(date) ? parseLocalDate(date) : new Date(date))
    : date;
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  return d.toLocaleDateString(locale, opts);
}

// Locale-aware date RANGE, e.g. "Aug 30 – Sep 5" / "Aug 3 – 9" — the browser
// picks the punctuation and RTL ordering. Falls back to two formatted dates
// where Intl.DateTimeFormat#formatRange is unavailable.
export function formatDateRange(
  start: Date,
  end: Date,
  language: Language,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  const locale = language === 'he' ? 'he-IL' : 'en-US';
  const fmt = new Intl.DateTimeFormat(locale, opts);
  if (typeof fmt.formatRange === 'function') return fmt.formatRange(start, end);
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

// English/Hebrew-aware simple count phrase: "1 exercise" / "3 exercises" / "3 תרגילים".
function countPhrase(n: number, oneKey: TranslationKey, manyKey: TranslationKey, language: Language): string {
  return `${n} ${translate(language, n === 1 ? oneKey : manyKey)}`;
}

export function exerciseCount(n: number, language: Language): string {
  return countPhrase(n, 'count.exercise_one', 'count.exercise_many', language);
}

export function workoutCount(n: number, language: Language): string {
  return countPhrase(n, 'count.workout_one', 'count.workout_many', language);
}

// Template / workout names are user-authored strings stored in the DB. When a
// well-known name has a canonical translation (Atlas program templates, plus
// the long-standing gym splits), surface the localised form. Anything we
// don't recognise falls back to the stored name so custom user-created
// templates keep rendering exactly as typed.
// Keyed by the STORED template name (in whichever language it was created),
// mapping to both locales. Looked up in both directions, so a Hebrew-named
// template still shows an English title in EN mode and vice-versa.
const TEMPLATE_NAME_TRANSLATIONS: Record<string, Record<Language, string>> = {
  // Default name of a workout started without a template (FREESTYLE_WORKOUT_NAME).
  'Freestyle Workout':       { en: 'Freestyle Workout',        he: 'אימון חופשי' },
  'Tomers Upper Body':       { en: 'Tomers Upper Body',        he: 'גפה עליונה של תומר' },
  "Tomer's Pull Day":        { en: "Tomer's Pull Day",         he: 'יום משיכה של תומר' },
  "Tomer's Push Day - Chest": { en: "Tomer's Push Day - Chest", he: 'יום דחיפה של תומר – חזה' },
  // Tomer's curated shared workouts (stored with English canonical names).
  'Quick Full Body':         { en: 'Quick Full Body',          he: 'אימון גוף מלא מהיר' },
  'Shoulders & Arms Focus':  { en: 'Shoulders & Arms Focus',   he: 'אימון דגש כתפיים ידיים' },
  'Short Upper Body':        { en: 'Short Upper Body',         he: 'פלג גוף עליון מקוצר' },
  'Short Push':              { en: 'Short Push',               he: 'אימון פוש קצר' },
  // Hybrid Calisthenics + Hypertrophy 3-day split.
  'Push — Planche & Pressing':  { en: 'Push — Planche & Pressing',  he: 'דחיפה — פלאנש ולחיצות' },
  'Pull — Front Lever':         { en: 'Pull — Front Lever',         he: 'משיכה — פרונט לוור' },
  'Upper — Skills & Strength':  { en: 'Upper — Skills & Strength',  he: 'פלג עליון — סקאלות וכוח' },
};

// Atlas templates follow a predictable "Atlas L<N> — <Upper|Lower>" pattern;
// translate them algorithmically so every level is covered without a per-row
// dictionary entry.
const ATLAS_NAME_RE = /^Atlas L(\d+) — (Upper|Lower)$/;

export function getLocalizedTemplateName(name: string, language: Language): string {
  const direct = TEMPLATE_NAME_TRANSLATIONS[name]?.[language];
  if (direct) return direct;

  // Atlas templates are auto-translated to Hebrew; in EN mode the stored
  // English "Atlas L<N> — <Upper|Lower>" name is already correct.
  if (language === 'he') {
    const m = ATLAS_NAME_RE.exec(name);
    if (m) {
      const level = m[1];
      const part = m[2] === 'Upper' ? 'עליון' : 'תחתון';
      return `אטלס רמה ${level} – ${part}`;
    }
  }

  // Unknown (custom user-created) templates render exactly as stored.
  return name;
}
