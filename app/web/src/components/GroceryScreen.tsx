// Grocery screen: the day-selected buy list for the current week. Ported from
// the GroceryScreen + DaySelect layout in
// features/design_handoff_grocery_day_selection/hifi-screens.jsx, wired to the
// real skip-aware query (groceryList.getGroceryList) with a day-window arg.
//
// The household picks which upcoming days to order for (a shopping run covers the
// next day or two, not the whole week); the list totals exactly those days. The
// default window is time-aware off the device clock: before 11 AM it is today +
// tomorrow, from 11 AM on it rolls forward one day (the day's own run is assumed
// done). Groups render in whatever order the query returns; the screen stays
// agnostic to group names and order (the engine owns those).

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { CurrentWeek, ShortDay } from "../lib/types.js";
import { dayDate, dayOrderIndex } from "../lib/days.js";
import { Card } from "./primitives.js";

interface GroceryItem {
  ingredient: string;
  quantity: number;
  unit: "g" | "ml" | "pcs";
  tracked: boolean;
  packs?: number;
  packTotalGrams?: number;
}

interface GroceryGroup {
  group: string;
  items: GroceryItem[];
}

interface GroceryListResult {
  groups: GroceryGroup[];
}

function formatQuantity(item: GroceryItem): string {
  if (item.tracked && item.packTotalGrams !== undefined && item.packs !== undefined) {
    const packsLabel = item.packs === 1 ? "1 pack" : `${item.packs} packs`;
    return `${item.packTotalGrams} g (${packsLabel})`;
  }
  const q = Number.isInteger(item.quantity) ? item.quantity.toString() : item.quantity.toFixed(1);
  return `${q} ${item.unit}`;
}

// ---------------------------------------------------------------------------
// Pure day-selection logic (exported for unit tests in
// app/web/test/groceryDaySelect.test.ts). These take a list of day chips (and,
// where relevant, the device hour) so the time-aware rule and the formatting can
// be exercised without a clock or a React tree.
// ---------------------------------------------------------------------------

/** How a chip sits relative to the device date. "tomorrow" only drives the tag. */
export type ChipStatus = "past" | "today" | "tomorrow" | "upcoming";

/**
 * A day on the screen: its short name, its calendar date number, the relative
 * status against the device date, and whether the household skipped it.
 */
export interface DayChip {
  day: ShortDay;
  dateNum: number;
  status: ChipStatus;
  skipped: boolean;
}

/** The relative tag a chip shows: "Today", "Tom", or the weekday short. */
export function chipTag(chip: DayChip): string {
  if (chip.status === "today") return "Today";
  if (chip.status === "tomorrow") return "Tom";
  return chip.day;
}

/** A chip is disabled (not orderable) when it is in the past or skipped. */
export function isDisabled(chip: DayChip): boolean {
  return chip.status === "past" || chip.skipped;
}

/**
 * Days the household can still order for: today or later, and not skipped. Past
 * and skipped days are never selectable (they stay disabled, struck through).
 */
export function selectableDays(chips: DayChip[]): DayChip[] {
  return chips.filter((c) => !isDisabled(c));
}

/**
 * The time-aware default window, off the device clock.
 *
 * - Before 11 AM: the first two selectable days (Today + Tomorrow).
 * - From 11 AM on: the first two selectable days EXCLUDING today (Tomorrow + the
 *   day after) - past 11, today's own shopping run is assumed done, so the
 *   window rolls forward a day.
 *
 * Two days whenever two are available; near the week's end this naturally yields
 * one or zero. Returns the chosen short-day names.
 */
export function defaultSelection(chips: DayChip[], deviceHour: number): ShortDay[] {
  const selectable = selectableDays(chips);
  const late = deviceHour >= 11;
  const pool = late ? selectable.filter((c) => c.status !== "today") : selectable;
  return pool.slice(0, 2).map((c) => c.day);
}

/**
 * The header range string for the chosen (date-sorted) days:
 * - one day -> "{short} {date}" (e.g. "Thu 18")
 * - a span  -> "{short} {date} to {short} {date}" (e.g. "Thu 18 to Fri 19")
 * - none    -> "" (the caller swaps in the pick prompt)
 */
export function rangeLabel(chosen: DayChip[]): string {
  if (chosen.length === 0) return "";
  const first = chosen[0];
  if (chosen.length === 1) return `${first.day} ${first.dateNum}`;
  const last = chosen[chosen.length - 1];
  return `${first.day} ${first.dateNum} to ${last.day} ${last.dateNum}`;
}

const WEEK_DAYS: ShortDay[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Build the screen's day chips from the week, resolved against the device's
 * current local date. A day is "today", "tomorrow" (the very next calendar day),
 * "past", or "upcoming". The local-date parse (split, not Date(string)) matches
 * lib/days.ts so the IST UTC-midnight shift never lands a day on the wrong slot.
 * Only days that exist in this week's slots get a chip.
 */
export function buildChips(week: CurrentWeek, now: Date): DayChip[] {
  const skipped = new Set((week.skippedDays ?? []).map((s) => s.day));
  const present = new Set(week.slots.map((s) => s.day));
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const tomorrowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const [y, m, d] = week.weekStart.split("-").map((n) => Number.parseInt(n, 10));
  const monday = new Date(y, (m || 1) - 1, d || 1);

  return WEEK_DAYS.filter((day) => present.has(day)).map((day) => {
    const cal = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + dayOrderIndex(day),
    );
    const calMid = new Date(cal.getFullYear(), cal.getMonth(), cal.getDate()).getTime();
    let status: ChipStatus;
    if (calMid < todayMid) status = "past";
    else if (calMid === todayMid) status = "today";
    else if (calMid === tomorrowMid) status = "tomorrow";
    else status = "upcoming";
    return { day, dateNum: dayDate(week.weekStart, day).num, status, skipped: skipped.has(day) };
  });
}

function GroceryHeader({ subtitle }: { subtitle: ReactNode }) {
  return (
    <div className="screen__header">
      <h1 className="screen__title">Grocery</h1>
      <div className="screen__subtitle">{subtitle}</div>
    </div>
  );
}

function DaySelect({
  chips,
  selected,
  onToggle,
}: {
  chips: DayChip[];
  selected: ShortDay[];
  onToggle: (day: ShortDay) => void;
}) {
  return (
    <div className="day-select">
      {chips.map((chip) => {
        const disabled = isDisabled(chip);
        const on = selected.includes(chip.day) && !disabled;
        const cls = [
          "day-chip",
          disabled ? "day-chip--disabled" : "",
          on ? "day-chip--selected" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={chip.day}
            type="button"
            className={cls}
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onToggle(chip.day)}
          >
            <span className="day-chip__tag">{chipTag(chip)}</span>
            <span className="day-chip__date">{chip.dateNum}</span>
          </button>
        );
      })}
    </div>
  );
}

export function GroceryScreen() {
  const week = useQuery(anyApi.queries.week.getCurrentWeek, {}) as CurrentWeek | null | undefined;

  // Chips and the time-aware default are derived from the week once it loads.
  // `now` is captured once per mount (in the memo) so the window is stable for
  // the session; a date/hour change mid-session is rare and resolves on reload.
  const chips = useMemo(() => (week ? buildChips(week, new Date()) : []), [week]);
  const initialSelection = useMemo(
    () => (week ? defaultSelection(chips, new Date().getHours()) : []),
    [chips, week],
  );

  // `selected` is null until the household first toggles; before that the
  // time-aware default drives the screen. Seeding lazily keeps the very first
  // render already carrying the default.
  const [selected, setSelected] = useState<ShortDay[] | null>(null);
  const effectiveSelected = selected ?? initialSelection;

  const toggle = (day: ShortDay) => {
    const chip = chips.find((c) => c.day === day);
    if (!chip || isDisabled(chip)) return; // no-op on past/skipped
    setSelected((prev) => {
      const base = prev ?? initialSelection;
      return base.includes(day) ? base.filter((d) => d !== day) : [...base, day];
    });
  };

  // Chosen days: selected, not disabled, date-sorted. The query and the range
  // label both key off this.
  const chosen = chips
    .filter((c) => effectiveSelected.includes(c.day) && !isDisabled(c))
    .sort((a, b) => dayOrderIndex(a.day) - dayOrderIndex(b.day));
  const chosenDays = chosen.map((c) => c.day);

  const weekStart = week?.weekStart;
  const grocery = useQuery(
    anyApi.groceryList.getGroceryList,
    weekStart && chosenDays.length > 0 ? { weekStart, selectedDays: chosenDays } : "skip",
  ) as GroceryListResult | undefined;

  if (week === null) {
    return (
      <div className="screen__scroll">
        <GroceryHeader subtitle="" />
        <div className="empty-state">
          <div className="empty-state__title">No grocery list yet</div>
          The buy list appears once the first menu is generated.
        </div>
      </div>
    );
  }

  if (week === undefined) {
    return (
      <div className="screen__scroll">
        <GroceryHeader subtitle="" />
        <div className="empty-state">Loading grocery list...</div>
      </div>
    );
  }

  const groups = grocery ? grocery.groups.filter((g) => g.items.length > 0) : [];
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  const range = rangeLabel(chosen);
  const subtitle =
    chosen.length === 0 ? (
      "Pick the days you want to order for"
    ) : (
      <>
        <span className="grocery-count">{count} items</span> for {range}
      </>
    );

  return (
    <div className="screen__scroll">
      <GroceryHeader subtitle={subtitle} />

      <div className="grocery-chooser">
        <div className="section-label">Order for</div>
        <DaySelect chips={chips} selected={effectiveSelected} onToggle={toggle} />
      </div>

      <div className="grocery-list">
        {chosen.length === 0 ? (
          <Card className="grocery-empty">
            <div className="grocery-empty__title">Pick a day to order</div>
            <div className="grocery-empty__body">
              Tap the days above and we&apos;ll total up exactly what to buy.
            </div>
          </Card>
        ) : grocery === undefined ? (
          <div className="empty-state">Loading grocery list...</div>
        ) : (
          groups.map((group) => (
            <Card key={group.group} className="grocery-card">
              <div className="section-label">{group.group}</div>
              <ul className="grocery-card__items">
                {group.items.map((item) => (
                  <li key={item.ingredient} className="grocery-item">
                    <span className="grocery-item__name">{item.ingredient}</span>
                    <span className="grocery-item__qty">{formatQuantity(item)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
