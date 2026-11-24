'use client';

// The local gym backoffice: name a gym, pick the machines it has from the
// catalog, name them the gym's way and order them as the picker shows them.
// Save sends every gym to PUT /api/admin/gyms, which rewrites src/data/gyms.ts.

import { useEffect, useMemo, useState } from 'react';
import { BRAND_LABELS, GYM_MACHINES, type GymMachine, type MachineBrand } from '@/data/gym-machines';
import { slugify, type Gym, type GymMachineSlot } from '@/lib/gym-config';

const BRANDS: (MachineBrand | 'all')[] = ['all', 'technogym', 'matrix', 'generic'];
const BRAND_FILTER_LABEL: Record<MachineBrand | 'all', string> = {
  all: 'All', technogym: 'Technogym', matrix: 'Matrix', generic: 'Free weights & benches',
};
const CATALOG = new Map(GYM_MACHINES.map((m) => [m.id, m]));

function Thumb({ m }: { m: GymMachine }) {
  return (
    <span className="gbo-thumb">
      {m.photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={m.photo} alt="" loading="lazy" />
        : <span aria-hidden="true">{m.icon ?? '🏋️'}</span>}
    </span>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// A name that matches the catalog isn't stored, so catalog fixes still reach the gym.
function withoutCatalogNames(g: Gym): Gym {
  return {
    ...g,
    machines: g.machines.map(({ machineId, name, nameHe, serial }) => {
      const m = CATALOG.get(machineId);
      const slot: GymMachineSlot = { machineId };
      if (name !== undefined && name.trim() !== m?.name) slot.name = name;
      if (nameHe !== undefined && nameHe.trim() !== m?.nameHe) slot.nameHe = nameHe;
      if (serial?.trim()) slot.serial = serial;
      return slot;
    }),
  };
}

// Everything a backoffice search matches for one machine on a gym: the catalog
// names, the gym's own names, the maker and the unit's serial number.
function slotTexts(slot: GymMachineSlot, m: GymMachine): string[] {
  return [m.name, m.nameHe, slot.name ?? '', slot.nameHe ?? '', slot.serial ?? '', m.series ?? '', BRAND_LABELS[m.brand], ...(m.aliases ?? [])];
}
const matches = (texts: string[], q: string) => texts.some((t) => t.toLowerCase().includes(q));

const brandLine = (m: GymMachine) =>
  m.brand === 'generic' ? 'Generic' : `${BRAND_LABELS[m.brand]}${m.series ? ` · ${m.series}` : ''}`;

export default function GymBackoffice({ initialGyms }: { initialGyms: Gym[] }) {
  const [gyms, setGyms] = useState<Gym[]>(initialGyms);
  const [saved, setSaved] = useState(() => JSON.stringify(initialGyms.map(withoutCatalogNames)));
  const [selected, setSelected] = useState(0);
  // Gyms whose id still follows the name (new ones, until the id is edited).
  const [autoId, setAutoId] = useState<Set<number>>(new Set());
  const [brand, setBrand] = useState<MachineBrand | 'all'>('all');
  const [query, setQuery] = useState('');
  const [slotQuery, setSlotQuery] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(gyms.map(withoutCatalogNames)) !== saved;
  const gym = gyms[selected] as Gym | undefined;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateGym = (patch: Partial<Gym>) =>
    setGyms((all) => all.map((g, i) => (i === selected ? { ...g, ...patch } : g)));
  const updateSlots = (fn: (slots: GymMachineSlot[]) => GymMachineSlot[]) =>
    setGyms((all) => all.map((g, i) => (i === selected ? { ...g, machines: fn(g.machines) } : g)));

  const onName = (name: string) => {
    if (!gym) return;
    updateGym(autoId.has(selected) ? { name, id: slugify(name) } : { name });
  };

  const addGym = () => {
    const n = gyms.length + 1;
    let id = `gym-${n}`;
    while (gyms.some((g) => g.id === id)) id += '-x';
    setGyms([...gyms, { id, name: '', nameHe: '', machines: [] }]);
    setAutoId(new Set(autoId).add(gyms.length));
    setSelected(gyms.length);
  };

  const deleteGym = () => {
    if (!gym || gyms.length === 1) return;
    if (!window.confirm(`Delete "${gym.name || gym.id}"? (Nothing changes until you save.)`)) return;
    setGyms(gyms.filter((_, i) => i !== selected));
    setAutoId(new Set([...autoId].filter((i) => i !== selected).map((i) => (i > selected ? i - 1 : i))));
    setSelected(Math.max(0, selected - 1));
  };

  const toggleMachine = (id: string) =>
    updateSlots((slots) =>
      slots.some((s) => s.machineId === id) ? slots.filter((s) => s.machineId !== id) : [...slots, { machineId: id }],
    );

  const move = (idx: number, by: number) =>
    updateSlots((slots) => {
      const to = idx + by;
      if (to < 0 || to >= slots.length) return slots;
      const next = [...slots];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });

  const renameSlot = (idx: number, patch: Partial<GymMachineSlot>) =>
    updateSlots((slots) => slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  // Catalog search also matches this gym's names and serial for a machine it has.
  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    const slots = new Map(gym?.machines.map((s) => [s.machineId, s]));
    return GYM_MACHINES.filter((m) => brand === 'all' || m.brand === brand).filter(
      (m) => !q || matches(slotTexts(slots.get(m.id) ?? { machineId: m.id }, m), q),
    );
  }, [brand, query, gym]);

  // "On this gym" search: names or serial number. Machines in other gyms that
  // match are listed too, so a serial can be found without knowing the gym.
  const sq = slotQuery.trim().toLowerCase();
  const slotMatch = (slot: GymMachineSlot) => {
    const m = CATALOG.get(slot.machineId);
    return !!m && (!sq || matches(slotTexts(slot, m), sq));
  };
  const elsewhere = sq
    ? gyms.flatMap((g, gi) => (gi === selected ? [] : g.machines.filter(slotMatch).map((slot) => ({ gi, g, slot }))))
    : [];

  // Select / unselect every machine the catalog currently shows (brand + search).
  const selectShown = (on: boolean) =>
    updateSlots((slots) => {
      const shown = new Set(catalog.map((m) => m.id));
      if (!on) return slots.filter((s) => !shown.has(s.machineId));
      const have = new Set(slots.map((s) => s.machineId));
      return [...slots, ...catalog.filter((m) => !have.has(m.id)).map((m) => ({ machineId: m.id }))];
    });

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/gyms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gyms: gyms.map(withoutCatalogNames) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ kind: 'error', text: data.error ?? `Save failed (${res.status})` });
        return;
      }
      setGyms(data.gyms);
      setSaved(JSON.stringify(data.gyms));
      setAutoId(new Set());
      setStatus({ kind: 'ok', text: 'Saved to src/data/gyms.ts. Commit it to ship.' });
    } catch {
      setStatus({ kind: 'error', text: 'Save failed: is the dev server running?' });
    } finally {
      setSaving(false);
    }
  };

  const onGym = new Set(gym?.machines.map((s) => s.machineId));

  return (
    <div className="gbo">
      <header className="gbo-top">
        <div>
          <h1>Gym backoffice</h1>
          <p>Local only. The gyms and machines users pick from in the workout app.</p>
        </div>
        <div className="gbo-save">
          {status && <span className={`gbo-status ${status.kind}`} role="status">{status.text}</span>}
          {dirty && !status && <span className="gbo-status">Unsaved changes</span>}
          <button type="button" className="gbo-btn primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      <div className="gbo-layout">
        <nav className="gbo-gyms" aria-label="Gyms">
          {gyms.map((g, i) => (
            <button
              key={i}
              type="button"
              className={`gbo-gym ${i === selected ? 'active' : ''}`}
              onClick={() => setSelected(i)}
            >
              <span className="gbo-gym-name">{g.name || 'Untitled gym'}</span>
              <span className="gbo-gym-meta">{plural(g.machines.length, 'machine')}</span>
            </button>
          ))}
          <button type="button" className="gbo-btn" onClick={addGym}>+ New gym</button>
        </nav>

        {gym && (
          <main className="gbo-main">
            <section className="gbo-card">
              <div className="gbo-fields">
                <label>
                  <span>Gym name</span>
                  <input value={gym.name} onChange={(e) => onName(e.target.value)} placeholder="Holmes Place Givatayim" />
                </label>
                <label>
                  <span>Hebrew name</span>
                  <input dir="rtl" value={gym.nameHe} onChange={(e) => updateGym({ nameHe: e.target.value })}
                    placeholder={gym.name || 'הולמס פלייס גבעתיים'} />
                </label>
                <label>
                  <span>Id</span>
                  <input value={gym.id} onChange={(e) => {
                    setAutoId(new Set([...autoId].filter((i) => i !== selected)));
                    updateGym({ id: e.target.value });
                  }} />
                  <small>Saved on each user&apos;s device, so renaming it resets their pick.</small>
                </label>
              </div>
              <button type="button" className="gbo-btn danger" onClick={deleteGym} disabled={gyms.length === 1}>
                Delete gym
              </button>
            </section>

            <section className="gbo-card">
              <h2>On this gym <span className="gbo-count">{gym.machines.length}</span></h2>
              <p className="gbo-hint">Shown in this order in the picker. Edit a name to call the machine the gym&apos;s way; clear it to go back to the catalog name. The serial number is optional.</p>
              {gym.machines.length > 0 && (
                <input type="search" className="gbo-search gbo-slot-search" placeholder="Find by name or serial number…"
                  value={slotQuery} onChange={(e) => setSlotQuery(e.target.value)} />
              )}
              {gym.machines.length === 0 && <p className="gbo-empty">No machines yet. Add them from the catalog below.</p>}
              {sq && !gym.machines.some(slotMatch) && <p className="gbo-empty">Nothing on this gym matches.</p>}
              {elsewhere.length > 0 && (
                <p className="gbo-elsewhere">
                  Also on:{' '}
                  {elsewhere.map(({ gi, g, slot }) => (
                    <button key={`${gi}-${slot.machineId}`} type="button" className="gbo-chip" onClick={() => setSelected(gi)}>
                      {g.name || 'Untitled gym'} · {slot.name || CATALOG.get(slot.machineId)?.name}{slot.serial ? ` · ${slot.serial}` : ''}
                    </button>
                  ))}
                </p>
              )}
              <ol className="gbo-slots">
                {gym.machines.map((slot, idx) => {
                  const m = CATALOG.get(slot.machineId);
                  if (!m || !slotMatch(slot)) return null;
                  return (
                    <li key={slot.machineId} className="gbo-slot">
                      <Thumb m={m} />
                      <div className="gbo-slot-info">
                        <span className="gbo-slot-catalog">{m.name} <em>{brandLine(m)}</em></span>
                        <div className="gbo-slot-names">
                          <input aria-label={`Name for ${m.name}`} value={slot.name ?? m.name}
                            onChange={(e) => renameSlot(idx, { name: e.target.value })} />
                          <input aria-label={`Hebrew name for ${m.name}`} dir="rtl" value={slot.nameHe ?? m.nameHe}
                            onChange={(e) => renameSlot(idx, { nameHe: e.target.value })} />
                          <input aria-label={`Serial number for ${m.name}`} className="gbo-serial" value={slot.serial ?? ''}
                            placeholder="Serial number (optional)" maxLength={40}
                            onChange={(e) => renameSlot(idx, { serial: e.target.value })} />
                        </div>
                      </div>
                      <div className="gbo-slot-actions">
                        <button type="button" aria-label="Move up" disabled={idx === 0 || !!sq} onClick={() => move(idx, -1)}>↑</button>
                        <button type="button" aria-label="Move down" disabled={idx === gym.machines.length - 1 || !!sq}
                          onClick={() => move(idx, 1)}>↓</button>
                        <button type="button" aria-label={`Remove ${m.name}`} onClick={() => toggleMachine(m.id)}>✕</button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="gbo-card">
              <h2>Machine catalog</h2>
              <div className="gbo-filters">
                {BRANDS.map((b) => (
                  <button key={b} type="button" className={`gbo-chip ${brand === b ? 'active' : ''}`}
                    aria-pressed={brand === b} onClick={() => setBrand(b)}>
                    {BRAND_FILTER_LABEL[b]}
                  </button>
                ))}
                <span className="gbo-bulk">
                  <button type="button" className="gbo-chip" disabled={catalog.every((m) => onGym.has(m.id))}
                    onClick={() => selectShown(true)}>
                    Select all ({catalog.length})
                  </button>
                  <button type="button" className="gbo-chip" disabled={!catalog.some((m) => onGym.has(m.id))}
                    onClick={() => selectShown(false)}>
                    Unselect all
                  </button>
                </span>
                <input type="search" className="gbo-search" placeholder="Search machines…" value={query}
                  onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="gbo-catalog">
                {catalog.map((m) => {
                  const on = onGym.has(m.id);
                  return (
                    <button key={m.id} type="button" className={`gbo-tile ${on ? 'on' : ''}`} aria-pressed={on}
                      onClick={() => toggleMachine(m.id)}>
                      <Thumb m={m} />
                      <span className="gbo-tile-name">{m.name}</span>
                      <span className="gbo-tile-meta">{brandLine(m)} · {plural(m.exerciseIds.length, 'exercise')}</span>
                      {on && <span className="gbo-tile-check" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
                {catalog.length === 0 && <p className="gbo-empty">No machine matches.</p>}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
