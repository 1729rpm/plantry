import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import { dishes } from "@plantry/engine/library";
import { dayLabel } from "../lib/days.js";
import type { Identity, ShortDay } from "../lib/types.js";

const DISH_NAME_BY_ID = new Map<number, string>(dishes.map((d) => [d.id, d.name]));

// Shape of the comment row mirrors the Convex schema. Kept locally so the
// frontend does not depend on Convex's generated types for this slice.
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
  status: "queued" | "in_review" | "applied" | "dismissed" | "reviewed_no_change";
}

interface CommentsListProps {
  weekStart: string;
  pendingLocal: PendingLocalComment[];
}

export interface PendingLocalComment {
  localId: string;
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

function attachedToLabel(row: { attachedTo: CommentRow["attachedTo"] }): string {
  const at = row.attachedTo;
  if (at.kind === "day") {
    return at.day ? dayLabel(at.day as ShortDay) : "this week";
  }
  const dayPart = at.day ? `${dayLabel(at.day as ShortDay)}: ` : "";
  const dishPart =
    at.dishId !== null ? (DISH_NAME_BY_ID.get(at.dishId) ?? `Dish #${at.dishId}`) : "custom dish";
  return `${dayPart}${dishPart}`;
}

function authorLabel(author: Identity): string {
  return author === "rajat" ? "Rajat" : "Tuhina";
}

export function CommentsList({ weekStart, pendingLocal }: CommentsListProps) {
  const all = useQuery(anyApi.queries.comments.listQueuedComments, {}) as
    | CommentRow[]
    | undefined;

  if (all === undefined && pendingLocal.length === 0) {
    return null;
  }

  const serverRows = (all ?? []).filter((c) => c.attachedTo.weekStart === weekStart);

  // De-duplicate optimistic rows against any server row with the same author,
  // attached-to triple, and text. The server is the source of truth once it
  // returns, so any pending entry that matches is folded in.
  const pendingToShow = pendingLocal.filter((p) => {
    return !serverRows.some(
      (s) =>
        s.author === p.author &&
        s.text === p.text &&
        s.attachedTo.kind === p.attachedTo.kind &&
        s.attachedTo.day === p.attachedTo.day &&
        s.attachedTo.dishId === p.attachedTo.dishId,
    );
  });

  const combined: Array<{
    key: string;
    createdAt: number;
    author: Identity;
    attachedTo: CommentRow["attachedTo"];
    text: string;
    optimistic: boolean;
  }> = [
    ...serverRows.map((r) => ({
      key: r._id,
      createdAt: r.createdAt,
      author: r.author,
      attachedTo: r.attachedTo,
      text: r.text,
      optimistic: false,
    })),
    ...pendingToShow.map((p) => ({
      key: `pending-${p.localId}`,
      createdAt: p.createdAt,
      author: p.author,
      attachedTo: p.attachedTo,
      text: p.text,
      optimistic: true,
    })),
  ];

  combined.sort((a, b) => a.createdAt - b.createdAt);

  if (combined.length === 0) {
    return null;
  }

  return (
    <section className="comments">
      <h3 className="comments__title">Comments for this week</h3>
      <ul className="comments__list">
        {combined.map((c) => (
          <li key={c.key} className="comment-row">
            <div className="comment-row__head">
              <span className="comment-row__author">{authorLabel(c.author)}</span>
              <span className="comment-row__attached">{attachedToLabel(c)}</span>
              <span className="comment-row__status">
                {c.optimistic ? "sending" : "queued"}
              </span>
            </div>
            <p className="comment-row__text">{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
