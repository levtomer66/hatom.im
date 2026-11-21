'use client';

// "הוספה ל…": which meal (chips), then FoodPicker.

import React, { useState } from 'react';
import { MEALS, MEAL_NAMES, type Entry, type Meal, type Recent, type Totals } from '@/lib/calories/calories';
import FoodPicker from './FoodPicker';
import Sheet from './Sheet';

export default function AddSheet({ meal: first, recent, canShop, busy, onLog, onClose }: {
  meal: Meal;
  recent: Recent[];
  canShop: boolean;
  busy: boolean;
  onLog: (entry: Omit<Entry, 'id' | 'at'>, per100: Totals | null, per?: Totals) => void;
  onClose: () => void;
}) {
  const [meal, setMeal] = useState<Meal>(first);
  return (
    <Sheet title={`הוספה ל${MEAL_NAMES[meal]}`} onClose={onClose}>
      <div className="cal-chips cal-meal-chips" role="radiogroup" aria-label="ארוחה">
        {MEALS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={m === meal} className={`sh-chip ${m === meal ? 'is-on' : ''}`} onClick={() => setMeal(m)}>{MEAL_NAMES[m]}</button>
        ))}
      </div>
      <FoodPicker mode="log" recent={recent} canShop={canShop} busy={busy} onLog={(e, per100, per) => onLog({ ...e, meal }, per100, per)} />
    </Sheet>
  );
}
