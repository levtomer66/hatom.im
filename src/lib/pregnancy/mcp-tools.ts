// /pregnancy tools for the MCP server (src/app/api/mcp/route.ts): "באיזה שבוע אני?",
// "תוסיף הפוך גדול". Plain Hebrew text for the model to read back. Israel's day
// (the server has no device clock to ask). Server-only.

import { dayCaf, defaultMeal } from '@/lib/calories/calories';
import { dayOfPregnancy, heDate, israelHour, israelToday, TRIMESTER_NAMES, trimester, weekDay, PREGNANCY_DAYS } from '@/lib/pregnancy/dates';
import { matchDrink, DRINKS } from '@/lib/pregnancy/drinks';
import { todayStrip } from '@/lib/pregnancy/schedule';
import { drinkEntry, logEntry } from '@/app/api/pregnancy/_shared';
import { getDays } from '@/models/Calories';
import { pregnancyFor } from '@/models/Pregnancy';

export interface PregnancyTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, caller: { userEmail: string; userName: string }) => Promise<string>;
}

export const PREGNANCY_TOOLS: PregnancyTool[] = [
  {
    name: 'pregnancy_status',
    description: "The caller's pregnancy today: week+day, trimester, days to the due date, today's caffeine vs the daily limit, and today's appointments and reminders. Hebrew text.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, caller) => {
      const p = await pregnancyFor(caller.userEmail);
      if (!p) return 'אין הריון פעיל. אפשר להגדיר אחד בדף /pregnancy.';
      const today = israelToday(new Date());
      const day = dayOfPregnancy(p.edd, today);
      const { w, d } = weekDay(day);
      const mg = dayCaf((await getDays(p.owner, [today]))[today] ?? []);
      const strip = todayStrip(p, today).map((s) => `- ${s.kind === 'tomorrow' ? 'מחר: ' : ''}${s.text}${s.time ? ` (${s.time})` : ''}${s.done ? ' ✓' : ''}`);
      return [
        `שבוע ${w}+${d} · ${TRIMESTER_NAMES[trimester(day)]} · עוד ${PREGNANCY_DAYS - day} ימים (תאריך משוער ${heDate(p.edd)})`,
        `קפאין היום: ${mg} מתוך ${p.cafLimit} מ״ג`,
        strip.length ? `היום:\n${strip.join('\n')}` : 'אין תורים או תזכורות להיום.',
      ].join('\n');
    },
  },
  {
    name: 'pregnancy_log_drink',
    description: `Log a caffeinated drink to the pregnant owner's diary today (shared with the calories app). drink is free text, matched to: ${DRINKS.map((d) => d.name).join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        drink: { type: 'string', description: 'e.g. "הפוך גדול", "כוס זירו", "אספרסו"' },
        qty: { type: 'number', description: 'How many (default 1, up to 10).' },
      },
      required: ['drink'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const p = await pregnancyFor(caller.userEmail);
      if (!p) throw new Error('No active pregnancy.');
      if (p.owner !== caller.userEmail.toLowerCase()) throw new Error('Only the pregnant owner logs drinks.');
      const d = matchDrink(typeof args.drink === 'string' ? args.drink : '');
      if (!d) throw new Error(`Unknown drink. Known: ${DRINKS.map((x) => x.name).join(', ')}`);
      const qty = typeof args.qty === 'number' && args.qty > 0 && args.qty <= 10 ? args.qty : 1;
      const now = new Date();
      const today = israelToday(now);
      if (!(await logEntry(p.owner, today, drinkEntry(d, qty, defaultMeal(israelHour(now))), d.nu))) throw new Error('The day is full (60 entries).');
      const mg = dayCaf((await getDays(p.owner, [today]))[today] ?? []);
      return `נרשם: ${qty !== 1 ? `${qty} × ` : ''}${d.name} · ${Math.round(d.mg * qty)} מ״ג · היום ${mg}/${p.cafLimit} מ״ג${d.warn ? ` · ${d.warn}` : ''}`;
    },
  },
];
