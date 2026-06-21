// Share-image components. The shareable output family is the menu image plus one
// recipe sheet per dish marked "include recipe when sharing". These are a
// separate surface from the PWA chrome: calm, label-free, legible at phone size
// on WhatsApp, rendered on a warm cream card. The grocery list is internal only
// and is not part of this family.
//
// Both the swipe-rail preview (SharePreviewSheet) and the exported PNGs render
// from these same components, so the preview and the shared image cannot drift
// (design-revamp §1.7, the DOM-to-image discipline). The export library walks
// the live DOM of one of these nodes and paints it to a PNG; nothing here is
// export-specific.

import type { ReactNode } from "react";
import type { Dish } from "@plantry/engine";
import type { CurrentWeek, DishPick, ShortDay } from "../lib/types.js";
import { dayOrderIndex, dayDate } from "../lib/days.js";
import { dishById } from "../lib/library.js";

function ShareFrame({ children }: { children: ReactNode }) {
  return (
    <div className="share-img">
      {children}
      <div className="share-img__wordmark">Plantry</div>
    </div>
  );
}

function ShareHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="share-img__heading">
      <div className="share-img__title">{title}</div>
      {sub && <div className="share-img__sub">{sub}</div>}
    </div>
  );
}

// One (day, meal) display model for the menu image: the picked dish names in
// position order. A skipped day renders "Skipped" in place of its meals.
// Exported so the canvas menu renderer (menuShareCanvas.ts) builds from the same
// model, keeping the menu image's data shape from drifting off the engine.
export interface ShareDayModel {
  day: ShortDay;
  short: string;
  dateNum: number;
  breakfast: string[];
  lunch: string[];
  /** §3.3 Fruit of the day: the picked Category=Fruit dish name(s) for the day. */
  fruit: string[];
  skipped: boolean;
}

const SHORT_DAY_LABEL: Record<ShortDay, string> = {
  Mon: "Mon",
  Tue: "Tue",
  Wed: "Wed",
  Thu: "Thu",
  Fri: "Fri",
  Sat: "Sat",
};

function pickName(pick: DishPick): string {
  if (pick.customLabel) return pick.customLabel;
  if (pick.dishId !== null) return dishById(pick.dishId)?.name ?? "From the library";
  return "Custom dish";
}

export function buildShareDayModels(week: CurrentWeek): ShareDayModel[] {
  const skipped = new Set<ShortDay>((week.skippedDays ?? []).map((s) => s.day));
  const byDay = new Map<ShortDay, { breakfast: string[]; lunch: string[]; fruit: string[] }>();
  for (const slot of week.slots) {
    const entry = byDay.get(slot.day) ?? { breakfast: [], lunch: [], fruit: [] };
    const names = slot.dishes.map(pickName);
    if (slot.meal === "breakfast") entry.breakfast.push(...names);
    else if (slot.meal === "fruit") entry.fruit.push(...names);
    else entry.lunch.push(...names);
    byDay.set(slot.day, entry);
  }
  const days = new Set<ShortDay>([...byDay.keys(), ...skipped]);
  return [...days]
    .sort((a, b) => dayOrderIndex(a) - dayOrderIndex(b))
    .map((day) => {
      const meals = byDay.get(day) ?? { breakfast: [], lunch: [], fruit: [] };
      return {
        day,
        short: SHORT_DAY_LABEL[day],
        dateNum: dayDate(week.weekStart, day).num,
        breakfast: meals.breakfast,
        lunch: meals.lunch,
        fruit: meals.fruit,
        skipped: skipped.has(day),
      };
    });
}

// Image 1 (the week's menu) is rendered by the canvas renderer in
// menuShareCanvas.ts, not by a React component. The menu share image overlapped
// on real iOS Safari when html-to-image re-wrapped its dish text inside a
// foreignObject (a frozen height plus a re-wrap to more lines spilled onto the
// next meal). The canvas renderer lays text out manually with measureText, so
// overlap is structurally impossible. Grocery and recipe stay on html-to-image
// (they have not shown the bug). buildShareDayModels above is the shared data
// model both surfaces read.

// Image 2+: one recipe sheet per dish marked "include recipe when sharing". The
// cook fields and recipe steps degrade gracefully when a dish lacks them (the
// enrichment coverage ramp, §1.5): the sheet only renders the rows it has.
export function RecipeShareImage({ dish }: { dish: Dish }) {
  const cookNotes: Array<{ key: string; value: string }> = [];
  if (dish.equipment) cookNotes.push({ key: "Equipment", value: dish.equipment });
  if (dish.buySpecially) cookNotes.push({ key: "Buy specially", value: dish.buySpecially });
  if (dish.prePrep) cookNotes.push({ key: "Pre prep", value: dish.prePrep });
  const sub = dish.prepMinutes > 0 ? `About ${dish.prepMinutes} minutes · serves 2` : "Serves 2";
  return (
    <ShareFrame>
      <ShareHeading title={dish.name} sub={sub} />
      {cookNotes.length > 0 && (
        <div className="share-img__cook">
          {cookNotes.map((note) => (
            <div key={note.key}>
              <span className="share-img__cook-key">{note.key}:</span> {note.value}
            </div>
          ))}
        </div>
      )}
      {dish.recipe && dish.recipe.length > 0 ? (
        <div className="share-img__recipe">
          {dish.recipe.map((step, i) => (
            <div key={i} className="share-img__recipe-step">
              <span className="share-img__recipe-num">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="share-img__empty">Recipe coming soon.</div>
      )}
    </ShareFrame>
  );
}
