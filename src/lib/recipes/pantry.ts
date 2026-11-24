// Pantry basics: lines that start unticked in the 🛒 sheet (you usually have
// them). Whole-word match, so "שמנת" isn't "שמן". Import-free (node --test).

const PANTRY = [
  'מלח', 'פלפל שחור', 'שמן', 'שמן זית', 'שמן קנולה', 'מים', 'סוכר', 'קמח לבן', 'פפריקה',
  'כמון', 'כורכום', 'סודה לשתייה', 'אבקת אפייה', 'תמצית וניל', 'קינמון',
];

export function isPantry(name: string): boolean {
  const n = name.replace(/\s+/g, ' ').trim();
  return PANTRY.some((p) => n === p || n.startsWith(p + ' '));
}
