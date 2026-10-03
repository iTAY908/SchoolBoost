// ============================================================================
// Custom Cube — AI priority allocation (client mirror of the backend helper in
// backend/src/logic/budgetEngine.js `allocateCustomCube`). Kept here so the
// feature works fully offline; when online the app can call /api/budget/custom-cube.
// ============================================================================

import { Cube } from '../state/types';

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const round = (n: number) => Math.round(n * 100) / 100;

const CUSTOM_COLORS = ['#A29BFE', '#55EFC4', '#FD79A8', '#74B9FF', '#81ECEC', '#FAB1A0', '#B2BEC3'];

export interface Allocation {
  amount: number;
  priority: number;
  tone: 'high' | 'low';
  discretionary: number;
  trimLifestyle: boolean;
  explanation: string;
}

/** Allocate a monthly amount from the discretionary budget by 1–10 priority. */
export function allocateCustomCube(priority: number, income: number, housingCost: number): Allocation {
  const p = clamp(Math.round(priority) || 1, 1, 10);
  const discretionary = Math.max(0, income - Math.max(0, housingCost));

  let pct: number;
  let tone: 'high' | 'low';
  if (p >= 8) { pct = 0.1 + (p - 8) * 0.05; tone = 'high'; }
  else { pct = 0.01 + (p - 1) * 0.005; tone = 'low'; }

  let amount = round(discretionary * pct);
  if (income > 0 && amount < 50) amount = 50;

  const explanation = tone === 'high'
    ? `דירגת את זה ${p}/10 — עדיפות גבוהה. הקצאתי ${amount.toLocaleString()} ₪ בחודש, נתח משמעותי מהתקציב הפנוי (${discretionary.toLocaleString()} ₪), על חשבון צמצום קל בקוביית ההנאות.`
    : `דירגת את זה ${p}/10, אז זה לא דחוף. הקצאתי סכום קטן וסמלי של ${amount.toLocaleString()} ₪ בחודש כדי שתוכל להמשיך להתמקד ביעדי החיסכון העיקריים.`;

  return { amount, priority: p, tone, discretionary, trimLifestyle: tone === 'high', explanation };
}

/** Build a Cube object for a custom goal, trimming Lifestyle for high priority. */
export function buildCustomCube(
  name: string,
  amount: number,
  income: number,
  existing: Cube[],
  meta: { priority?: number; explanation?: string } = {}
): { cube: Cube; cubes: Cube[] } {
  const amt = Math.max(0, round(amount));
  const idx = existing.filter((c) => c.custom).length;
  const cube: Cube = {
    key: 'custom_' + Date.now(),
    name: (name || '').trim() || 'קובייה אישית',
    color: CUSTOM_COLORS[idx % CUSTOM_COLORS.length],
    icon: 'target',
    percentage: income > 0 ? round((amt / income) * 100) : 0,
    monthlyContribution: amt,
    balance: 0,
    custom: true,
    priority: meta.priority,
    note: meta.priority ? `יעד אישי · עדיפות ${meta.priority}/10` : 'יעד אישי',
    aiExplanation: meta.explanation,
  };

  const cubes = existing.map((c) => ({ ...c }));
  if (meta.priority && meta.priority >= 8) {
    const life = cubes.find((c) => c.key === 'lifestyle');
    if (life) {
      const cut = Math.min(life.monthlyContribution, amt);
      life.monthlyContribution = round(life.monthlyContribution - cut);
      life.percentage = income > 0 ? round((life.monthlyContribution / income) * 100) : 0;
    }
  }
  cubes.push(cube);
  return { cube, cubes };
}
