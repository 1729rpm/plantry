// Plantry overlays: action sheet, dish details, generic picker (add and replace),
// fruit picker, reason dialog, day picker, share preview.
// Comment entry was removed from the UI; the Changes tab still shows historical comments.
const { useState: useOvState, useEffect: useOvEffect } = React;
const OT = window.PT;

// ---------- Dish action sheet ----------
function DishActionSheet({ entry, onReplace, onDetails, onDelete, onClose }) {
  const { Sheet, DishRow } = window;
  const row = (label, hint, onClick, danger) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '15px 4px', borderTop: '1px solid ' + OT.color.line, minHeight: 52 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: danger ? OT.color.danger : OT.color.ink, fontFamily: OT.font.sans }}>{label}</span>
      <span style={{ fontSize: 12.5, color: OT.color.sub, fontFamily: OT.font.sans }}>{hint}</span>
    </button>
  );
  return (
    <Sheet onClose={onClose}>
      <DishRow entry={entry} />
      <div style={{ marginTop: 6 }}>
        {entry.key && row('Details and recipe', 'Cooking info, protein', onDetails)}
        {row('Replace', 'Pick another dish', onReplace)}
        {row('Delete', 'Remove from this day', onDelete, true)}
      </div>
    </Sheet>
  );
}

// ---------- Dish details sheet ----------
// context: 'week' (Menu dish: replace, remove, include-recipe toggle),
//          'explore' (use this week, next week, not for me),
//          'replacePreview' (picked from the swap picker: use this dish)
function DishDetailSheet({ dishKey, context, includeRecipe, onToggleRecipe, onReplace, onDelete, onUse, onUseNextWeek, onReplaceWith, onDislike, onClose, defaultOpen }) {
  const { Sheet, StatChip, PrimaryButton, QuietButton, Toggle, SectionLabel } = window;
  const d = window.PlantryData.DISHES[dishKey];
  const complexityLabel = (window.PlantryData.COMPLEXITY_LABELS || {})[d.complexity] || d.complexity;
  return (
    <Sheet onClose={onClose}>
      <div style={{ width: '100%', aspectRatio: '5 / 2', borderRadius: 16, overflow: 'hidden' }}>
        <img src={d.img} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontFamily: OT.font.serif, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{d.name}</div>
        {d.desc && <div style={{ fontSize: 13.5, color: OT.color.ink, marginTop: 4, lineHeight: 1.45 }}>{d.desc}</div>}
        <div style={{ fontSize: 12.5, color: OT.color.sub, marginTop: 4 }}>{d.cuisine} · {d.meal} · {d.lastCooked === 'Never' ? 'Not cooked yet' : 'Last cooked ' + d.lastCooked.toLowerCase()}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <StatChip label="Protein" value={d.protein + 'g'} />
        <StatChip label="Protein to carb" value={d.pc.toFixed(1)} />
        <StatChip label="Time" value={d.time + ' min'} />
      </div>
      <div style={{ background: OT.color.bg, borderRadius: 14, padding: '12px 12px', marginTop: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, fontFamily: OT.font.sans }}>{complexityLabel}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, marginTop: 8, fontFamily: OT.font.sans }}>
          <div><span style={{ color: OT.color.sub }}>Skill:</span> {d.cook.skill}</div>
          <div><span style={{ color: OT.color.sub }}>Equipment:</span> {d.cook.equipment}</div>
          <div><span style={{ color: OT.color.sub }}>Buy specially:</span> {d.cook.special}</div>
          {d.prep && <div><span style={{ color: OT.color.sub }}>Pre prep:</span> <span style={{ color: '#8A6D3B', fontWeight: 600 }}>{d.prep}</span></div>}
          <div><span style={{ color: OT.color.sub }}>Time:</span> About {d.time} minutes</div>
        </div>
        <div style={{ borderTop: '1px solid ' + OT.color.line, marginTop: 10, paddingTop: 10 }}>
          <SectionLabel color={OT.color.sub} style={{ marginBottom: 6 }}>Recipe</SectionLabel>
          {d.cook.recipe.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.45, marginBottom: 5, fontFamily: OT.font.sans }}>
              <span style={{ fontFamily: OT.font.serif, color: OT.color.accent, fontWeight: 700 }}>{i + 1}</span><span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {context === 'week' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, background: OT.color.bg, borderRadius: 12, padding: '12px 14px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: OT.font.sans }}>Include recipe when sharing</div>
            <div style={{ fontSize: 12, color: OT.color.sub, marginTop: 1 }}>Adds a recipe sheet to this week's images</div>
          </div>
          <Toggle on={!!includeRecipe} onChange={onToggleRecipe} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {context === 'week' && (
          <React.Fragment>
            <PrimaryButton onClick={onReplace} style={{ flex: 1.4 }}>Replace this dish</PrimaryButton>
            <QuietButton onClick={onDelete} danger style={{ flex: 1 }}>Remove</QuietButton>
          </React.Fragment>
        )}
        {context === 'explore' && (
          <React.Fragment>
            <PrimaryButton onClick={onUse} style={{ flex: 1.4 }}>Use this week</PrimaryButton>
            <QuietButton onClick={onUseNextWeek} style={{ flex: 1 }}>Next week</QuietButton>
          </React.Fragment>
        )}
        {context === 'replacePreview' && (
          <PrimaryButton onClick={onReplaceWith} style={{ flex: 1 }}>Use this dish</PrimaryButton>
        )}
      </div>

      {context === 'explore' && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={onDislike} style={{ fontSize: 13.5, fontWeight: 600, color: OT.color.sub, padding: '12px 16px', minHeight: 44, fontFamily: OT.font.sans, borderBottom: '1.5px dashed ' + OT.color.line }}>Not for me</button>
        </div>
      )}
    </Sheet>
  );
}

// ---------- Generic picker (add and replace share one search over the whole library) ----------
function weeksAgo(lastCooked) {
  if (lastCooked === 'Never') return 99;
  if (lastCooked === 'Last week') return 1;
  const m = lastCooked.match(/(\d+)/);
  if (m) return lastCooked.includes('day') ? Math.round(m[1] / 7 * 10) / 10 : Number(m[1]);
  return 0;
}

// Order: dishes whose meal-time matches the slot first, then the rest. Search and
// filters reach the whole active library across meal-time (a cross-meal pick is allowed).
function orderLibrary(slotMeal, day, outgoingKey) {
  const D = window.PlantryData.DISHES;
  const inDay = new Set([...day.breakfast, ...day.lunch].map((e) => e.key).filter(Boolean));
  return Object.keys(D)
    .filter((k) => k !== outgoingKey && !inDay.has(k))
    .sort((a, b) => {
      const am = D[a].meal === slotMeal ? 0 : 1;
      const bm = D[b].meal === slotMeal ? 0 : 1;
      if (am !== bm) return am - bm;
      return Math.min(9, weeksAgo(D[b].lastCooked)) - Math.min(9, weeksAgo(D[a].lastCooked));
    });
}

const PICKER_FILTERS = [
  { label: 'Breakfast', test: (d) => d.meal === 'Breakfast', group: 'meal' },
  { label: 'Lunch', test: (d) => d.meal === 'Lunch', group: 'meal' },
  { label: 'Easy to cook', test: (d) => d.complexity === 'Easy', group: 'quality' },
  { label: 'Healthy', test: (d) => d.healthy, group: 'quality' },
];

function GenericPickerSheet({ mode, dayId, meal, outgoingKey, onPickLibrary, onPickCustom, onClose }) {
  const { Sheet, SearchField, DishRow, SectionLabel } = window;
  const D = window.PlantryData.DISHES;
  const day = window.PlantryAppWeek ? window.PlantryAppWeek.find((d) => d.id === dayId) : null;
  const slotMeal = meal === 'breakfast' ? 'Breakfast' : 'Lunch';
  const [q, setQ] = useOvState('');
  const [filters, setFilters] = useOvState([]);

  const ordered = day ? orderLibrary(slotMeal, day, outgoingKey) : [];
  const textMatched = ordered.filter((k) => D[k].name.toLowerCase().includes(q.toLowerCase()));

  // Result-driven filter pills: a pill shows only when the current text results
  // contain a dish it would match. Filters reset when the search text changes.
  const available = PICKER_FILTERS.filter((f) => textMatched.some((k) => f.test(D[k])));
  const activeMeals = filters.filter((l) => PICKER_FILTERS.find((f) => f.label === l && f.group === 'meal'));
  const results = textMatched.filter((k) => {
    const d = D[k];
    if (activeMeals.length && !activeMeals.some((l) => PICKER_FILTERS.find((f) => f.label === l).test(d))) return false;
    for (const l of filters) {
      const f = PICKER_FILTERS.find((x) => x.label === l);
      if (f.group === 'quality' && !f.test(d)) return false;
    }
    return true;
  });
  const onSearch = (v) => { setQ(v); setFilters([]); };
  const toggleFilter = (l) => setFilters(filters.includes(l) ? filters.filter((x) => x !== l) : [...filters, l]);

  const row = (k) => {
    const d = D[k];
    const crossMeal = d.meal !== slotMeal;
    return (
      <button key={k} onClick={() => onPickLibrary(k)} style={{ width: '100%', textAlign: 'left', display: 'block' }}>
        <DishRow entry={{ key: k }} trailing={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {crossMeal && <span style={{ fontSize: 11, color: OT.color.sub, fontFamily: OT.font.sans }}>{d.meal}</span>}
            {d.lastCooked === 'Never' && <span style={{ fontSize: 11, fontWeight: 600, color: OT.color.accent, fontFamily: OT.font.sans }}>New</span>}
          </span>} />
      </button>
    );
  };

  return (
    <Sheet onClose={onClose} maxHeight="92%">
      {/* Pinned header: title, search, filters. The list below scrolls. */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontFamily: OT.font.serif, fontSize: 20, fontWeight: 700, marginBottom: 2 }}>
          {mode === 'replace' ? 'Replace ' + (outgoingKey ? D[outgoingKey].name : 'dish') : 'Add a dish'}
        </div>
        <div style={{ fontSize: 13, color: OT.color.sub, marginBottom: 12, fontFamily: OT.font.sans }}>
          {day ? day.day : ''} {meal} · search the whole library
        </div>
        <SearchField value={q} onChange={onSearch} placeholder={'Search, or type a one off dish'} />
        {q.trim() && (
          <button onClick={() => onPickCustom(q.trim())} style={{ width: '100%', textAlign: 'center', fontSize: 14, fontWeight: 600, color: OT.color.accent, border: '1.5px dashed ' + OT.color.accent, borderRadius: 14, padding: '12px 0', marginTop: 10, fontFamily: OT.font.sans }}>{mode === 'replace' ? 'Replace with one off "' + q.trim() + '"' : 'Add "' + q.trim() + '" as a one off'}</button>
        )}
        {available.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto' }}>
            {available.map((f) => (
              <window.Chip key={f.label} active={filters.includes(f.label)} onClick={() => toggleFilter(f.label)} style={{ padding: '7px 13px', fontSize: 12.5 }}>{f.label}</window.Chip>
            ))}
          </div>
        )}
      </div>
      <div style={{ marginTop: 6 }}>
        {results.length === 0 && <div style={{ padding: '24px 0', color: OT.color.sub, fontSize: 14, fontFamily: OT.font.sans }}>No dish matches.</div>}
        {results.map(row)}
      </div>
    </Sheet>
  );
}

// ---------- Fruit picker (category-locked: only another fruit can land here) ----------
function FruitPickerSheet({ dayId, currentFruit, onPick, onClose }) {
  const { Sheet, FruitRow, SearchField } = window;
  const F = window.PlantryData.FRUITS;
  const day = window.PlantryAppWeek ? window.PlantryAppWeek.find((d) => d.id === dayId) : null;
  const [q, setQ] = useOvState('');
  const keys = Object.keys(F).filter((k) => k !== currentFruit && F[k].name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet onClose={onClose} maxHeight="80%">
      <div style={{ fontFamily: OT.font.serif, fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Swap the fruit</div>
      <div style={{ fontSize: 13, color: OT.color.sub, marginBottom: 12, fontFamily: OT.font.sans }}>{day ? day.day : ''} · in-season fruit only</div>
      <SearchField value={q} onChange={setQ} placeholder="Search fruit" />
      <div style={{ marginTop: 6 }}>
        {keys.map((k) => (
          <button key={k} onClick={() => onPick(k)} style={{ width: '100%', textAlign: 'left', display: 'block' }}>
            <FruitRow fruitKey={k} trailing={<span style={{ fontSize: 12, color: OT.color.sub, fontFamily: OT.font.sans }}>{F[k].season}</span>} />
          </button>
        ))}
        {keys.length === 0 && <div style={{ padding: '20px 0', color: OT.color.sub, fontSize: 14, fontFamily: OT.font.sans }}>No other fruit in season.</div>}
      </div>
    </Sheet>
  );
}

// ---------- Reason dialog (required for swaps, adds, one offs, deletes, skips) ----------
function ReasonDialog({ title, hint, submitLabel, optional, onSubmit, onClose }) {
  const { Sheet, Chip, PrimaryButton } = window;
  const [text, setText] = useOvState('');
  const quick = ['Eating out', 'Not in season', 'Too heavy this week', 'Craving it', 'Guests over'];
  const ready = optional || text.trim();
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontFamily: OT.font.serif, fontSize: 20, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 13, color: OT.color.sub, marginTop: 4, fontFamily: OT.font.sans }}>{hint || 'A short reason helps the weekly review.'}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {quick.map((qr) => <Chip key={qr} active={text === qr} onClick={() => setText(qr)} style={{ padding: '7px 12px', fontSize: 12.5 }}>{qr}</Chip>)}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={optional ? 'Optional' : 'Why this change?'} rows={3}
        style={{ width: '100%', background: OT.color.bg, border: '1px solid ' + OT.color.line, borderRadius: 14, padding: '12px 14px', fontSize: 15, fontFamily: OT.font.sans, color: OT.color.ink, outline: 'none', resize: 'none' }} />
      <PrimaryButton onClick={() => ready && onSubmit(text.trim())} style={{ marginTop: 12, opacity: ready ? 1 : 0.4 }}>{submitLabel || 'Save change'}</PrimaryButton>
    </Sheet>
  );
}

// ---------- Day picker (from Explore, "Use this week") ----------
function DayPickerSheet({ dishKey, onPick, onClose }) {
  const { Sheet } = window;
  const d = window.PlantryData.DISHES[dishKey];
  const week = window.PlantryAppWeek || [];
  const mealKey = d.meal === 'Breakfast' ? 'breakfast' : 'lunch';
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontFamily: OT.font.serif, fontSize: 20, fontWeight: 700 }}>Add {d.name}</div>
      <div style={{ fontSize: 13, color: OT.color.sub, margin: '4px 0 10px', fontFamily: OT.font.sans }}>Pick the day it joins; it lands in {d.meal.toLowerCase()}</div>
      {week.map((day) => {
        if (day.id === 'sat' && mealKey === 'breakfast') return null;
        return (
          <button key={day.id} onClick={() => onPick(day.id, mealKey)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '14px 4px', borderTop: '1px solid ' + OT.color.line, minHeight: 52 }}>
            <span style={{ fontFamily: OT.font.serif, fontSize: 16.5, fontWeight: 600 }}>{day.day}</span>
            <span style={{ fontSize: 12.5, color: OT.color.sub, fontFamily: OT.font.sans }}>{day[mealKey].length} {d.meal.toLowerCase()} {day[mealKey].length === 1 ? 'dish' : 'dishes'}</span>
          </button>
        );
      })}
    </Sheet>
  );
}

// ---------- Share preview ----------
// Images sit in a horizontal swipe rail, the way they arrive on WhatsApp.
function SharePreviewSheet({ week, onClose }) {
  const { Sheet, SectionLabel, PrimaryButton, MenuShareImage, RecipeShareImage } = window;
  const withRecipes = [];
  week.forEach((day) => ['breakfast', 'lunch'].forEach((m) => day[m].forEach((e) => {
    if (e.key && e.includeRecipe) withRecipes.push(e.key);
  })));
  const slides = [
    { label: 'Menu', el: <MenuShareImage week={week} /> },
    ...withRecipes.map((k, i) => ({ label: 'Recipe ' + (i + 1), el: <RecipeShareImage dishKey={k} /> })),
  ];
  return (
    <Sheet onClose={onClose} maxHeight="92%">
      <div style={{ fontFamily: OT.font.serif, fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Share this week</div>
      <div style={{ fontSize: 13, color: OT.color.sub, marginBottom: 12, fontFamily: OT.font.sans }}>
        {slides.length} images, sent together. Swipe across to check them.
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', margin: '0 -18px', padding: '0 18px 6px' }}>
        {slides.map((s, i) => (
          <div key={i} style={{ flexShrink: 0, width: '82%', scrollSnapAlign: 'center' }}>
            <SectionLabel color={OT.color.sub} style={{ marginBottom: 8 }}>{(i + 1) + ' of ' + slides.length + ' · ' + s.label}</SectionLabel>
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid ' + OT.color.line, boxShadow: '0 8px 24px rgba(44,36,27,0.10)' }}>{s.el}</div>
          </div>
        ))}
      </div>
      {withRecipes.length === 0 && (
        <div style={{ fontSize: 12.5, color: OT.color.sub, margin: '10px 0 0', fontFamily: OT.font.sans }}>Turn on a dish's recipe toggle to add recipe sheets.</div>
      )}
      <PrimaryButton onClick={onClose} style={{ marginTop: 14 }}>Send on WhatsApp</PrimaryButton>
    </Sheet>
  );
}

Object.assign(window, { DishActionSheet, DishDetailSheet, GenericPickerSheet, FruitPickerSheet, ReasonDialog, DayPickerSheet, SharePreviewSheet, orderLibrary });
