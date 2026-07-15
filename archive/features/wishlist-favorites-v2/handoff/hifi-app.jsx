// Plantry app shell: state, persistence, navigation, overlay flows.
const { useState: useAppState, useEffect: useAppEffect } = React;
const AT = window.PT;

const STORAGE_KEY = 'plantry-hifi-v2';
const TABS = ['Menu', 'Grocery', 'Explore', 'Yours'];

// Seed lists: the household already keeps one favorite and two wishlist dishes.
const SEED_LISTS = {
  favorites: [{ custom: 'Avocado toast', who: 'Tuhina', when: '2 days ago' }],
  wishlist: [{ key: 'dosa', who: 'Rajat', when: '3 days ago' }, { key: 'chanaMasala', who: 'Tuhina', when: 'Last week' }],
};

function loadState() {
  let s = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) s = JSON.parse(raw);
  } catch (e) {}
  if (!s) {
    s = {
      gated: false,
      identity: null,
      tab: 'Menu',
      week: JSON.parse(JSON.stringify(window.PlantryData.WEEK)),
      activity: window.PlantryData.ACTIVITY.slice(),
    };
  }
  if (s.tab === 'Changes') s.tab = 'Yours'; // the Changes tab became Yours
  if (!TABS.includes(s.tab)) s.tab = 'Menu';
  delete s.nextWeek; // deprecated: Save for next week is gone, saved entries drop silently
  if (!s.lists) s.lists = JSON.parse(JSON.stringify(SEED_LISTS));
  return s;
}

function Toast({ text }) {
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 110, zIndex: 80, background: AT.color.ink, color: AT.color.onAccent, borderRadius: 14, padding: '13px 16px', fontSize: 14, fontFamily: AT.font.sans, textAlign: 'center', boxShadow: '0 8px 24px rgba(44,36,27,0.3)' }}>{text}</div>
  );
}

function PlantryApp() {
  const [state, setState] = useAppState(loadState);
  const [dayId, setDayId] = useAppState(null);
  const [overlay, setOverlay] = useAppState(null); // { type, ... }
  const [toast, setToast] = useAppState(null);

  useAppEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }, [state]);

  useAppEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  window.PlantryAppWeek = state.week;
  window.PlantryAppActivity = state.activity;
  window.PlantryAppLists = state.lists;

  const update = (patch) => setState((s) => Object.assign({}, s, patch));
  const say = (text) => setToast(text);

  // ----- mutations, all attributed to the current identity -----
  const mutateWeek = (fn) => {
    const week = JSON.parse(JSON.stringify(state.week));
    fn(week);
    return week;
  };
  const logActivity = (kind, text, reason) => [{ who: state.identity, kind, text, when: 'Just now', reason }, ...state.activity];
  const dayName = (id) => state.week.find((d) => d.id === id).day;

  // Lists: one-tap saves, no reason dialog. Shared household lists, attributed.
  const isWishlisted = (key) => state.lists.wishlist.some((w) => w.key === key);
  const toggleWishlist = (key) => {
    const D = window.PlantryData.DISHES;
    if (isWishlisted(key)) {
      update({ lists: Object.assign({}, state.lists, { wishlist: state.lists.wishlist.filter((w) => w.key !== key) }) });
      say('Removed from your wishlist');
    } else {
      update({
        lists: Object.assign({}, state.lists, { wishlist: [{ key, who: state.identity, when: 'Just now' }, ...state.lists.wishlist] }),
        activity: logActivity('wishlist', `Wishlisted ${D[key].name}`, ''),
      });
      say(D[key].name + ' is on your wishlist');
    }
  };
  const addFavorite = (entry) => {
    const D = window.PlantryData.DISHES;
    const name = entry.key ? D[entry.key].name : entry.custom;
    update({
      lists: Object.assign({}, state.lists, { favorites: [...state.lists.favorites, Object.assign({ who: state.identity, when: 'Just now' }, entry)] }),
      activity: logActivity('favorite', `Added ${name} as a favorite`, ''),
    });
    setOverlay(null);
    say(name + ' is a favorite now');
  };
  const removeAt = (list, i) => {
    const next = state.lists[list].slice();
    next.splice(i, 1);
    update({ lists: Object.assign({}, state.lists, { [list]: next }) });
    say(list === 'favorites' ? 'Favorite removed' : 'Removed from your wishlist');
  };
  const isFavorited = (key) => state.lists.favorites.some((f) => f.key === key);
  const toggleFavorite = (key) => {
    const D = window.PlantryData.DISHES;
    if (isFavorited(key)) {
      update({ lists: Object.assign({}, state.lists, { favorites: state.lists.favorites.filter((f) => f.key !== key) }) });
      say('Removed from favorites');
    } else {
      update({
        lists: Object.assign({}, state.lists, { favorites: [...state.lists.favorites, { key, who: state.identity, when: 'Just now' }] }),
        activity: logActivity('favorite', `Added ${D[key].name} as a favorite`, ''),
      });
      say(D[key].name + ' is a favorite now');
    }
  };

  const applyAction = (action, reason) => {
    const D = window.PlantryData.DISHES;
    const F = window.PlantryData.FRUITS;
    if (action.kind === 'replace') {
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId)[action.meal][action.idx] = { key: action.newKey }; });
      update({ week, activity: logActivity('swap', `Swapped ${dayName(action.dayId)} ${action.meal} to ${D[action.newKey].name}`, reason) });
      say('Swapped in ' + D[action.newKey].name);
    }
    if (action.kind === 'oneoff') {
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId)[action.meal][action.idx] = { custom: action.name }; });
      update({ week, activity: logActivity('oneoff', `Added one off ${action.name} to ${dayName(action.dayId)}`, reason) });
      say('Added ' + action.name);
    }
    if (action.kind === 'oneoffAdd') {
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId)[action.meal].push({ custom: action.name }); });
      update({ week, activity: logActivity('oneoff', `Added one off ${action.name} to ${dayName(action.dayId)}`, reason) });
      say('Added ' + action.name);
    }
    if (action.kind === 'delete') {
      const entry = state.week.find((d) => d.id === action.dayId)[action.meal][action.idx];
      const name = entry.key ? D[entry.key].name : entry.custom;
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId)[action.meal].splice(action.idx, 1); });
      update({ week, activity: logActivity('delete', `Removed ${name} from ${dayName(action.dayId)}`, reason) });
      say('Removed ' + name);
    }
    if (action.kind === 'use') {
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId)[action.meal].push({ key: action.key }); });
      update({ week, tab: 'Menu', activity: logActivity('add', `Added ${D[action.key].name} to ${dayName(action.dayId)}`, reason) });
      setDayId(action.dayId);
      say('Added to ' + dayName(action.dayId));
    }
    if (action.kind === 'fruitswap') {
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId).fruit = action.fruitKey; });
      update({ week, activity: logActivity('swap', `Swapped ${dayName(action.dayId)} fruit to ${F[action.fruitKey].name}`, reason) });
      say('Fruit swapped to ' + F[action.fruitKey].name);
    }
    if (action.kind === 'skipday') {
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId).skipped = { reason }; });
      update({ week, activity: logActivity('skip', `Skipped ${dayName(action.dayId)}`, reason) });
      say(dayName(action.dayId) + ' skipped');
    }
    if (action.kind === 'restoreday') {
      const week = mutateWeek((w) => { w.find((d) => d.id === action.dayId).skipped = null; });
      update({ week, activity: logActivity('restore', `Restored ${dayName(action.dayId)}`, reason) });
      say(dayName(action.dayId) + ' restored');
    }
    if (action.kind === 'dislike') {
      // Record only: queues a slow-loop signal, no in-session effect (no re-rank, no hide).
      say('Saved as not for me');
    }
    setOverlay(null);
  };

  const toggleRecipe = (dId, meal, idx) => {
    const week = mutateWeek((w) => { const e = w.find((d) => d.id === dId)[meal][idx]; e.includeRecipe = !e.includeRecipe; });
    update({ week });
  };

  // ----- first run -----
  if (!state.gated) return <window.GateScreen onUnlock={() => update({ gated: true })} />;
  if (!state.identity) return <window.IdentityScreen onPick={(who) => update({ identity: who })} />;

  // ----- screens -----
  const onTab = (tab) => { setDayId(null); setOverlay(null); update({ tab }); };
  let screen = null;
  if (state.tab === 'Menu') {
    const day = state.week.find((d) => d.id === dayId);
    screen = day
      ? <window.DayScreen key={day.id} day={day} onBack={() => setDayId(null)} onTab={onTab}
          onDishMenu={(dId, meal, idx) => setOverlay({ type: 'actions', dayId: dId, meal, idx })}
          onDishDetails={(dId, meal, idx) => {
            const entry = state.week.find((d) => d.id === dId)[meal][idx];
            setOverlay({ type: 'details', context: 'week', key: entry.key, dayId: dId, meal, idx });
          }}
          onAddDish={() => setOverlay({ type: 'picker', mode: 'add', dayId: day.id, meal: 'lunch' })}
          onFruitSwap={(dId) => setOverlay({ type: 'fruitPicker', dayId: dId })}
          onComment={(text) => {
            update({ activity: [{ who: state.identity, kind: 'comment', text: `Commented on ${day.day}: ${text}`, when: 'Just now', reason: '' }, ...state.activity] });
            say('Comment queued for the weekly review');
          }}
          onSkipDay={() => setOverlay({ type: 'reason', title: 'Why skip ' + day.day + '?', submitLabel: 'Skip the day', action: { kind: 'skipday', dayId: day.id } })}
          onRestoreDay={() => setOverlay({ type: 'reason', title: 'Why restore it?', submitLabel: 'Restore the day', action: { kind: 'restoreday', dayId: day.id } })} />
      : <window.MenuScreen week={state.week} activity={state.activity} identity={state.identity}
          onTab={onTab} onShare={() => setOverlay({ type: 'share' })} onOpenDay={setDayId}
          onProfile={() => setOverlay({ type: 'profile' })} />;
  } else if (state.tab === 'Grocery') {
    screen = <window.GroceryScreen week={state.week} onTab={onTab} />;
  } else if (state.tab === 'Yours') {
    screen = <window.YoursScreen lists={state.lists} onTab={onTab}
      onAddFavorite={() => setOverlay({ type: 'addFavorite' })}
      onRemoveFavorite={(i) => removeAt('favorites', i)}
      onRemoveWishDish={(i) => removeAt('wishlist', i)}
      onOpenWishDish={(key) => setOverlay({ type: 'details', context: 'explore', key })}
      onUseWishDish={(key) => setOverlay({ type: 'dayPicker', key })} />;
  } else {
    const usedKeys = [];
    state.week.forEach((d) => ['breakfast', 'lunch'].forEach((m) => d[m].forEach((e) => e.key && usedKeys.push(e.key))));
    screen = <window.ExploreScreen history={usedKeys} wishlist={state.lists.wishlist} onToggleWishlist={toggleWishlist} onTab={onTab}
      onOpenDish={(key) => setOverlay({ type: 'details', context: 'explore', key })} />;
  }

  // ----- overlays -----
  let overlayEl = null;
  if (overlay) {
    const close = () => setOverlay(null);
    if (overlay.type === 'actions') {
      const entry = state.week.find((d) => d.id === overlay.dayId)[overlay.meal][overlay.idx];
      overlayEl = <window.DishActionSheet entry={entry} onClose={close}
        favorited={entry.key ? isFavorited(entry.key) : false}
        onFavorite={() => { toggleFavorite(entry.key); close(); }}
        onDetails={() => setOverlay({ type: 'details', context: 'week', key: entry.key, dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx })}
        onReplace={() => setOverlay({ type: 'picker', mode: 'replace', dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx, outgoingKey: entry.key })}
        onDelete={() => setOverlay({ type: 'reason', title: 'Why remove it?', submitLabel: 'Remove dish', action: { kind: 'delete', dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx } })} />;
    }
    if (overlay.type === 'details') {
      const entry = overlay.context === 'week' ? state.week.find((d) => d.id === overlay.dayId)[overlay.meal][overlay.idx] : null;
      overlayEl = <window.DishDetailSheet dishKey={overlay.key} context={overlay.context} onClose={close}
        includeRecipe={entry && entry.includeRecipe}
        wishlisted={isWishlisted(overlay.key)}
        onWishlist={() => toggleWishlist(overlay.key)}
        onToggleRecipe={() => toggleRecipe(overlay.dayId, overlay.meal, overlay.idx)}
        onReplace={() => setOverlay({ type: 'picker', mode: 'replace', dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx, outgoingKey: overlay.key })}
        onDelete={() => setOverlay({ type: 'reason', title: 'Why remove it?', submitLabel: 'Remove dish', action: { kind: 'delete', dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx } })}
        onReplaceWith={() => setOverlay({ type: 'reason', title: 'Why this swap?', submitLabel: 'Swap it in', action: { kind: 'replace', dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx, newKey: overlay.key } })}
        onUse={() => setOverlay({ type: 'dayPicker', key: overlay.key })}
        onDislike={() => setOverlay({ type: 'reason', title: 'Not for me', hint: 'A reason is optional; it only feeds the weekly review.', submitLabel: 'Save as not for me', optional: true, action: { kind: 'dislike', key: overlay.key } })} />;
    }
    if (overlay.type === 'picker') {
      overlayEl = <window.GenericPickerSheet mode={overlay.mode} dayId={overlay.dayId} meal={overlay.meal} outgoingKey={overlay.outgoingKey} onClose={close}
        onPickLibrary={(key) => {
          if (overlay.mode === 'replace') {
            setOverlay({ type: 'details', context: 'replacePreview', key, dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx, outgoingKey: overlay.outgoingKey });
          } else {
            const mealKey = window.PlantryData.DISHES[key].meal === 'Breakfast' ? 'breakfast' : 'lunch';
            setOverlay({ type: 'reason', title: 'Why add it?', submitLabel: 'Add the dish', action: { kind: 'use', dayId: overlay.dayId, meal: mealKey, key } });
          }
        }}
        onPickCustom={(name) => {
          if (overlay.mode === 'replace') {
            setOverlay({ type: 'reason', title: 'Why the one off?', submitLabel: 'Replace it', action: { kind: 'oneoff', dayId: overlay.dayId, meal: overlay.meal, idx: overlay.idx, name } });
          } else {
            setOverlay({ type: 'reason', title: 'Why the one off?', submitLabel: 'Add it', action: { kind: 'oneoffAdd', dayId: overlay.dayId, meal: overlay.meal, name } });
          }
        }} />;
    }
    if (overlay.type === 'fruitPicker') {
      const day = state.week.find((d) => d.id === overlay.dayId);
      overlayEl = <window.FruitPickerSheet dayId={overlay.dayId} currentFruit={day.fruit} onClose={close}
        onPick={(fruitKey) => setOverlay({ type: 'reason', title: 'Why this fruit?', submitLabel: 'Swap the fruit', action: { kind: 'fruitswap', dayId: overlay.dayId, fruitKey } })} />;
    }
    if (overlay.type === 'reason') {
      overlayEl = <window.ReasonDialog title={overlay.title} hint={overlay.hint} submitLabel={overlay.submitLabel} optional={overlay.optional} onClose={close}
        onSubmit={(reason) => applyAction(overlay.action, reason)} />;
    }
    if (overlay.type === 'dayPicker') {
      overlayEl = <window.DayPickerSheet dishKey={overlay.key} onClose={close}
        onPick={(dId, meal) => setOverlay({ type: 'reason', title: 'Why add it?', submitLabel: 'Add to the week', action: { kind: 'use', dayId: dId, meal, key: overlay.key } })} />;
    }
    if (overlay.type === 'share') {
      overlayEl = <window.SharePreviewSheet week={state.week} onClose={close} />;
    }
    if (overlay.type === 'profile') {
      overlayEl = <window.ProfileSheet identity={state.identity} activity={state.activity} onClose={close}
        onSwitch={() => { setOverlay(null); update({ identity: null }); }}
        onChanges={() => setOverlay({ type: 'changesLog' })} />;
    }
    if (overlay.type === 'changesLog') {
      overlayEl = <window.ChangesLogSheet activity={state.activity} onClose={close} />;
    }
    if (overlay.type === 'addFavorite') {
      overlayEl = <window.AddFavoriteSheet favorites={state.lists.favorites} onClose={close}
        onPick={(key) => addFavorite({ key })}
        onPickCustom={(name) => addFavorite({ custom: name })} />;
    }
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {screen}
      {overlayEl}
      {toast && <Toast text={toast} />}
    </div>
  );
}

window.PlantryApp = PlantryApp;
