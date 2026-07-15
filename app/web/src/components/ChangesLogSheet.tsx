// Changes-log sheet. The record of everything done to this week's menu, moved
// out of the old Changes tab and into the Profile (the avatar on the Menu
// header opens the Profile; its "Changes to this week" row opens this). A tall
// bottom sheet (max-height 92%) rendering the same newest-first feed the tab
// showed: attributed entries, absolute timestamps, quoted reasons. The feed
// wiring lives in useChangesFeed; this file is the sheet chrome around it.

import { Sheet } from "./primitives.js";
import { FeedEntryCard, changesSubtitle, useChangesFeed } from "./ChangesScreen.js";

interface ChangesLogSheetProps {
  onClose: () => void;
}

export function ChangesLogSheet({ onClose }: ChangesLogSheetProps) {
  const { feed, loading, count } = useChangesFeed();
  const subtitle = changesSubtitle(count);

  return (
    <Sheet onClose={onClose} tall>
      <div className="reason__title">Changes</div>
      <div className="reason__hint">{subtitle}</div>
      {loading ? (
        <div className="empty-state">Loading changes...</div>
      ) : feed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__title">No changes yet</div>
          The week is as the menu was made. Every edit, with who made it and why, shows up here.
        </div>
      ) : (
        <div className="changes-log__list">
          {feed.map((entry) => (
            <FeedEntryCard key={entry.key} entry={entry} />
          ))}
        </div>
      )}
    </Sheet>
  );
}
