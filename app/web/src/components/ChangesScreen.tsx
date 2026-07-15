// Changes screen. The newest-first record of everything done to this week's
// menu, merged from two Convex subscriptions: the manualChanges activity feed
// (queries/activity.listManualChangesForWeek) and the queued comments
// (queries/comments.listQueuedComments, filtered client-side to this week).
// Each entry shows who, when, what changed, and the freeform reason / comment.
// Day-level and dish-level context is folded into the "what" line in plain
// language; no internal enum value (changeKind, position) ever reaches the
// screen (Principle 7). Ported from the ChangesScreen in
// design_handoff/hifi-screens.jsx; the prototype's `activity` array is the two
// live queries here. The Menu summary line (deriveSummaryLine) reads the same
// manualChanges feed.

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { CurrentWeek, Identity, ShortDay } from "../lib/types.js";
import { dayLabel } from "../lib/days.js";
import { dishById } from "../lib/library.js";
import { Avatar, Card } from "./primitives.js";

// One row of the manualChanges activity feed. Mirrors the manualChanges schema
// (app/convex/schema.ts); duplicated here because app/web reads Convex through
// anyApi at runtime and does not import the generated types.
interface ManualChangeRow {
  _id: string;
  createdAt: number;
  author: Identity;
  weekStart: string;
  day?: ShortDay;
  changeKind: "swap" | "custom" | "delete" | "add" | "skip_day" | "restore_day";
  before: { dishId: number | null; customLabel: string | null };
  after: { dishId: number | null; customLabel: string | null };
  reason: string;
}

interface CommentRow {
  _id: string;
  createdAt: number;
  author: Identity;
  attachedTo: {
    kind: "dish" | "day";
    weekStart: string;
    day: string | null;
    dishId: number | null;
  };
  text: string;
}

// A normalised feed entry both sources fold into. `headline` is the plain "what
// happened" line; `note` is the freeform reason (a manual change) or the comment
// body, rendered in the quoted block when present.
interface FeedEntry {
  key: string;
  author: Identity;
  createdAt: number;
  headline: string;
  note: string | null;
}

function authorName(author: Identity): string {
  return author === "rajat" ? "Rajat" : "Tuhina";
}

// Absolute, friendly timestamp ("Jun 13, 4:05 PM"). The Changes tab is a record
// that spans the whole week, so a relative time ("2 hr ago") would read oddly on
// an entry made on Monday viewed on Saturday; an absolute time stays correct.
function whenLabel(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The display name for one side of a change. A library pick resolves through the
// baked library; a custom one-off uses its typed label; an empty side (the null
// entry add/delete use) falls back to a quiet phrase.
function pickName(entry: { dishId: number | null; customLabel: string | null }): string {
  if (entry.customLabel) return entry.customLabel;
  if (entry.dishId !== null) return dishById(entry.dishId)?.name ?? "a library dish";
  return "a dish";
}

// Day context suffix, e.g. " on Monday". Day-level kinds bake the day into the
// headline directly, so this is only used by the dish-level kinds.
function onDay(day: ShortDay | undefined): string {
  return day ? ` on ${dayLabel(day)}` : "";
}

// Plain-language headline for a manual change. No internal enum value leaks.
function changeHeadline(row: ManualChangeRow): string {
  switch (row.changeKind) {
    case "swap":
      return `Swapped ${pickName(row.before)} for ${pickName(row.after)}${onDay(row.day)}`;
    case "custom":
      return `Added ${pickName(row.after)}${onDay(row.day)}`;
    case "add":
      return `Added ${pickName(row.after)}${onDay(row.day)}`;
    case "delete":
      return `Deleted ${pickName(row.before)}${onDay(row.day)}`;
    case "skip_day":
      return row.day ? `Skipped ${dayLabel(row.day)}` : "Skipped a day";
    case "restore_day":
      return row.day ? `Restored ${dayLabel(row.day)}` : "Restored a day";
    default:
      return "Changed the menu";
  }
}

function commentHeadline(row: CommentRow): string {
  const at = row.attachedTo;
  if (at.kind === "dish" && at.dishId !== null) {
    const name = dishById(at.dishId)?.name ?? "a dish";
    return `Commented on ${name}${at.day ? ` (${at.day})` : ""}`;
  }
  if (at.day) return `Commented on ${at.day}`;
  return "Left a comment";
}

function manualChangeToEntry(row: ManualChangeRow): FeedEntry {
  return {
    key: `change-${row._id}`,
    author: row.author,
    createdAt: row.createdAt,
    headline: changeHeadline(row),
    note: row.reason.trim() ? row.reason.trim() : null,
  };
}

function commentToEntry(row: CommentRow): FeedEntry {
  return {
    key: `comment-${row._id}`,
    author: row.author,
    createdAt: row.createdAt,
    headline: commentHeadline(row),
    note: row.text.trim() ? row.text.trim() : null,
  };
}

// Build the newest-first feed: manual changes for the week plus this week's
// queued comments, sorted by createdAt descending.
export function buildFeed(
  changes: ManualChangeRow[],
  comments: CommentRow[],
  weekStart: string,
): FeedEntry[] {
  const entries: FeedEntry[] = [];
  for (const c of changes) entries.push(manualChangeToEntry(c));
  for (const c of comments) {
    if (c.attachedTo.weekStart === weekStart) entries.push(commentToEntry(c));
  }
  entries.sort((a, b) => b.createdAt - a.createdAt);
  return entries;
}

// The count of menu edits this week. The manualChanges feed
// (listManualChangesForWeek) holds only menu edits (swaps, adds, deletes, skips,
// restores, saves); queued comments live in a separate feed and are feedback,
// not edits. So the non-`comment` count the Changes tab surfaces is simply the
// length of this feed. Kept as a named helper so the Changes subtitle and the
// nav badge read the same number from one place.
export function changeCount(changes: ManualChangeRow[]): number {
  return changes.length;
}

// The Changes nav-badge unread count. Unlike `changeCount` (the week summary the
// subtitle shows), this is a notification counter: the number of menu edits made
// by the OTHER user that the viewer has not yet seen. A row counts when its
// `author` is not the viewer's `identity` AND its `createdAt` is strictly newer
// than `lastSeenAt` (the high-water mark the viewer marked on their last visit to
// the Changes tab). Self-authored rows never count; a row exactly at the marker
// (`createdAt === lastSeenAt`) is already seen, so the boundary is exclusive.
// `lastSeenAt` of 0 (never visited) counts every other-author row.
export function unseenOtherCount(
  changes: Pick<ManualChangeRow, "author" | "createdAt">[],
  identity: Identity,
  lastSeenAt: number,
): number {
  let count = 0;
  for (const row of changes) {
    if (row.author !== identity && row.createdAt > lastSeenAt) count += 1;
  }
  return count;
}

// The largest `createdAt` across the loaded feed, or 0 for an empty feed. Used as
// the seen high-water mark when the viewer opens the Changes tab: it marks "the
// newest thing present when I looked", which is robust to device/server clock
// skew (it reuses the server timestamps already on the rows rather than reading
// the device clock).
export function maxCreatedAt(changes: Pick<ManualChangeRow, "createdAt">[]): number {
  let max = 0;
  for (const row of changes) {
    if (row.createdAt > max) max = row.createdAt;
  }
  return max;
}

// The Changes-tab subtitle. With at least one edit this week it leads with the
// count ("3 changes to this week's menu"); with none it keeps the quiet
// zero-state line. Singular/plural on "change" so a single edit reads naturally.
// No internal label leaks (Principle 7).
export function changesSubtitle(count: number): string {
  if (count <= 0) return "Everything done to this week's menu";
  return `${count} ${count === 1 ? "change" : "changes"} to this week's menu`;
}

// The Menu summary line. A short, plain count of the week's menu changes, e.g.
// "3 swaps, 1 skip this week". Counts the manualChanges feed only (comments are
// feedback, not edits to the menu). Adds and custom one-offs both read as
// "added"; swaps as "swaps"; deletes as "removed"; skip/restore as "skips" /
// "restores". Returns the empty-state string when there are no changes. No
// internal label leaks (Principle 7).
export function deriveSummaryLine(changes: ManualChangeRow[]): string {
  if (changes.length === 0) return "No changes this week yet";
  const counts = { swap: 0, added: 0, removed: 0, skip: 0, restore: 0 };
  for (const row of changes) {
    switch (row.changeKind) {
      case "swap":
        counts.swap += 1;
        break;
      case "add":
      case "custom":
        counts.added += 1;
        break;
      case "delete":
        counts.removed += 1;
        break;
      case "skip_day":
        counts.skip += 1;
        break;
      case "restore_day":
        counts.restore += 1;
        break;
    }
  }
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (counts.swap) parts.push(plural(counts.swap, "swap", "swaps"));
  if (counts.added) parts.push(plural(counts.added, "dish added", "dishes added"));
  if (counts.removed) parts.push(plural(counts.removed, "dish deleted", "dishes deleted"));
  if (counts.skip) parts.push(plural(counts.skip, "skip", "skips"));
  if (counts.restore) parts.push(plural(counts.restore, "restore", "restores"));
  if (parts.length === 0) return "No changes this week yet";
  return `${parts.join(", ")} this week`;
}

export function FeedEntryCard({ entry }: { entry: FeedEntry }) {
  return (
    <Card className="change-entry">
      <Avatar who={entry.author} size={28} />
      <div className="change-entry__body">
        <div className="change-entry__headline">{entry.headline}</div>
        <div className="change-entry__meta">
          {authorName(entry.author)} &middot; {whenLabel(entry.createdAt)}
        </div>
        {entry.note && <div className="change-entry__note">&ldquo;{entry.note}&rdquo;</div>}
      </div>
    </Card>
  );
}

// The live changes feed for the current week: the two Convex subscriptions
// (manualChanges + queued comments) folded into a newest-first feed, plus the
// loading flag and the this-week menu-edit count. The Changes tab is gone; this
// feed now renders inside the Profile's Changes-log sheet (ChangesLogSheet), so
// the query wiring lives in a hook both the sheet and any future surface reuse.
export interface ChangesFeed {
  feed: FeedEntry[];
  loading: boolean;
  count: number;
}

export function useChangesFeed(): ChangesFeed {
  const week = useQuery(anyApi.queries.week.getCurrentWeek, {}) as CurrentWeek | null | undefined;
  const weekStart = week?.weekStart;

  // Only subscribe to the activity feed once we know the week. "skip" is the
  // Convex sentinel that holds a query off until its arg is ready.
  const changes = useQuery(
    anyApi.queries.activity.listManualChangesForWeek,
    weekStart ? { weekStart } : "skip",
  ) as ManualChangeRow[] | undefined;
  const comments = useQuery(anyApi.queries.comments.listQueuedComments, {}) as
    | CommentRow[]
    | undefined;

  const feed = useMemo(() => {
    if (!weekStart) return [];
    return buildFeed(changes ?? [], comments ?? [], weekStart);
  }, [changes, comments, weekStart]);

  const loading = week === undefined || (weekStart !== undefined && changes === undefined);

  return { feed, loading, count: changeCount(changes ?? []) };
}
