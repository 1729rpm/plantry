// Comment sheet. Shows the queued comments already attached to a target (a dish
// position or a whole day) and a composer to add another. Reached two ways:
// from the dish details sheet (dish-level) and from the Day screen's "Comment on
// this day" affordance (day-level). Both write via the 4.1 `addComment`
// mutation; comments change nothing now, they queue for the slow loop. Ported
// from the CommentSheet overlay in design_handoff/hifi-overlays.jsx.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { Identity, ShortDay } from "../lib/types.js";
import { dayLabel } from "../lib/days.js";
import { Sheet, Avatar, PrimaryButton } from "./primitives.js";

// The comment attaches to a dish position or the whole day. For a dish, the
// comment buckets by (day, dishId); a custom one-off has a null dishId and
// shares the (day, null) bucket with other one-offs in the day, matching the
// 4.1 schema and the slice-1 behaviour.
export type CommentTarget =
  | { kind: "dish"; weekStart: string; day: ShortDay; dishId: number | null; dishLabel: string }
  | { kind: "day"; weekStart: string; day: ShortDay };

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

interface PendingComment {
  localId: string;
  createdAt: number;
  author: Identity;
  text: string;
}

interface CommentSheetProps {
  target: CommentTarget;
  identity: Identity;
  onClose: () => void;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function authorName(author: Identity): string {
  return author === "rajat" ? "Rajat" : "Tuhina";
}

export function CommentSheet({ target, identity, onClose }: CommentSheetProps) {
  const all = useQuery(anyApi.queries.comments.listQueuedComments, {}) as CommentRow[] | undefined;
  const addComment = useMutation(anyApi.commentsMutations.addComment);

  const [text, setText] = useState<string>("");
  const [inFlight, setInFlight] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingComment[]>([]);

  // Server rows for this exact target, oldest first.
  const serverRows = useMemo(() => {
    const rows = (all ?? []).filter((c) => {
      const at = c.attachedTo;
      if (at.weekStart !== target.weekStart) return false;
      if (target.kind === "day") return at.kind === "day" && at.day === target.day;
      return at.kind === "dish" && at.day === target.day && at.dishId === target.dishId;
    });
    return rows.sort((a, b) => a.createdAt - b.createdAt);
  }, [all, target]);

  // Drop optimistic entries once a matching server row arrives.
  useEffect(() => {
    if (!all) return;
    setPending((prev) =>
      prev.filter((p) => !serverRows.some((s) => s.author === p.author && s.text === p.text)),
    );
  }, [all, serverRows]);

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !inFlight;

  async function handleSubmit() {
    if (!canSubmit) return;
    setInFlight(true);
    setError(null);
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPending((prev) => [
      ...prev,
      { localId, createdAt: Date.now(), author: identity, text: trimmed },
    ]);
    try {
      const attachedTo =
        target.kind === "dish"
          ? {
              kind: "dish" as const,
              weekStart: target.weekStart,
              day: target.day as string,
              dishId: target.dishId,
            }
          : {
              kind: "day" as const,
              weekStart: target.weekStart,
              day: target.day as string,
              dishId: null,
            };
      await addComment({ author: identity, attachedTo, text: trimmed });
      setText("");
    } catch (err) {
      console.error("addComment threw", err);
      setError("Could not save the comment. Try again.");
      setPending((prev) => prev.filter((p) => p.localId !== localId));
    } finally {
      setInFlight(false);
    }
  }

  const heading =
    target.kind === "dish" ? `Comments, ${target.dishLabel}` : `Comments, ${dayLabel(target.day)}`;

  const combined = [
    ...serverRows.map((r) => ({
      key: r._id,
      author: r.author,
      text: r.text,
      createdAt: r.createdAt,
    })),
    ...pending.map((p) => ({
      key: `pending-${p.localId}`,
      author: p.author,
      text: p.text,
      createdAt: p.createdAt,
    })),
  ];

  return (
    <Sheet onClose={onClose}>
      <div className="reason__title">{heading}</div>
      <div className="reason__hint">
        Comments change nothing now; they queue for the weekly review.
      </div>
      {combined.map((c) => (
        <div key={c.key} className="comment-entry">
          <Avatar who={c.author} size={26} />
          <div className="comment-entry__body">
            <div className="comment-entry__meta">
              {authorName(c.author)} &middot; {relativeTime(c.createdAt)}
            </div>
            <div className="comment-entry__text">{c.text}</div>
          </div>
        </div>
      ))}
      <textarea
        className="reason__text"
        rows={3}
        value={text}
        autoFocus
        aria-label="Comment"
        placeholder="e.g. too many gravies this day"
        onChange={(e) => setText(e.target.value)}
        disabled={inFlight}
      />
      {error && (
        <p className="reason__error" role="alert">
          {error}
        </p>
      )}
      <PrimaryButton onClick={handleSubmit} disabled={!canSubmit}>
        {inFlight ? "Adding..." : `Add comment as ${authorName(identity)}`}
      </PrimaryButton>
    </Sheet>
  );
}
