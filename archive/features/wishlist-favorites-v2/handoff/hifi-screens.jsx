// Plantry composed screens. Overlays (sheets, dialogs) live in hifi-overlays.jsx.
const { useState } = React;
const ST = window.PT;

function ScreenShell({ children }) {
  return <div style={{ height: '100%', background: ST.color.bg, display: 'flex', flexDirection: 'column', fontFamily: ST.font.sans, color: ST.color.ink, position: 'relative', overflow: 'hidden' }}>{children}</div>;
}

// ---------- Passcode gate (six digit household code, auto submits on the sixth) ----------
function GateScreen({ onUnlock }) {
  const [code, setCode] = useState('');
  const press = (k) => {
    setCode((prev) => {
      if (k === 'del') return prev.slice(0, -1);
      if (prev.length >= 6) return prev;
      const next = prev + k;
      if (next.length === 6) setTimeout(() => onUnlock(), 250);
      return next;
    });
  };
  return (
    <ScreenShell>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: ST.font.serif, fontSize: 30, fontWeight: 700 }}>Plantry</div>
          <div style={{ fontSize: 14, color: ST.color.sub, marginTop: 6 }}>Enter the kitchen passcode</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ width: 13, height: 13, borderRadius: 999, background: i < code.length ? ST.color.accent : 'transparent', border: '1.5px solid ' + (i < code.length ? ST.color.accent : ST.color.line) }}></span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => (
            k === '' ? <span key={i}></span> :
            <button key={i} onClick={() => press(k)} style={{ height: 64, borderRadius: 999, background: ST.color.surface, border: '1px solid ' + ST.color.line, fontSize: k === 'del' ? 13 : 22, fontFamily: ST.font.serif, fontWeight: 600, textAlign: 'center', color: k === 'del' ? ST.color.sub : ST.color.ink }}>{k === 'del' ? 'Delete' : k}</button>
          ))}
        </div>
      </div>
    </ScreenShell>
  );
}

// ---------- Identity picker ----------
function IdentityScreen({ onPick }) {
  return (
    <ScreenShell>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontFamily: ST.font.serif, fontSize: 26, fontWeight: 700 }}>Please select the user</div>
          <div style={{ fontSize: 14, color: ST.color.sub, marginTop: 6 }}>Edits carry your name</div>
        </div>
        {['Rajat', 'Tuhina'].map((who) => (
          <button key={who} onClick={() => onPick(who)} style={{ background: ST.color.surface, border: '1px solid ' + ST.color.line, borderRadius: ST.radius.card, padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <window.Avatar who={who} size={44} />
            <div style={{ fontFamily: ST.font.serif, fontSize: 19, fontWeight: 600 }}>I am {who}</div>
          </button>
        ))}
      </div>
    </ScreenShell>
  );
}

// ---------- Change summary line (Menu header) ----------
// Aggregates this week's fast-loop actions by type, in a fixed order.
const SUMMARY_ORDER = [
  { kinds: ['swap'], one: 'swap', many: 'swaps' },
  { kinds: ['add', 'use'], one: 'dish added', many: 'dishes added' },
  { kinds: ['oneoff'], one: 'one off', many: 'one offs' },
  { kinds: ['delete'], one: 'dish deleted', many: 'dishes deleted' },
  { kinds: ['skip'], one: 'skip', many: 'skips' },
  { kinds: ['restore'], one: 'restore', many: 'restores' },
  { kinds: ['wishlist'], one: 'wishlisted', many: 'wishlisted' },
  { kinds: ['favorite'], one: 'favorite added', many: 'favorites added' },
];
function summarize(activity) {
  const parts = [];
  SUMMARY_ORDER.forEach((g) => {
    const n = activity.filter((a) => g.kinds.includes(a.kind)).length;
    if (n > 0) parts.push(`${n} ${n === 1 ? g.one : g.many}`);
  });
  return parts;
}
function ChangeSummary({ activity, onOpen }) {
  if (!activity || activity.length === 0) {
    return <div style={{ fontSize: 13.5, color: ST.color.sub, marginTop: 10, lineHeight: 1.45 }}>No changes this week yet</div>;
  }
  const parts = summarize(activity);
  const text = parts.length ? parts.join(', ') + ' this week' : activity.length + ' changes this week';
  return (
    <button onClick={onOpen} style={{ display: 'block', marginTop: 10, textAlign: 'left' }}>
      <span style={{ fontSize: 13.5, color: ST.color.sub, lineHeight: 1.45 }}>{text}</span>
    </button>
  );
}

// ---------- Menu, the current week ----------
// Today is June 17 (Wednesday). Days before today collapse so attention lands on
// the current day; today is marked; upcoming days stay open.
const TODAY = 17;
function MenuScreen({ week, activity, identity, onTab, onShare, onOpenDay, onProfile }) {
  const { DayCard, Avatar, PrimaryButton } = window;
  return (
    <ScreenShell>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} data-screen-label="Menu, current week">
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: ST.font.serif, fontSize: 30, fontWeight: 700, lineHeight: 1.1 }}>Plantry</div>
              <div style={{ fontSize: 14, color: ST.color.sub, marginTop: 4, whiteSpace: 'nowrap' }}>June 15 to June 20 menu</div>
            </div>
            <button onClick={onProfile} aria-label="Profile" style={{ flexShrink: 0, marginTop: 2 }}><Avatar who={identity} size={30} /></button>
          </div>
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {week.map((day) => {
            const collapsed = day.date < TODAY;
            const today = day.date === TODAY;
            return collapsed
              ? <DayCard key={day.id} day={day} collapsed onView={() => onOpenDay(day.id)} />
              : <DayCard key={day.id} day={day} showImages today={today} onEdit={() => onOpenDay(day.id)} />;
          })}
        </div>
      </div>
      <div style={{ padding: '10px 16px 12px', flexShrink: 0 }}>
        <PrimaryButton onClick={onShare}>Share menu</PrimaryButton>
      </div>
      <window.TabBar active="Menu" onTab={onTab} />
    </ScreenShell>
  );
}

// ---------- One day, opened from a Menu day card ----------
function DayScreen({ day, onBack, onDishMenu, onDishDetails, onAddDish, onSkipDay, onRestoreDay, onFruitSwap, onComment, onTab }) {
  const { Card, DishRow, FruitRow, SectionLabel, PrimaryButton } = window;
  const [note, setNote] = useState('');
  const meals = [['Breakfast', 'breakfast'], ['Lunch', 'lunch']].filter(([, m]) => day[m].length > 0);
  return (
    <ScreenShell>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} data-screen-label={'Day, ' + day.day}>
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} aria-label="Back" style={{ fontSize: 24, color: ST.color.sub, minWidth: 44, minHeight: 44, textAlign: 'left' }}>‹</button>
          <div>
            <div style={{ fontFamily: ST.font.serif, fontSize: 22, fontWeight: 700, whiteSpace: 'nowrap' }}>{day.day}, Jun {day.date}</div>
            <div style={{ fontSize: 13, color: ST.color.sub, marginTop: 2 }}>Changes apply to this week right away</div>
          </div>
        </div>
        {day.skipped ? (
          <div style={{ padding: '6px 16px 16px' }}>
            <Card style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: ST.font.serif, fontSize: 20, fontWeight: 700 }}>This day is skipped</div>
              <div style={{ fontSize: 14, color: ST.color.sub, marginTop: 6 }}>"{day.skipped.reason}"</div>
              <div style={{ fontSize: 12.5, color: ST.color.sub, marginTop: 4 }}>No dishes, no groceries counted for it.</div>
              <PrimaryButton onClick={onRestoreDay} style={{ marginTop: 16 }}>Restore this day</PrimaryButton>
            </Card>
          </div>
        ) : (
          <div style={{ padding: '6px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {meals.map(([label, m]) => (
              <Card key={m} style={{ padding: '14px 16px' }}>
                <SectionLabel>{label}</SectionLabel>
                {day[m].map((e, i) => (
                  <DishRow key={i} entry={e} onClick={() => (e.key ? onDishDetails(day.id, m, i) : onDishMenu(day.id, m, i))}
                    trailing={<button onClick={(ev) => { ev.stopPropagation(); onDishMenu(day.id, m, i); }} aria-label="Dish actions" style={{ color: ST.color.sub, fontSize: 20, minWidth: 44, minHeight: 44 }}>⋯</button>} />
                ))}
              </Card>
            ))}
            {day.fruit && (
              <Card style={{ padding: '14px 16px' }}>
                <SectionLabel>Fruit of the day</SectionLabel>
                <FruitRow fruitKey={day.fruit} onClick={() => onFruitSwap(day.id)}
                  trailing={<span style={{ fontSize: 12.5, fontWeight: 600, color: ST.color.accent, fontFamily: ST.font.sans }}>Swap</span>} />
              </Card>
            )}
            <button onClick={onAddDish} style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: ST.color.accent, border: '1.5px dashed ' + ST.color.accent, borderRadius: ST.radius.control, padding: '12px 0', minHeight: 48 }}>Add a dish</button>
            <button onClick={onSkipDay} style={{ textAlign: 'center', fontSize: 14, fontWeight: 600, color: ST.color.danger, border: '1px solid ' + ST.color.dangerLine, borderRadius: ST.radius.control, padding: '12px 0', minHeight: 48, background: ST.color.surface }}>Skip this day</button>
            <Card style={{ padding: '14px 16px' }}>
              <SectionLabel style={{ color: ST.color.sub, marginBottom: 8 }}>Note for the weekly review</SectionLabel>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Leave a comment about this day. It changes nothing now; it queues for the review." rows={2}
                style={{ width: '100%', background: ST.color.bg, border: '1px solid ' + ST.color.line, borderRadius: 12, padding: '10px 12px', fontSize: 14.5, fontFamily: ST.font.sans, color: ST.color.ink, outline: 'none', resize: 'none' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => { if (note.trim()) { onComment(note.trim()); setNote(''); } }} style={{ fontSize: 13.5, fontWeight: 600, color: ST.color.onAccent, background: ST.color.accent, borderRadius: 999, padding: '8px 18px', fontFamily: ST.font.sans, minHeight: 36, opacity: note.trim() ? 1 : 0.4 }}>Post comment</button>
              </div>
            </Card>
          </div>
        )}
      </div>
      <window.TabBar active="Menu" onTab={onTab} />
    </ScreenShell>
  );
}

// ---------- Grocery (forward looking) ----------
// The buy list is for the days still ahead. A day that is over drops out of the
// list entirely; today is optional, off by default once it is past 11 AM (the
// run is assumed done), and can be added back with one toggle.
function fmtTime(h, m) {
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ':' + String(m).padStart(2, '0') + ' ' + ap;
}

// Day selector. Every day of the week is a chip. Days that have passed (or are
// skipped) are disabled and struck through; the rest toggle on tap. Today and
// tomorrow get relative tags so the choice reads in plain language.
function DaySelect({ week, selected, onToggle }) {
  const NOW = window.PlantryData.NOW;
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {week.map((d) => {
        const past = d.date < NOW.date;
        const skipped = !!d.skipped;
        const disabled = past || skipped;
        const on = selected.includes(d.id) && !disabled;
        const tag = d.date === NOW.date ? 'Today' : (d.date === NOW.date + 1 ? 'Tom' : d.short);
        let bg = ST.color.surface, border = ST.color.line, color = ST.color.ink, opacity = 1;
        if (disabled) { bg = ST.color.bg; color = ST.color.sub; opacity = 0.5; }
        else if (on) { bg = ST.color.accentSoft; border = ST.color.accent; color = ST.color.accent; }
        return (
          <button key={d.id} disabled={disabled} onClick={() => onToggle(d.id)} aria-pressed={on}
            style={{ flex: 1, position: 'relative', textAlign: 'center', borderRadius: 12, padding: '8px 0 7px',
              background: bg, border: '1.5px solid ' + (on ? ST.color.accent : border), opacity, cursor: disabled ? 'default' : 'pointer' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: on ? ST.color.accent : ST.color.sub, fontWeight: 700 }}>{tag}</div>
            <div style={{ fontFamily: ST.font.serif, fontSize: 18, fontWeight: 600, lineHeight: 1.2, color, textDecoration: disabled ? 'line-through' : 'none' }}>{d.date}</div>
          </button>
        );
      })}
    </div>
  );
}

function GroceryScreen({ week, onTab }) {
  const { Card, SectionLabel } = window;
  const PD = window.PlantryData;
  const NOW = PD.NOW;
  const days = week || PD.WEEK;
  const late = NOW.hour >= 11; // after 11 AM today's run is assumed done

  // Selectable = today and later, not skipped. Default to two days: today and
  // tomorrow before 11 AM, tomorrow and the day after once it is past 11.
  const selectable = days.filter((d) => d.date >= NOW.date && !d.skipped);
  const defaultSel = (late ? selectable.filter((d) => d.date > NOW.date) : selectable).slice(0, 2).map((d) => d.id);
  const [selected, setSelected] = useState(defaultSel);
  const toggle = (id) => {
    const d = days.find((x) => x.id === id);
    if (!d || d.date < NOW.date || d.skipped) return;
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const chosen = days.filter((d) => selected.includes(d.id) && !d.skipped).sort((a, b) => a.date - b.date);
  const base = PD.computeGrocery(chosen);
  const range = chosen.length === 1
    ? chosen[0].short + ' ' + chosen[0].date
    : chosen.length ? chosen[0].short + ' ' + chosen[0].date + ' to ' + chosen[chosen.length - 1].short + ' ' + chosen[chosen.length - 1].date : null;

  const row = (it, last) => (
    <div key={it.name} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: last ? 'none' : '1px solid ' + ST.color.line }}>
      <span style={{ fontSize: 14.5, color: ST.color.ink }}>{it.name}</span>
      <span style={{ fontSize: 13.5, color: ST.color.sub, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{it.qty}</span>
    </div>
  );

  return (
    <ScreenShell>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} data-screen-label="Grocery">
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px 12px' }}>
          <div style={{ fontFamily: ST.font.serif, fontSize: 26, fontWeight: 700 }}>Grocery</div>
          <div style={{ fontSize: 13.5, color: ST.color.sub, marginTop: 2 }}>{chosen.length ? <span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{base.count} items</span> for {range}</span> : 'Pick the days you want to order for'}</div>
        </div>

        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionLabel>Order for</SectionLabel>
          <DaySelect week={days} selected={selected} onToggle={toggle} />
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {base.groups.length === 0 ? (
            <Card style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: ST.font.serif, fontSize: 19, fontWeight: 700 }}>Pick a day to order</div>
              <div style={{ fontSize: 13.5, color: ST.color.sub, marginTop: 6, lineHeight: 1.5 }}>Tap the days above and we'll total up exactly what to buy.</div>
            </Card>
          ) : base.groups.map((g) => (
            <Card key={g.group} style={{ padding: '12px 16px 2px' }}>
              <SectionLabel style={{ marginBottom: 2 }}>{g.group}</SectionLabel>
              {g.items.map((it, i) => row(it, i === g.items.length - 1))}
            </Card>
          ))}
        </div>
      </div>
      <window.TabBar active="Grocery" onTab={onTab} />
    </ScreenShell>
  );
}

// ---------- Yours: the household's favorites and wishlist ----------
// Favorites are pinned into every generated week; the wishlist is a shared
// to-try list. Both are household lists with entries attributed by name.
function YoursScreen({ lists, onAddFavorite, onRemoveFavorite, onOpenWishDish, onUseWishDish, onRemoveWishDish, onTab }) {
  const { Card, SectionLabel, Thumb } = window;
  const D = window.PlantryData.DISHES;
  const nameOf = (e) => (e.key ? D[e.key].name : e.custom);
  const removeBtn = (onClick) => (
    <button onClick={onClick} aria-label="Remove" style={{ color: ST.color.sub, fontSize: 18, minWidth: 44, minHeight: 44, flexShrink: 0 }}>×</button>
  );
  return (
    <ScreenShell>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} data-screen-label="Yours">
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px 12px' }}>
          <div style={{ fontFamily: ST.font.serif, fontSize: 26, fontWeight: 700 }}>Yours</div>
          <div style={{ fontSize: 13.5, color: ST.color.sub, marginTop: 2 }}>The household's favorites and wishlist</div>
        </div>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <SectionLabel style={{ marginBottom: 8 }}>Your favorites</SectionLabel>
            <Card style={{ padding: lists.favorites.length ? '4px 16px' : '20px 16px' }}>
              {lists.favorites.length === 0 && (
                <div style={{ fontSize: 13.5, color: ST.color.sub, lineHeight: 1.5, textAlign: 'center' }}>No favorites yet. A favorite gets a place in every week's menu.</div>
              )}
              {lists.favorites.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i === lists.favorites.length - 1 ? 'none' : '1px solid ' + ST.color.line }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: ST.font.serif, fontSize: 16.5, fontWeight: 600 }}>{nameOf(f)}</div>
                    <div style={{ fontSize: 12.5, color: ST.color.sub, marginTop: 2 }}>Added by {f.who} · in every week's menu</div>
                  </div>
                  {removeBtn(() => onRemoveFavorite(i))}
                </div>
              ))}
            </Card>
            <button onClick={onAddFavorite} style={{ width: '100%', textAlign: 'center', fontSize: 14, fontWeight: 600, color: ST.color.accent, border: '1.5px dashed ' + ST.color.accent, borderRadius: ST.radius.control, padding: '12px 0', minHeight: 48, marginTop: 10 }}>Add a favorite</button>
          </div>
          <div>
            <SectionLabel style={{ marginBottom: 8 }}>Your wishlist</SectionLabel>
            <Card style={{ padding: lists.wishlist.length ? '4px 16px' : '20px 16px' }}>
              {lists.wishlist.length === 0 && (
                <div style={{ fontSize: 13.5, color: ST.color.sub, lineHeight: 1.5, textAlign: 'center' }}>Nothing on the wishlist. Mark a dish from Explore or any dish page.</div>
              )}
              {lists.wishlist.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: i === lists.wishlist.length - 1 ? 'none' : '1px solid ' + ST.color.line }}>
                  <button onClick={() => onOpenWishDish(w.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <Thumb src={D[w.key].img} size={44} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: ST.font.serif, fontSize: 16.5, fontWeight: 600 }}>{D[w.key].name}</div>
                      <div style={{ fontSize: 12.5, color: ST.color.sub, marginTop: 2 }}>Added by {w.who}</div>
                    </div>
                  </button>
                  <button onClick={() => onUseWishDish(w.key)} style={{ fontSize: 13, fontWeight: 600, color: ST.color.accent, border: '1px solid ' + ST.color.accent, borderRadius: 999, padding: '7px 14px', minHeight: 34, flexShrink: 0 }}>Use</button>
                  {removeBtn(() => onRemoveWishDish(i))}
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
      <window.TabBar active="Yours" onTab={onTab} />
    </ScreenShell>
  );
}

// ---------- Explore filter (nested: two quick toggles, two multi-select panels) ----------
function FilterChip({ label, active, caret, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, borderRadius: ST.radius.pill, padding: '8px 14px',
      fontFamily: ST.font.sans, whiteSpace: 'nowrap', flexShrink: 0,
      background: active ? ST.color.accent : ST.color.surface,
      color: active ? ST.color.onAccent : ST.color.ink,
      border: '1px solid ' + (active ? ST.color.accent : ST.color.line),
    }}>
      {label}
      {caret && <span style={{ fontSize: 9, opacity: 0.8, transform: 'translateY(1px)' }}>▾</span>}
    </button>
  );
}

// A multi-select panel: each option shows its dish count; Apply commits.
function FilterPanel({ title, options, counts, selected, onApply, onClose }) {
  const [pending, setPending] = useState(selected);
  const toggle = (o) => setPending(pending.includes(o) ? pending.filter((x) => x !== o) : [...pending, o]);
  return (
    <div style={{ background: ST.color.surface, border: '1px solid ' + ST.color.line, borderRadius: ST.radius.card, padding: '12px 14px', margin: '0 16px 6px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {options.map((o) => {
          const on = pending.includes(o);
          const n = counts[o] || 0;
          return (
            <button key={o} onClick={() => toggle(o)} disabled={n === 0 && !on} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 2px', minHeight: 44, opacity: n === 0 && !on ? 0.4 : 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 20, height: 20, borderRadius: 6, border: '1.5px solid ' + (on ? ST.color.accent : ST.color.line), background: on ? ST.color.accent : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: ST.color.onAccent, fontSize: 13, fontWeight: 700 }}>{on ? '✓' : ''}</span>
                <span style={{ fontSize: 15, color: ST.color.ink }}>{o}</span>
              </span>
              <span style={{ fontSize: 13, color: ST.color.sub }}>{n}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => { setPending([]); }} style={{ fontSize: 13.5, fontWeight: 600, color: ST.color.sub, padding: '10px 4px' }}>Clear</button>
        <div style={{ flex: 1 }}></div>
        <window.PrimaryButton onClick={() => onApply(pending)} style={{ width: 'auto', padding: '10px 22px', fontSize: 14 }}>Apply</window.PrimaryButton>
      </div>
    </div>
  );
}

// ---------- Explore ----------
function ExploreScreen({ history, wishlist, onToggleWishlist, onOpenDish, onTab }) {
  const wished = new Set((wishlist || []).map((w) => w.key));
  const D = window.PlantryData.DISHES;
  const WHY = window.PlantryData.EXPLORE_WHY;
  const CUISINES = window.PlantryData.CUISINES;
  const [easy, setEasy] = useState(false);
  const [healthy, setHealthy] = useState(false);
  const [cuisines, setCuisines] = useState([]);
  const [meals, setMeals] = useState([]);
  const [panel, setPanel] = useState(null); // 'cuisines' | 'meal' | null

  const never = Object.keys(D).filter((k) => D[k].lastCooked === 'Never' && !history.includes(k));
  const ranked = [...never].sort((a, b) => (Object.keys(WHY).indexOf(a) + 99 * (Object.keys(WHY).indexOf(a) < 0)) - (Object.keys(WHY).indexOf(b) + 99 * (Object.keys(WHY).indexOf(b) < 0)));

  // AND across dimensions, OR within a dimension.
  const passes = (k, opts) => {
    const d = D[k];
    if (opts.easy && d.complexity !== 'Easy') return false;
    if (opts.healthy && !d.healthy) return false;
    if (opts.cuisines.length && !opts.cuisines.includes(d.cuisine)) return false;
    if (opts.meals.length && !opts.meals.includes(d.meal)) return false;
    return true;
  };
  const full = { easy, healthy, cuisines, meals };
  const visible = ranked.filter((k) => passes(k, full));

  // Counts for a panel option are computed with the OTHER dimensions applied.
  const countFor = (dim, value) => {
    const opts = Object.assign({}, full);
    opts[dim] = [value];
    return ranked.filter((k) => passes(k, opts)).length;
  };
  const cuisineCounts = {}; CUISINES.forEach((c) => cuisineCounts[c] = countFor('cuisines', c));
  const mealCounts = { Breakfast: countFor('meals', 'Breakfast'), Lunch: countFor('meals', 'Lunch') };

  return (
    <ScreenShell>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} data-screen-label="Explore">
        <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 24px) 20px 10px' }}>
          <div style={{ fontFamily: ST.font.serif, fontSize: 26, fontWeight: 700 }}>Explore</div>
          <div style={{ fontSize: 13.5, color: ST.color.sub, marginTop: 2 }}>{visible.length} dishes you have not cooked yet</div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '4px 16px 10px', overflowX: 'auto' }}>
          <FilterChip label="Easy to cook" active={easy} onClick={() => { setEasy(!easy); setPanel(null); }} />
          <FilterChip label="Healthy" active={healthy} onClick={() => { setHealthy(!healthy); setPanel(null); }} />
          <FilterChip label={cuisines.length ? `Cuisines · ${cuisines.length}` : 'Cuisines'} caret active={cuisines.length > 0 || panel === 'cuisines'} onClick={() => setPanel(panel === 'cuisines' ? null : 'cuisines')} />
          <FilterChip label={meals.length ? `Meal time · ${meals.length}` : 'Meal time'} caret active={meals.length > 0 || panel === 'meal'} onClick={() => setPanel(panel === 'meal' ? null : 'meal')} />
        </div>
        {panel === 'cuisines' && (
          <FilterPanel title="Cuisines" options={CUISINES} counts={cuisineCounts} selected={cuisines}
            onApply={(sel) => { setCuisines(sel); setPanel(null); }} onClose={() => setPanel(null)} />
        )}
        {panel === 'meal' && (
          <FilterPanel title="Meal time" options={['Breakfast', 'Lunch']} counts={mealCounts} selected={meals}
            onApply={(sel) => { setMeals(sel); setPanel(null); }} onClose={() => setPanel(null)} />
        )}
        <div style={{ padding: '2px 16px', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: ST.color.sub, marginBottom: 8 }}>Close to your usual, new on the plate</div>
        {visible.length === 0 && <div style={{ padding: '24px 16px', color: ST.color.sub, fontSize: 14 }}>Nothing matches these filters this season.</div>}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
          {visible.map((k) => {
            const d = D[k];
            const on = wished.has(k);
            return (
              <div key={k} style={{ background: ST.color.surface, borderRadius: 16, border: '1px solid ' + ST.color.line, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <button onClick={() => onOpenDish(k)} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <div style={{ width: '100%', aspectRatio: '16 / 9', overflow: 'hidden' }}>
                    <img src={d.img} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                  <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontFamily: ST.font.serif, fontSize: 16, fontWeight: 600, lineHeight: 1.2, paddingRight: 2 }}>{d.name}</div>
                    <window.DishPills d={d} />
                  </div>
                </button>
                <button onClick={() => onToggleWishlist(k)} aria-label={on ? 'Remove from wishlist' : 'Mark as wishlist'} aria-pressed={on}
                  style={{ position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: 999, background: ST.color.surface, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(44,36,27,0.22)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? ST.color.accent : 'none'} stroke={on ? ST.color.accent : ST.color.sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19.5s-6.8-4.4-8.9-8.4C1.7 8.2 3.5 5.2 6.6 5.2c1.9 0 3.3 1 4.1 2.3L12 9.2l1.3-1.7c.8-1.3 2.2-2.3 4.1-2.3 3.1 0 4.9 3 3.5 5.9-2.1 4-8.9 8.4-8.9 8.4Z" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <window.TabBar active="Explore" onTab={onTab} />
    </ScreenShell>
  );
}

Object.assign(window, { ScreenShell, GateScreen, IdentityScreen, ChangeSummary, summarize, MenuScreen, DayScreen, GroceryScreen, YoursScreen, FilterChip, FilterPanel, ExploreScreen });
