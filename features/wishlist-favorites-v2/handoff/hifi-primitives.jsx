// Plantry shared primitives. Everything reads tokens from window.PT.
const { useState, useEffect, useRef } = React;
const T = window.PT;

function Avatar({ who, size }) {
  const s = size || 24;
  return (
    <span style={{ width: s, height: s, borderRadius: 999, background: T.color.accentSoft, color: T.color.accent, fontSize: s * 0.48, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font.sans, flexShrink: 0 }}>{who ? who[0] : '?'}</span>
  );
}

function SectionLabel({ children, color, style }) {
  return <div style={Object.assign({ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: color || T.color.green, fontWeight: 600, fontFamily: T.font.sans }, style)}>{children}</div>;
}

function Chip({ children, active, danger, onClick, style }) {
  return (
    <button onClick={onClick} style={Object.assign({
      fontSize: 13, fontWeight: 600, borderRadius: T.radius.pill, padding: '8px 14px', fontFamily: T.font.sans, whiteSpace: 'nowrap',
      background: active ? T.color.accent : T.color.surface,
      color: danger ? T.color.danger : active ? T.color.onAccent : T.color.ink,
      border: '1px solid ' + (active ? T.color.accent : T.color.line),
    }, style)}>{children}</button>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} aria-pressed={on} style={{ width: 42, height: 25, borderRadius: 999, background: on ? T.color.green : T.color.line, position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 19, height: 19, borderRadius: 999, background: '#FFF', transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}></span>
    </button>
  );
}

function Thumb({ src, size, radius }) {
  return src
    ? <img src={src} style={{ width: size || 48, height: size || 48, borderRadius: radius || T.radius.thumb, objectFit: 'cover', flexShrink: 0 }} />
    : <span style={{ width: size || 48, height: size || 48, borderRadius: radius || T.radius.thumb, flexShrink: 0, background: 'repeating-linear-gradient(45deg, #EFE8DB, #EFE8DB 6px, #E7DFD0 6px, #E7DFD0 12px)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: T.color.sub, fontSize: 16, fontFamily: T.font.serif }}>+</span>;
}

// Rounded tile standing in for a fruit photo at full dish-row weight.
// (Live carries a real fruit photo here; the tile is the no-photo stand-in.)
function FruitTile({ color, size, radius }) {
  const s = size || 48;
  return <span style={{ width: s, height: s, borderRadius: radius || T.radius.thumb, flexShrink: 0, background: color || T.color.greenSoft, border: '1px solid rgba(44,36,27,0.06)' }}></span>;
}

// ---------- Pills ----------
// Concise colored difficulty pill (Easy / Medium / Hard).
function DifficultyPill({ level, style }) {
  const map = { Easy: [T.color.green, T.color.greenSoft], Medium: ['#8A6D3B', '#F2E8D5'], Hard: [T.color.danger, T.color.accentSoft] };
  const [fg, bg] = map[level] || map.Easy;
  return <span style={Object.assign({ fontSize: 11.5, fontWeight: 600, color: fg, background: bg, borderRadius: 999, padding: '4px 11px', fontFamily: T.font.sans, whiteSpace: 'nowrap' }, style)}>{level}</span>;
}

// Neutral outlined pill for prep time and descriptors.
function MetaPill({ children, style }) {
  return <span style={Object.assign({ fontSize: 11.5, fontWeight: 600, color: T.color.sub, background: T.color.surface, border: '1px solid ' + T.color.line, borderRadius: 999, padding: '4px 11px', fontFamily: T.font.sans, whiteSpace: 'nowrap' }, style)}>{children}</span>;
}

// Ordered, wrapping pill set for an Explore card: difficulty, then prep time
// where it exists, then one descriptor. Degrades to nothing if a dish has none.
function DishPills({ d }) {
  const pills = [];
  if (d.complexity) pills.push(<DifficultyPill key="diff" level={d.complexity} />);
  if (d.time) pills.push(<MetaPill key="time">{d.time} min</MetaPill>);
  if (d.descriptor) pills.push(<MetaPill key="desc">{d.descriptor}</MetaPill>);
  if (pills.length === 0) return null;
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 58, overflow: 'hidden' }}>{pills}</div>;
}

// One dish inside a day or a picker. Meta is plain language: time, then complexity.
// entry = { key } or { custom }. Trailing is the caller's affordance.
function DishRow({ entry, trailing, onClick, compact }) {
  const d = entry.key ? window.PlantryData.DISHES[entry.key] : null;
  const name = d ? d.name : entry.custom;
  const label = d ? (window.PlantryData.COMPLEXITY_LABELS[d.complexity] || d.complexity) : 'One off this week';
  const meta = d ? `${d.time} min · ${label}` : label;
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: compact ? '7px 0' : '9px 0', cursor: onClick ? 'pointer' : 'default' }}>
      <Thumb src={d && d.img} size={compact ? 40 : 48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.font.serif, fontSize: compact ? 15.5 : 16.5, fontWeight: 600, lineHeight: 1.25, color: T.color.ink }}>{name}</div>
        <div style={{ fontSize: 12.5, color: T.color.sub, marginTop: 2, fontFamily: T.font.sans }}>
          {meta}
          {d && d.prep && <span style={{ color: '#8A6D3B', fontWeight: 600 }}> · Pre prep</span>}
        </div>
      </div>
      {trailing}
    </div>
  );
}

// Fruit of the day row. A normal section row, same weight and styling as a dish
// row (no quieter treatment); fruitKey resolves in PlantryData.FRUITS.
function FruitRow({ fruitKey, onClick, trailing, compact }) {
  const f = window.PlantryData.FRUITS[fruitKey];
  if (!f) return null;
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: compact ? '7px 0' : '9px 0', cursor: onClick ? 'pointer' : 'default' }}>
      <FruitTile color={f.swatch} size={compact ? 40 : 48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.font.serif, fontSize: compact ? 15.5 : 16.5, fontWeight: 600, lineHeight: 1.25, color: T.color.ink }}>{f.name}</div>
        <div style={{ fontSize: 12.5, color: T.color.sub, marginTop: 2, fontFamily: T.font.sans }}>In season</div>
      </div>
      {trailing}
    </div>
  );
}

function DateBadge({ short, date, muted, compact }) {
  const ink = muted ? T.color.sub : T.color.ink;
  if (compact) {
    return (
      <div style={{ width: 34, flexShrink: 0, textAlign: 'center', fontFamily: T.font.serif, fontSize: 22, fontWeight: 600, lineHeight: 1, color: ink }}>{date}</div>
    );
  }
  return (
    <div style={{ width: 52, flexShrink: 0, textAlign: 'center', paddingTop: 2, fontFamily: T.font.sans }}>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.color.sub }}>{short}</div>
      <div style={{ fontFamily: T.font.serif, fontSize: 30, fontWeight: 600, lineHeight: 1.1, color: ink }}>{date}</div>
      <div style={{ fontSize: 11, color: T.color.sub }}>Jun</div>
    </div>
  );
}

function Card({ children, onClick, style }) {
  return (
    <div onClick={onClick} style={Object.assign({ background: T.color.surface, borderRadius: T.radius.card, border: '1px solid ' + T.color.line, cursor: onClick ? 'pointer' : 'default' }, style)}>{children}</div>
  );
}

// Day card for the Menu view. Three states:
//  - collapsed: a passed day, condensed to a glance plus a View action
//  - today: the current day, marked and expanded
//  - default: an upcoming day, expanded
// Sections when expanded: Breakfast, Lunch, then Fruit of the day.
function DayCard({ day, showImages, onEdit, onView, collapsed, today }) {
  const meals = [['Breakfast', day.breakfast], ['Lunch', day.lunch]].filter(([, v]) => v.length > 0);

  if (collapsed) {
    const names = [...day.breakfast, ...day.lunch].map((e) => (e.key ? window.PlantryData.DISHES[e.key].name : e.custom));
    let summary = day.skipped ? 'Skipped' : (names.slice(0, 2).join(', ') + (names.length > 2 ? ' +' + (names.length - 2) + ' more' : ''));
    return (
      <Card style={{ padding: '5px 12px', display: 'flex', gap: 10, alignItems: 'center', background: T.color.bg }}>
        <div style={{ width: 26, flexShrink: 0, textAlign: 'center', fontFamily: T.font.serif, fontSize: 16, fontWeight: 600, lineHeight: 1, color: T.color.sub }}>{day.date}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: T.color.sub, fontFamily: T.font.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary}</div>
        </div>
        {onView && (
          <button onClick={onView} aria-label={'View ' + day.day} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: T.color.sub, border: '1px solid ' + T.color.line, background: T.color.surface, borderRadius: 999, padding: '4px 13px', fontFamily: T.font.sans, minHeight: 28 }}>View</button>
        )}
      </Card>
    );
  }

  return (
    <Card data-comment-anchor={'day-' + day.id} style={{ padding: '16px 16px 10px', display: 'flex', gap: 14, position: 'relative', border: '1px solid ' + (today ? T.color.accentSoft : T.color.line) }}>
      <DateBadge short={day.short} date={day.date} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {day.skipped ? (
          <div style={{ padding: '6px 0 14px' }}>
            <div style={{ fontFamily: T.font.serif, fontSize: 16.5, fontWeight: 600, color: T.color.sub }}>Skipped</div>
            <div style={{ fontSize: 13, color: T.color.sub, marginTop: 3, fontFamily: T.font.sans }}>"{day.skipped.reason}"</div>
          </div>
        ) : (
          <React.Fragment>
            {meals.map(([label, entries]) => (
              <div key={label} style={{ marginBottom: 6 }}>
                <SectionLabel>{label}</SectionLabel>
                {entries.map((e, i) => <DishRow key={i} entry={e} compact={!showImages} />)}
              </div>
            ))}
            {day.fruit && (
              <div style={{ marginTop: 2 }}>
                <SectionLabel>Fruit of the day</SectionLabel>
                <FruitRow fruitKey={day.fruit} />
              </div>
            )}
          </React.Fragment>
        )}
      </div>
      {onEdit && (
        <button onClick={onEdit} aria-label={'Edit ' + day.day} style={{ position: 'absolute', top: 12, right: 12, fontSize: 12.5, fontWeight: 600, color: T.color.accent, background: T.color.accentSoft, borderRadius: 999, padding: '7px 14px', fontFamily: T.font.sans }}>Edit</button>
      )}
    </Card>
  );
}

// ---------- Bottom nav with distinct line icons per tab ----------
function TabIcon({ name, color }) {
  const c = color;
  const sw = 1.7;
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: c, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'Menu') return (
    <svg {...common}><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9h17M8 3v3M16 3v3" /></svg>
  );
  if (name === 'Grocery') return (
    <svg {...common}><path d="M4 8h16l-1.4 9.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 8Z" /><path d="M8.5 8 11 3.5M15.5 8 13 3.5" /></svg>
  );
  if (name === 'Explore') return (
    <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M15.2 8.8 13 13l-4.2 2.2L11 11l4.2-2.2Z" /></svg>
  );
  // Yours: heart
  return (
    <svg {...common}><path d="M12 19.5s-6.8-4.4-8.9-8.4C1.7 8.2 3.5 5.2 6.6 5.2c1.9 0 3.3 1 4.1 2.3L12 9.2l1.3-1.7c.8-1.3 2.2-2.3 4.1-2.3 3.1 0 4.9 3 3.5 5.9-2.1 4-8.9 8.4-8.9 8.4Z" /></svg>
  );
}

function TabBar({ active, onTab }) {
  const lists = window.PlantryAppLists || { wishlist: [] };
  const badges = { Yours: lists.wishlist.length };
  return (
    <div style={{ display: 'flex', borderTop: '1px solid ' + T.color.line, background: T.color.surface, padding: '8px 10px calc(12px + env(safe-area-inset-bottom, 12px))', flexShrink: 0 }}>
      {['Menu', 'Grocery', 'Explore', 'Yours'].map((t) => {
        const on = t === active;
        const color = on ? T.color.accent : T.color.sub;
        const badge = badges[t];
        return (
          <button key={t} onClick={() => onTab(t)} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontFamily: T.font.sans, fontWeight: on ? 700 : 500, color, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 48, justifyContent: 'center', position: 'relative' }}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <TabIcon name={t} color={color} />
              {badge > 0 && (
                <span style={{ position: 'absolute', top: -6, left: 14, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: T.color.accent, color: T.color.onAccent, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid ' + T.color.surface }}>{badge}</span>
              )}
            </span>
            {t}
          </button>
        );
      })}
    </div>
  );
}

function PrimaryButton({ children, onClick, style }) {
  return <button onClick={onClick} style={Object.assign({ background: T.color.accent, color: T.color.onAccent, borderRadius: T.radius.control, padding: '14px 0', textAlign: 'center', fontSize: 15.5, fontWeight: 600, fontFamily: T.font.sans, width: '100%', minHeight: 48 }, style)}>{children}</button>;
}

function QuietButton({ children, onClick, danger, style }) {
  return <button onClick={onClick} style={Object.assign({ background: T.color.surface, color: danger ? T.color.danger : T.color.ink, border: '1px solid ' + (danger ? T.color.dangerLine : T.color.line), borderRadius: T.radius.control, padding: '13px 0', textAlign: 'center', fontSize: 15, fontWeight: 600, fontFamily: T.font.sans, width: '100%', minHeight: 48 }, style)}>{children}</button>;
}

function SearchField({ value, onChange, placeholder, autoFocus }) {
  return (
    <input value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', background: T.color.surface, border: '1px solid ' + T.color.line, borderRadius: T.radius.control, padding: '12px 16px', fontSize: 15, fontFamily: T.font.sans, color: T.color.ink, outline: 'none', minHeight: 46 }} />
  );
}

// Bottom sheet with scrim. A close button sits at the top right; children scroll if tall.
function Sheet({ onClose, children, maxHeight }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: T.color.scrim }}></div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: T.color.surface, borderRadius: '24px 24px 0 0', padding: '10px 18px calc(18px + env(safe-area-inset-bottom, 8px))', maxHeight: maxHeight || '88%', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12, zIndex: 3, width: 32, height: 32, borderRadius: 999, background: T.color.surface, color: T.color.ink, fontSize: 19, lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(44,36,27,0.18)' }}>×</button>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: T.color.line, margin: '0 auto 10px', flexShrink: 0 }}></div>
        <div style={{ overflowY: 'auto', minHeight: 0 }}>{children}</div>
      </div>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div style={{ background: T.color.bg, borderRadius: T.radius.chip, padding: '8px 10px', fontFamily: T.font.sans }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.color.sub }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 600, marginTop: 2, color: T.color.ink }}>{value}</div>
    </div>
  );
}

function InfoDot() {
  return <span style={{ display: 'inline-flex', width: 17, height: 17, borderRadius: 999, border: '1.5px solid ' + T.color.accent, color: T.color.accent, fontSize: 11, alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: T.font.sans, verticalAlign: '-2px' }}>i</span>;
}

Object.assign(window, { Avatar, SectionLabel, Chip, Toggle, Thumb, FruitTile, DifficultyPill, MetaPill, DishPills, DishRow, FruitRow, DateBadge, Card, DayCard, TabIcon, TabBar, PrimaryButton, QuietButton, SearchField, Sheet, StatChip, InfoDot });
