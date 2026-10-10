// Birthday Family Quiz — pure logic + question data.
//
// Must stay import-free: src/lib/__tests__/birthday-quiz.test.ts imports it
// via a relative `.ts` path for `node --test`, which can't resolve `@/…`.
//
// Answers are shown in the order written here (the host reveals them one by
// one, so the order is part of the joke). `correct` is 1-based, matching the
// numbered list. Wrap a word in *asterisks* to bold it in the question.

export interface QuizQuestion {
  question: string;
  answers: string[];
  correct: number; // 1-based
  // Optional fun fact revealed after answering.
  note?: string;
}

export interface PreparedQuestion {
  question: string;
  answers: string[];
  correctIndex: number; // 0-based
  note?: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question:
      'בשנת 2009 אמא החליטה שהגיע הזמן להחליף את המיטה שלה למיטה אחרת, כשהמיטה הגיעה, אמא כמובן לא אהבה אותה, מה עלולה להיות הסיבה שבגללה אמא לא אהבה את המיטה?',
    answers: [
      'המיטה בחנות הייתה בצבע לבן ובבית היא בצבע לבנבן',
      'את המיטה הוביל ערבי',
      '״לא יודעת…״',
      'כל התשובות נכונות',
    ],
    correct: 4,
  },
  {
    question:
      'בשלהי שנת 2008 דורף הזמין הביתה את תומר סאמט לשחק מייפל סטורי, מכוון שדורף, דאז לא היה סגור על המיניות שלו הוא ביקש מתומר סאמט להישאר לישון אצלו, כשתומר סאמט נכנס להתקלח הוא הבחין שיש דלי באמבטיה, מה הסיבה לכך?',
    answers: [
      'הדלי משמש לניקוז טפטוף שלא תוקן מהתקרה',
      'הדלי נשאר שם מהפעם האחרונה שהלכו לים',
      'על המתרחצים לאגור את המים הקרים בדלי בזמן שלוקח למים להתחמם מרגע הדלקתם לצרכי השקיית צמחים',
      'הדלי שם כי אין מקום במחסן',
    ],
    correct: 3,
  },
  {
    question:
      'בשנת 2010 ערך סמיר מפגש פסגה בביתו עם ילד מחורבן בשם יונתן ורדה, לאחר שיונתן ורדה התעצבן שהמצה עם שוקולד שהכינו לו הייתה מצה רטובה, כשהוא בכלל אוהב מצה יבשה, יונתן ורדה החליט שיש לזרוק את המצה עם שוקולד מהמרפסת בסלון וכך עשה. כשאמא הבחינה בו היא כעסה עליו ואמרה לו שלא זורקים אוכל, ופעם הבאה אפשר לזרוק את המצה לפח. איכן ניתן היה לאתר את אותו ״פח״?',
    answers: [
      'הפח הוא פח רגיל שנמצא מתחת לכיור',
      'הפח הוא שקית של רמי לוי שתלויה ליד המקרר',
      'הפח הוא פיר בקומה',
      'אין פח ולכן הגיוני לזרוק מצה על שריי השכנה',
    ],
    correct: 2,
  },
  {
    question: 'מהו המשקה הלאומי של בית משפחת לב?',
    answers: [
      'קולה זירו',
      'מיץ ענבים',
      'סודה',
      'סודה מסודה-סטרים [אם יתמזל מזלך יהיה גם פטל]',
    ],
    correct: 4,
  },
  {
    question:
      'בשנת 2013 תומר התאהב בחתול בשק שהתברר בדיעבד כיצור לסבו-נאצי בשם מאי. בימי שבת תומר ומאי היו מבלים את זמנם בירושלים ובבקרים היו נהנים ממגוון רחב של אפשרויות מזון ששכנו במגירת עץ האמצעית במטבח, אל מול הכיור. כשמאי פתחה את המגירה בשבת בבוקר, מה היא *לא* מצאה שם?',
    answers: [
      'חלווה',
      'שלווה',
      'קורנפלקס עוגי שיגעוגי שילדים ונערים צעירים אוהבים',
      'תמר מג׳הול',
    ],
    correct: 3,
  },
  {
    question:
      'בראשית שנת 2005 אמא קיימה צהרון ביתי אליו הגיעו ילדים מכל הגזעים והעדות, באחד הימים של שנת 2005 הכינה אמא נאווה לצהריים שניצל דינוזאורים של מאמא-עוף אך כשהתחילו הילדים לאכול, התברר שלא נשאר קטשופ במקרר. מה הייתה ההוראה שניתנה לתומר מאמא?',
    answers: [
      'קח 10 שקל ותקנה קטשופ מה״שופר-שוק״',
      'רד לשכן ובקש ממנו קטשופ',
      'רד למחסן בחניון וחפש לצד כיסאות פלסטיק, בקבוקי יין של סופרים, מנגל פחמים ואורז בסמטי של סוגת אם נשאר קטשופ שאינו פג תוקף',
      'תקנה עגבניות ותרסק אותם',
    ],
    correct: 3,
  },
  {
    question:
      'בשנת 2013 תומר היה חייל עני שעדיין התגורר בבית הוריו, כששב הביתה ביום שישי רעב ומסכן ביקש תומר מאביו 15 שקל בכדי לקנות פיתות בסופר הקרוב לביתנו - מגה בעיר, מה קרה אחר כך?',
    answers: [
      'אבא פתח את הארנק ונתן לתומר 15 שקל ללכת לקנות פיתות',
      'אבא אמר שיש פיתות במחסן',
      'אבא שלף זיכוי של 3.26 ש״ח מהחזרת קפה נמס ועוד זיכוי של 6.67 ש״ח מהחזרת חלב, קופון של 10 ש״ח מעיתון ידיעות אחרונות וכרטיס אשראי שמקנה 5% הנחה במגה בעיר, שלח את תומר לקנות פיתות ולחזור עם עודף',
      'אבא אמר שלא צריך פיתות כי יש לחם',
    ],
    correct: 3,
  },
  {
    question:
      'נכון להיום ובפרט נכון לשנת 2022 עדיין מתגורר סמיר הילד האובד בבית הוריו במערת התופים שכבש בקומה העליונה של הבית, מדי חודש, כשסמיר יורד למפגש החד-חודשי שלו עם בעלי הבית הוא שומע רעש של כפית מתקשקשת בכוס פלסטיק קשיחה, מהו אותו סאונד מסתורי שסמיר שומע מידי חודש?',
    answers: [
      'לסמיר נדפקו האוזניים מנגינת תופים חזקה',
      'הרוח הירושלמית מזיזה את השמשייה ויוצרת סאונד משונה',
      'אבא אוכל גביע יוגורט עם כפית ומוודא בקנאות שלא נותר חלילה טיפת מוצר או מזון כלשהו בגביע',
      'חמאסניק חופר מנהרה בעזה והרעש נשמע עד לבית בירושלים',
    ],
    correct: 3,
  },
  {
    question: 'איזה כינוי מעולם לא ניתן לסמיר?',
    answers: ['אבוסאחבי', 'זרייאר', 'דונקיאולו', 'כוסחתאק'],
    correct: 4,
  },
  {
    question:
      'אם תנסה להשיג את אבא דידי ביום שישי, תופתע לגלות שלא תמיד אבא נמצא במקום עם קליטה, מה הסיבה לכך?',
    answers: [
      'אבא מקפץ בין רמי לוי לשופרסל בתלפיות בכדי למצוא את המחיר הזול ביותר לעגבניה',
      'אבא בישיבת פוקר ונרגילה השבועית עם חברים מהלהקה',
      'אבא הלך לעבודה',
      'אבא רואה סרט בקולנוע',
    ],
    correct: 1,
  },
  {
    question: 'מה ענה אבידו לסמיר כששאל מדוע נערות הליווי באמסטרדם אינן לגמרי לבושות?',
    answers: ['״הן הולכות לים״', '״בדיוק הן הולכות להתקלח״', '״חם להן״', '״זאת העבודה שלהן״'],
    correct: 2,
  },
];

export function prepareQuiz(questions: readonly QuizQuestion[]): PreparedQuestion[] {
  return questions.map(({ question, answers, correct, note }) => ({
    question,
    answers,
    correctIndex: correct - 1,
    note,
  }));
}

// ---- Host-driven flow -------------------------------------------------
//
// A host runs the quiz on a shared screen: each question's answers appear
// one at a time (click / Space), and an answer can only be picked once all
// of them are showing. The host can move freely between questions; each
// question remembers how far it was revealed and what was picked.

export type QuizPhase = 'intro' | 'playing' | 'done';

export interface QuizState {
  phase: QuizPhase;
  questions: PreparedQuestion[];
  index: number;
  revealed: number[]; // per question: how many answers are showing
  picked: (number | null)[]; // per question: the chosen answer, if any
}

export type QuizAction =
  | { type: 'start'; questions: PreparedQuestion[] }
  | { type: 'advance' } // reveal the next answer, or move on once answered
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'pick'; answer: number };

export const INITIAL_QUIZ_STATE: QuizState = {
  phase: 'intro',
  questions: [],
  index: 0,
  revealed: [],
  picked: [],
};

export function canPick(state: QuizState): boolean {
  const q = state.questions[state.index];
  return (
    state.phase === 'playing' &&
    !!q &&
    state.revealed[state.index] >= q.answers.length &&
    state.picked[state.index] === null
  );
}

export function quizScore(state: QuizState): number {
  return state.picked.filter((p, i) => p !== null && p === state.questions[i]?.correctIndex).length;
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'start':
      return {
        phase: 'playing',
        questions: action.questions,
        index: 0,
        revealed: action.questions.map(() => 0),
        picked: action.questions.map(() => null),
      };

    case 'advance': {
      const q = state.questions[state.index];
      if (state.phase !== 'playing' || !q) return state;
      const shown = state.revealed[state.index];
      if (shown < q.answers.length) {
        const revealed = [...state.revealed];
        revealed[state.index] = shown + 1;
        return { ...state, revealed };
      }
      if (state.picked[state.index] !== null) return quizReducer(state, { type: 'next' });
      return state;
    }

    case 'next':
      if (state.phase !== 'playing') return state;
      if (state.index + 1 >= state.questions.length) return { ...state, phase: 'done' };
      return { ...state, index: state.index + 1 };

    case 'prev':
      if (state.phase === 'done') return { ...state, phase: 'playing' };
      if (state.phase !== 'playing' || state.index === 0) return state;
      return { ...state, index: state.index - 1 };

    case 'pick': {
      const q = state.questions[state.index];
      if (!canPick(state) || action.answer < 0 || action.answer >= q.answers.length) return state;
      const picked = [...state.picked];
      picked[state.index] = action.answer;
      return { ...state, picked };
    }
  }
}

// `*word*` marks bold text in a question. Odd indexes are the bold parts.
export function splitEmphasis(text: string): string[] {
  return text.split(/\*([^*]+)\*/);
}

const CELEBRATE_RATIO = 0.7;

export function celebrates(score: number, total: number): boolean {
  return total > 0 && score / total >= CELEBRATE_RATIO;
}

export function resultMessage(score: number, total: number): { emoji: string; text: string } {
  const ratio = total === 0 ? 0 : score / total;
  if (ratio === 1) return { emoji: '🏆', text: 'מושלם! את/ה מכיר/ה את המשפחה הכי טוב שיש' };
  if (celebrates(score, total)) return { emoji: '🎉', text: 'כל הכבוד! בן/בת משפחה אמיתי/ת' };
  if (ratio >= 0.4) return { emoji: '🙂', text: 'לא רע — אבל כדאי להגיע ליותר ארוחות שישי' };
  return { emoji: '🙈', text: 'אופס… אולי הגיע הזמן לאלבום התמונות המשפחתי' };
}
