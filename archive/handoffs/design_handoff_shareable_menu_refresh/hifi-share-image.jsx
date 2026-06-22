// Plantry shareable images. A separate surface from the PWA: calm, label free,
// legible at phone size on WhatsApp. The shareable family is the menu image plus
// one recipe sheet per dish marked "include recipe when sharing". The grocery
// list is internal only and is not part of this family.
//
// The menu image is deliberately compact and close to square (two columns of
// three day cards) so that WhatsApp's longest-side downscale leaves the dish
// text crisp. See DESIGN.md for the downscale rationale and the exact canvas
// geometry the renderer ports.
const SH = window.PT;

function ShareFrame({ children, width, pad, footerSize }) {
  return (
    <div style={{ width: '100%', maxWidth: width || 360, boxSizing: 'border-box', background: '#FBF6ED', fontFamily: SH.font.sans, color: SH.color.ink, padding: pad || '26px 24px 20px' }}>
      {children}
      <div style={{ textAlign: 'center', marginTop: 18, fontFamily: SH.font.serif, fontSize: footerSize || 12, color: '#B5A78F', letterSpacing: '0.06em' }}>Plantry</div>
    </div>
  );
}

function ShareHeading({ title, sub, big }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: big ? 22 : 16 }}>
      <div style={{ fontFamily: SH.font.serif, fontSize: big ? 30 : 21, fontWeight: 700 }}>{title}</div>
      {sub && <div style={{ fontSize: big ? 15 : 12.5, color: SH.color.sub, marginTop: big ? 4 : 3 }}>{sub}</div>}
    </div>
  );
}

// The menu is a single-column ledger: one row per day in a cream panel, a left
// date rail, and each meal on its own labeled line (a fixed label column so a
// wrapped dish list hangs under the value, not under the label). Calm to read
// top to bottom, and dense enough to stay near square. See DESIGN.md §1 for the
// canvas geometry.
const LEDGER = { rail: 40, label: 66, gap: 16, labelGap: 10 };

function MenuMealLine({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: LEDGER.labelGap }}>
      <div style={{ width: LEDGER.label, flexShrink: 0, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: SH.color.green, paddingTop: 3 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.4, color: SH.color.ink }}>{value}</div>
    </div>
  );
}

function MenuLedgerRow({ day, last }) {
  const D = window.PlantryData.DISHES;
  const F = window.PlantryData.FRUITS;
  const nameOf = (e) => (e.key ? D[e.key].name : e.custom);
  return (
    <div style={{ display: 'flex', gap: LEDGER.gap, padding: '14px 18px', borderBottom: last ? 'none' : '1px solid #EBE2D2' }}>
      <div style={{ width: LEDGER.rail, flexShrink: 0 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: SH.color.sub, fontWeight: 700 }}>{day.short}</div>
        <div style={{ fontFamily: SH.font.serif, fontSize: 24, fontWeight: 600, color: SH.color.ink, lineHeight: 1.1 }}>{day.date}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {day.skipped ? (
          <div style={{ color: SH.color.sub, fontSize: 14 }}>Skipped</div>
        ) : (
          <React.Fragment>
            <MenuMealLine label="Breakfast" value={day.breakfast.length ? day.breakfast.map(nameOf).join(', ') : ''} />
            <MenuMealLine label="Lunch" value={day.lunch.length ? day.lunch.map(nameOf).join(', ') : ''} />
            <MenuMealLine label="Fruit" value={day.fruit && F[day.fruit] ? F[day.fruit].name : ''} />
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

// Image 1: the week's menu as a single-column ledger. Header above, Plantry
// footer below. Dense and near square so WhatsApp's longest-side downscale
// keeps the dish text crisp.
function MenuShareImage({ week }) {
  return (
    <ShareFrame width={600} pad="30px 26px 24px" footerSize={15}>
      <ShareHeading title="This week" sub="June 15 to 20" big />
      <div style={{ background: '#FFFEFA', border: '1px solid #EBE2D2', borderRadius: 16, overflow: 'hidden' }}>
        {week.map((d, i) => <MenuLedgerRow key={d.id} day={d} last={i === week.length - 1} />)}
      </div>
    </ShareFrame>
  );
}

// Image 2+: one recipe sheet per dish marked "include recipe when sharing".
function RecipeShareImage({ dishKey }) {
  const d = window.PlantryData.DISHES[dishKey];
  return (
    <ShareFrame>
      <ShareHeading title={d.name} sub={`About ${d.time} minutes, serves 2`} />
      <div style={{ background: '#FFFEFA', border: '1px solid #EBE2D2', borderRadius: 12, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.55 }}>
        <div><span style={{ color: SH.color.sub }}>Equipment:</span> {d.cook.equipment}</div>
        <div><span style={{ color: SH.color.sub }}>Buy specially:</span> {d.cook.special}</div>
      </div>
      <div style={{ marginTop: 12 }}>
        {d.cook.recipe.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>
            <span style={{ fontFamily: SH.font.serif, color: SH.color.accent, fontWeight: 700, fontSize: 15 }}>{i + 1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </ShareFrame>
  );
}

Object.assign(window, { MenuShareImage, RecipeShareImage });
