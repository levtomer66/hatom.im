// A pregnant owner's coffee orders go into her calories diary the moment they're
// placed (docs/superpowers/specs/2026-11-24-pregnancy-design.md § Coffee orders):
// one entry per order (id `order-<orderId>`, so a retry never logs it twice), on
// the Israel day and meal of the order (or of its scheduled time).

import { defaultMeal } from '@/lib/calories/calories';
import { israelHour, israelToday } from '@/lib/pregnancy/dates';
import { orderDrink } from '@/lib/pregnancy/drinks';
import { addEntry } from '@/models/Calories';
import { activePregnantOwner, drinkEntry } from '@/lib/pregnancy-diary';
import { drinkSummary, type CoffeeOrder } from '@/types/coffee-order';

/** Run in `after()`: a failure is logged, never fails the order. */
export async function logCoffeeOrder(order: CoffeeOrder): Promise<void> {
  try {
    const email = order.userEmail.toLowerCase();
    if (!(await activePregnantOwner(email))) return;
    const when = new Date(order.scheduledAt ?? order.createdAt);
    const { drink, mg, nu } = orderDrink(order);
    const name = `${drinkSummary(order)} ☕`.slice(0, 80);
    // The order's own totals and mg (milk, sugar, syrup), on the drink it maps to.
    const entry = drinkEntry(drink, 1, defaultMeal(israelHour(when)), { id: `order-${order.id}`, name, nu, caf: mg, base: { qty: 1, nu, caf: mg }, order: order.id });
    await addEntry(email, israelToday(when), entry, true);
  } catch (error) {
    console.error('coffee-order: logging the caffeine:', error);
  }
}
