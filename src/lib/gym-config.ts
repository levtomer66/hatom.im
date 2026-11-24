// The gyms the workout app offers, and the file they live in.
// Edited by the local-only backoffice at /admin/gyms (it rewrites
// src/data/gyms.ts with renderGymsFile, then you commit the file).
// Import-free so node --test can load it.

/** One machine in a gym: a catalog machine, optionally named the gym's way. */
export interface GymMachineSlot {
  machineId: string;
  name?: string;
  nameHe?: string;
  // Optional serial number of this gym's unit (the plate on the frame), for
  // the backoffice: shown next to the machine and matched by its search.
  serial?: string;
}

export interface Gym {
  id: string;
  name: string;
  nameHe: string;
  machines: GymMachineSlot[];
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_NAME = 60;
const MAX_SERIAL = 40;

/** A URL-safe id from a gym name ("Holmes Place Givatayim" → "holmes-place-givatayim"). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Checks what the backoffice sent and returns clean gyms (trimmed names, no
 * empty overrides), or the first problem found.
 */
export function validateGyms(
  input: unknown,
  catalogIds: ReadonlySet<string>,
): { ok: true; gyms: Gym[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'Expected a list of gyms' };
  if (input.length === 0) return { ok: false, error: 'Keep at least one gym' };
  const seen = new Set<string>();
  const gyms: Gym[] = [];
  for (const [i, raw] of input.entries()) {
    const g = (raw ?? {}) as Record<string, unknown>;
    const id = text(g.id);
    const name = text(g.name);
    const nameHe = text(g.nameHe) || name;
    const where = name || `Gym ${i + 1}`;
    if (!ID.test(id)) return { ok: false, error: `${where}: id must be lowercase letters, digits and dashes` };
    if (seen.has(id)) return { ok: false, error: `Two gyms share the id "${id}"` };
    seen.add(id);
    if (!name) return { ok: false, error: `Gym ${i + 1} needs a name` };
    if (name.length > MAX_NAME || nameHe.length > MAX_NAME) return { ok: false, error: `${where}: name is too long` };
    if (!Array.isArray(g.machines) || g.machines.length === 0) {
      return { ok: false, error: `${where}: pick at least one machine` };
    }
    const used = new Set<string>();
    const machines: GymMachineSlot[] = [];
    for (const rawSlot of g.machines) {
      const s = (rawSlot ?? {}) as Record<string, unknown>;
      const machineId = text(s.machineId);
      if (!catalogIds.has(machineId)) return { ok: false, error: `${where}: unknown machine "${machineId}"` };
      if (used.has(machineId)) return { ok: false, error: `${where}: "${machineId}" is listed twice` };
      used.add(machineId);
      const slot: GymMachineSlot = { machineId };
      const n = text(s.name);
      const nh = text(s.nameHe);
      if (n.length > MAX_NAME || nh.length > MAX_NAME) return { ok: false, error: `${where}: a machine name is too long` };
      const serial = text(s.serial);
      if (serial.length > MAX_SERIAL) return { ok: false, error: `${where}: serial number "${serial.slice(0, 12)}…" is too long` };
      if (n) slot.name = n;
      if (nh) slot.nameHe = nh;
      if (serial) slot.serial = serial;
      machines.push(slot);
    }
    gyms.push({ id, name, nameHe, machines });
  }
  return { ok: true, gyms };
}

/** The whole text of src/data/gyms.ts for these gyms. */
export function renderGymsFile(gyms: Gym[]): string {
  return [
    '// The gyms users pick from in the workout app, and the machines each has.',
    '// WRITTEN BY THE LOCAL BACKOFFICE (/admin/gyms on `npm run dev:local`).',
    '// Edit it there, then commit this file; a deploy ships the change.',
    '// Machine ids refer to GYM_MACHINES in gym-machines.ts. `name`/`nameHe` on',
    "// a machine is the gym's own name for it (else the catalog name is shown).",
    '// `serial` is the optional serial number of that unit (backoffice only).',
    "import type { Gym } from '../lib/gym-config.ts';",
    '',
    'export const GYMS: Gym[] = [',
    ...gyms.map((g) => [
      '  {',
      `    id: ${JSON.stringify(g.id)},`,
      `    name: ${JSON.stringify(g.name)},`,
      `    nameHe: ${JSON.stringify(g.nameHe)},`,
      '    machines: [',
      ...g.machines.map((m) => `      ${JSON.stringify(m)},`),
      '    ],',
      '  },',
    ].join('\n')),
    '];',
    '',
  ].join('\n');
}
