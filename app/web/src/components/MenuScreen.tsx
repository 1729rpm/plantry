// Menu screen: the shared current week. Ported from the MenuScreen layout in
// design_handoff/hifi-screens.jsx. Reads the live week from Convex
// (getCurrentWeek) with the slice-1 offline cache, renders one DayCard per day,
// a brand-led header (the Plantry serif wordmark, the week's full-month date
// range, and the identity avatar), and a Share button (share family is slice
// 8.1, so it is inert here). The week's change count lives on the Changes tab
// (its subtitle and nav badge), not here. Editing routes through onEditDay into
// the legacy editor.

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { anyApi } from "convex/server";
import type { CurrentWeek, Identity, ShortDay } from "../lib/types.js";
import { dayOrderIndex, dayStatus, weekRangeLabelLong } from "../lib/days.js";
import { getCachedWeek, setCachedWeek } from "../lib/storage.js";
import { Avatar, PrimaryButton } from "./primitives.js";
import { DayCard, type DayCardModel } from "./DayCard.js";
import { SharePreviewSheet } from "./SharePreviewSheet.js";
import { ProfileSheet } from "./ProfileSheet.js";
import { ChangesLogSheet } from "./ChangesLogSheet.js";

// True only when the device reports a genuinely offline network. Reactive via
// the browser online/offline events so a mid-session network drop flips it.
//
// We deliberately key the offline banner off this rather than off "the Convex
// query has not resolved yet". On a normal cold open the websocket is still
// reconnecting, so the cached week renders for a beat before live data lands;
// keying the banner off the unresolved query made it flash on every online
// open. navigator.onLine is synchronous on first paint, so the cached week
// renders silently while online and the banner shows immediately when the
// phone is actually offline (no flash either way).
function useIsOffline(): boolean {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    // Re-sync once on mount in case the state changed between the lazy
    // initializer and this effect running.
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline;
}

interface MenuScreenProps {
  identity: Identity;
  onSwitchIdentity: () => void;
  // The chosen day routes into editing. The legacy editor (this slice) renders
  // the whole week and ignores the argument; slice 5.2's Day screen uses it.
  onEditDay: (day: ShortDay) => void;
  // The unread-changes nudge, shown as a badge on the header avatar (relocated
  // off the retired Changes tab). Hidden at zero.
  unreadChanges: number;
  // This week's total menu-edit count, shown as the Profile's Changes-log hint.
  changeCount: number;
  // Advance the seen high-water mark; called when the Changes-log sheet opens.
  onChangesSeen: () => void;
}

function buildDayModels(week: CurrentWeek): DayCardModel[] {
  const skipReasonByDay = new Map<ShortDay, string>();
  for (const skip of week.skippedDays ?? []) {
    skipReasonByDay.set(skip.day, skip.reason);
  }
  const slotsByDay = new Map<ShortDay, CurrentWeek["slots"]>();
  for (const slot of week.slots) {
    const list = slotsByDay.get(slot.day) ?? [];
    list.push(slot);
    slotsByDay.set(slot.day, list);
  }
  const days = new Set<ShortDay>([...slotsByDay.keys(), ...skipReasonByDay.keys()]);
  return [...days]
    .sort((a, b) => dayOrderIndex(a) - dayOrderIndex(b))
    .map((day) => ({
      day,
      slots: slotsByDay.get(day) ?? [],
      skipReason: skipReasonByDay.get(day) ?? null,
    }));
}

function MenuBody({
  week,
  identity,
  offline,
  onSwitchIdentity,
  onEditDay,
  unreadChanges,
  changeCount,
  onChangesSeen,
}: {
  week: CurrentWeek;
  identity: Identity;
  offline: boolean;
  onSwitchIdentity: () => void;
  onEditDay: (day: ShortDay) => void;
  unreadChanges: number;
  changeCount: number;
  onChangesSeen: () => void;
}) {
  const models = useMemo(() => buildDayModels(week), [week]);

  const [shareOpen, setShareOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);

  function openChanges() {
    setProfileOpen(false);
    setChangesOpen(true);
    onChangesSeen();
  }

  return (
    <>
      <div className="screen__scroll">
        <div className="screen__header">
          <div className="menu__head-row">
            {/* Brand-led header: the Plantry serif wordmark with the week's
                full-month date range beneath it. The avatar opens the Profile
                sheet (switch user + the Changes log) and carries the relocated
                unread-changes nudge badge. */}
            <h1 className="menu__brand">Plantry</h1>
            <button
              type="button"
              className="menu__switch"
              aria-label="Profile"
              onClick={() => setProfileOpen(true)}
            >
              <span className="menu__avatar-wrap">
                <Avatar who={identity} size={30} />
                {unreadChanges > 0 && (
                  <span className="menu__avatar-badge" aria-hidden="true">
                    {unreadChanges}
                  </span>
                )}
              </span>
            </button>
          </div>
          <div className="menu__subtitle">{weekRangeLabelLong(week.weekStart)} menu</div>
        </div>
        {offline && (
          <div className="offline-banner">Showing the last menu saved on this phone.</div>
        )}
        <div className="screen__list">
          {models.map((model) => (
            <DayCard
              key={model.day}
              model={model}
              weekStart={week.weekStart}
              status={dayStatus(week.weekStart, model.day)}
              onEdit={offline ? undefined : () => onEditDay(model.day)}
            />
          ))}
        </div>
      </div>
      <div className="screen__footer">
        {/* Share opens the swipe-rail preview, which renders the image family
            (the menu image, then one recipe sheet per included dish) and sends
            them via the OS share sheet. The family is a pure function of the
            week, so Share works offline from the cached week (it no longer needs
            a live grocery query). */}
        <PrimaryButton onClick={() => setShareOpen(true)}>Share this week</PrimaryButton>
      </div>
      {shareOpen && <SharePreviewSheet week={week} onClose={() => setShareOpen(false)} />}
      {profileOpen && (
        <ProfileSheet
          identity={identity}
          changeCount={changeCount}
          onSwitch={onSwitchIdentity}
          onOpenChanges={openChanges}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {changesOpen && <ChangesLogSheet onClose={() => setChangesOpen(false)} />}
    </>
  );
}

export function MenuScreen({
  identity,
  onSwitchIdentity,
  onEditDay,
  unreadChanges,
  changeCount,
  onChangesSeen,
}: MenuScreenProps) {
  const result = useQuery(anyApi.queries.week.getCurrentWeek, {}) as CurrentWeek | null | undefined;
  const offline = useIsOffline();

  const cached = useMemo(() => getCachedWeek(), []);

  useEffect(() => {
    if (result) {
      setCachedWeek({ cachedAt: Date.now(), week: result });
    }
  }, [result]);

  if (result === undefined) {
    if (cached) {
      // The live query has not resolved. Render the cached week so a returning
      // user sees their menu instantly. The offline banner and the disabled
      // Edit/Share affordances follow the real offline signal, not this load
      // window, so a normal online open shows the cached week silently and a
      // genuinely offline open shows it labelled.
      return (
        <MenuBody
          week={cached.week}
          identity={identity}
          offline={offline}
          onSwitchIdentity={onSwitchIdentity}
          onEditDay={onEditDay}
          unreadChanges={unreadChanges}
          changeCount={changeCount}
          onChangesSeen={onChangesSeen}
        />
      );
    }
    return (
      <div className="screen__scroll">
        <div className="screen__header">
          <h1 className="menu__brand">Plantry</h1>
        </div>
        <div className="empty-state">Loading menu...</div>
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="screen__scroll">
        <div className="screen__header">
          <h1 className="menu__brand">Plantry</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state__title">No menu yet</div>
          The first weekly menu will appear here.
        </div>
      </div>
    );
  }

  // Live data resolved. The banner and the disabled Edit/Share still track the
  // real offline signal: if the network drops while the user is on this live
  // menu, Convex serves the last value but writes would fail, so the same
  // honest offline affordance applies.
  return (
    <MenuBody
      week={result}
      identity={identity}
      offline={offline}
      onSwitchIdentity={onSwitchIdentity}
      onEditDay={onEditDay}
      unreadChanges={unreadChanges}
      changeCount={changeCount}
      onChangesSeen={onChangesSeen}
    />
  );
}
