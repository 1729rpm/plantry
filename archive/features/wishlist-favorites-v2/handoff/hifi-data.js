// Plantry dish library, current week, and activity data for the hi-fi prototype.
// Images live in assets/dishes/. Paths are relative to the design_handoff folder.
//
// This is a representative sample library for the style anchor. The live app
// carries roughly 260 dishes across roughly ten cuisines; the shape of each
// record matches the live data model (cuisine, descriptor, derived healthy flag,
// pre-prep, special sourcing, recipe).

(function () {
  const IMG = (k) => (window.PLANTRY_ASSET_BASE || '') + 'assets/dishes/' + k + '.jpg';

  // Fields: meal, cuisine, protein, pc (protein to carb), time, complexity,
  // healthy (derived: >=25% calories from protein and >=3g fibre per person),
  // descriptor (the single Explore pill: High protein / Complete meal / Filling / Light),
  // lastCooked, prep (pre-prep note), cook { skill, equipment, special, recipe[] }.
  const DISHES = {
    poha:         { name: 'Kanda poha', img: IMG('poha'), meal: 'Breakfast', cuisine: 'Maharashtrian', protein: 9, pc: 0.3, time: 20, complexity: 'Easy', healthy: true, descriptor: 'Light', lastCooked: 'Last week',
      cook: { skill: 'Basic, one pan', equipment: 'Kadhai', special: 'Thick poha, fresh curry leaves', recipe: ['Rinse poha and let it soften.', 'Temper mustard, curry leaves, onion; add turmeric.', 'Fold in poha, finish with lemon and coriander.'] } },
    omelette:     { name: 'Masala omelette', img: IMG('masala-omelette'), meal: 'Breakfast', cuisine: 'North Indian', protein: 18, pc: 2.6, time: 15, complexity: 'Easy', healthy: true, descriptor: 'High protein', lastCooked: '5 days ago',
      cook: { skill: 'Basic, one pan', equipment: 'Nonstick pan', special: 'None', recipe: ['Whisk eggs with onion, chilli, coriander, salt.', 'Cook on medium till set, fold and serve.'] } },
    chilla:       { name: 'Besan chilla', img: IMG('besan-chilla'), meal: 'Breakfast', cuisine: 'North Indian', protein: 14, pc: 0.8, time: 25, complexity: 'Easy', healthy: true, descriptor: 'High protein', lastCooked: '2 weeks ago',
      cook: { skill: 'Basic, batter spreading takes one or two tries', equipment: 'Flat tawa', special: 'None', recipe: ['Whisk besan with water, ajwain, chilli and onion.', 'Spread thin on a hot tawa, drizzle oil.', 'Flip once, cook till golden.'] } },
    idli:         { name: 'Idli with sambar', img: IMG('idli-sambar'), meal: 'Breakfast', cuisine: 'South Indian', protein: 8, pc: 0.2, time: 30, complexity: 'Medium', healthy: true, descriptor: 'Light', lastCooked: '3 weeks ago', prep: 'Keep batter ready the day before',
      cook: { skill: 'Easy with ready batter', equipment: 'Idli steamer, pressure cooker', special: 'Idli batter, drumstick for sambar', recipe: ['Steam idlis 12 minutes.', 'Pressure cook toor dal, add sambar masala and vegetables.', 'Temper with mustard and curry leaves.'] } },
    dosa:         { name: 'Masala dosa', img: IMG('masala-dosa'), meal: 'Breakfast', cuisine: 'South Indian', protein: 7, pc: 0.2, time: 40, complexity: 'Medium', healthy: false, descriptor: 'Filling', lastCooked: 'Never', prep: 'Batter needs an overnight ferment',
      cook: { skill: 'Spreading thin dosas takes practice', equipment: 'Cast iron or nonstick tawa', special: 'Dosa batter', recipe: ['Make potato masala with onion, turmeric, mustard.', 'Spread batter thin on a hot tawa, drizzle ghee.', 'Fill and fold when crisp.'] } },
    upma:         { name: 'Rava upma', img: IMG('upma'), meal: 'Breakfast', cuisine: 'South Indian', protein: 6, pc: 0.2, time: 20, complexity: 'Easy', healthy: true, descriptor: 'Light', lastCooked: '6 weeks ago',
      cook: { skill: 'Basic, one pan', equipment: 'Kadhai', special: 'None', recipe: ['Roast rava till fragrant, set aside.', 'Temper mustard, urad dal, onion, ginger.', 'Add hot water, stir in rava, rest covered.'] } },
    dalTadka:     { name: 'Dal tadka', img: IMG('dal-tadka'), meal: 'Lunch', cuisine: 'North Indian', protein: 12, pc: 0.5, time: 30, complexity: 'Easy', healthy: true, descriptor: 'High protein', lastCooked: 'Last week',
      cook: { skill: 'Basic', equipment: 'Pressure cooker', special: 'None', recipe: ['Pressure cook toor dal with turmeric.', 'Temper ghee, cumin, garlic, red chilli.', 'Pour tadka over dal, finish with coriander.'] } },
    palakPaneer:  { name: 'Palak paneer', img: IMG('palak-paneer'), meal: 'Lunch', cuisine: 'North Indian', protein: 19, pc: 1.4, time: 35, complexity: 'Medium', healthy: true, descriptor: 'High protein', lastCooked: '3 weeks ago',
      cook: { skill: 'Comfortable, needs blanching and a quick blend', equipment: 'Pressure cooker, mixer jar', special: 'Fresh palak, two bunches', recipe: ['Blanch palak two minutes, cool, blend smooth.', 'Saute onion, ginger, garlic, tomato; add spices and puree.', 'Simmer five minutes, fold in paneer, finish with cream.'] } },
    chickenCurry: { name: 'Home chicken curry', img: IMG('chicken-curry'), meal: 'Lunch', cuisine: 'North Indian', protein: 32, pc: 2.8, time: 45, complexity: 'Medium', healthy: true, descriptor: 'High protein', lastCooked: '2 weeks ago',
      cook: { skill: 'Comfortable, browning matters', equipment: 'Heavy kadhai', special: 'Curry cut chicken, 600g', recipe: ['Brown onions slowly, add ginger garlic paste.', 'Add tomato and spices, cook till oil separates.', 'Add chicken, simmer covered 25 minutes.'] } },
    eggCurry:     { name: 'Egg curry', img: IMG('egg-curry'), meal: 'Lunch', cuisine: 'North Indian', protein: 16, pc: 1.6, time: 30, complexity: 'Easy', healthy: true, descriptor: 'High protein', lastCooked: '4 weeks ago',
      cook: { skill: 'Basic', equipment: 'Kadhai', special: 'None', recipe: ['Boil eggs, halve them.', 'Make onion tomato masala with garam masala.', 'Slide eggs in, simmer five minutes.'] } },
    fishCurry:    { name: 'Fish curry', img: IMG('fish-curry'), meal: 'Lunch', cuisine: 'Coastal', protein: 28, pc: 2.4, time: 40, complexity: 'Medium', healthy: true, descriptor: 'High protein', lastCooked: '2 weeks ago',
      cook: { skill: 'Comfortable, fish breaks if overstirred', equipment: 'Wide pan', special: 'Seer or basa, 500g; tamarind', recipe: ['Make a tamarind and onion base with curry powder.', 'Slide fish pieces in, do not stir hard.', 'Simmer eight minutes, rest before serving.'] } },
    prawnMalai:   { name: 'Prawn malai curry', img: IMG('prawn-malai'), meal: 'Lunch', cuisine: 'Bengali', protein: 24, pc: 1.8, time: 50, complexity: 'Hard', healthy: false, descriptor: 'Filling', lastCooked: 'Never',
      cook: { skill: 'Confident, prawns overcook fast and coconut base needs patience', equipment: 'Heavy pan', special: 'Prawns 400g, thick coconut milk', recipe: ['Devein prawns, marinate in turmeric and salt.', 'Make a paste of onion, ginger; fry in ghee with whole spices.', 'Add coconut milk, simmer; add prawns for the last four minutes.'] } },
    rajma:        { name: 'Rajma', img: IMG('rajma'), meal: 'Lunch', cuisine: 'North Indian', protein: 15, pc: 0.6, time: 50, complexity: 'Medium', healthy: true, descriptor: 'Filling', lastCooked: '5 weeks ago', prep: 'Soak rajma the night before',
      cook: { skill: 'Basic, needs overnight soak', equipment: 'Pressure cooker', special: 'Soak rajma the night before', recipe: ['Pressure cook soaked rajma till soft.', 'Cook onion tomato masala with rajma masala.', 'Combine and simmer 15 minutes till thick.'] } },
    chanaMasala:  { name: 'Chana masala', img: IMG('chana-masala'), meal: 'Lunch', cuisine: 'North Indian', protein: 14, pc: 0.5, time: 45, complexity: 'Medium', healthy: true, descriptor: 'High protein', lastCooked: 'Never', prep: 'Soak chana the night before',
      cook: { skill: 'Basic, needs overnight soak', equipment: 'Pressure cooker', special: 'Soak chana the night before', recipe: ['Pressure cook soaked chana with tea bag for colour.', 'Make a dark onion masala with anardana.', 'Simmer chana in masala 15 minutes.'] } },
    bhindiFry:    { name: 'Bhindi fry', img: IMG('bhindi-fry'), meal: 'Lunch', cuisine: 'North Indian', protein: 4, pc: 0.4, time: 25, complexity: 'Easy', healthy: true, descriptor: 'Light', lastCooked: 'Last week',
      cook: { skill: 'Basic, dry the bhindi well', equipment: 'Kadhai', special: 'Fresh bhindi, 400g', recipe: ['Wash and dry bhindi fully, cut into rounds.', 'Fry on high till edges crisp.', 'Season with amchur and salt at the end.'] } },
    bhindiMasala: { name: 'Bhindi masala', img: IMG('bhindi-masala'), meal: 'Lunch', cuisine: 'North Indian', protein: 5, pc: 0.4, time: 30, complexity: 'Easy', healthy: true, descriptor: 'Light', lastCooked: '4 weeks ago',
      cook: { skill: 'Basic', equipment: 'Kadhai', special: 'Fresh bhindi, 400g', recipe: ['Fry bhindi separately till nearly done.', 'Make onion tomato masala.', 'Toss bhindi in masala for five minutes.'] } },
    alooGobi:     { name: 'Aloo gobi', img: IMG('aloo-gobi'), meal: 'Lunch', cuisine: 'North Indian', protein: 5, pc: 0.2, time: 30, complexity: 'Easy', healthy: true, descriptor: 'Light', lastCooked: '3 weeks ago',
      cook: { skill: 'Basic', equipment: 'Kadhai with lid', special: 'None', recipe: ['Saute cumin, ginger, then potato and gobi.', 'Add turmeric, coriander powder, salt.', 'Cover and cook on low till tender.'] } },
    jeeraRice:    { name: 'Jeera rice', img: IMG('jeera-rice'), meal: 'Lunch', cuisine: 'North Indian', protein: 4, pc: 0.1, time: 20, complexity: 'Easy', healthy: false, descriptor: 'Light', lastCooked: 'Last week',
      cook: { skill: 'Basic', equipment: 'Pot with lid', special: 'None', recipe: ['Temper cumin in ghee.', 'Add soaked rice and water, cook covered.'] } },
    chapati:      { name: 'Chapati', img: IMG('chapati'), meal: 'Lunch', cuisine: 'North Indian', protein: 6, pc: 0.2, time: 25, complexity: 'Easy', healthy: true, descriptor: 'Light', lastCooked: 'Last week',
      cook: { skill: 'Comfortable rolling', equipment: 'Tawa, rolling pin', special: 'None', recipe: ['Knead soft atta dough, rest 15 minutes.', 'Roll thin rounds, cook on hot tawa till puffed.'] } },
    lemonRice:    { name: 'Lemon rice', img: IMG('lemon-rice'), meal: 'Lunch', cuisine: 'South Indian', protein: 4, pc: 0.1, time: 20, complexity: 'Easy', healthy: false, descriptor: 'Light', lastCooked: 'Never',
      cook: { skill: 'Basic', equipment: 'Kadhai', special: 'None', recipe: ['Temper mustard, chana dal, peanuts, curry leaves.', 'Add turmeric and cooked rice.', 'Finish with lemon juice off the heat.'] } },
    curdRice:     { name: 'Curd rice', img: IMG('curd-rice'), meal: 'Lunch', cuisine: 'South Indian', protein: 8, pc: 0.4, time: 15, complexity: 'Easy', healthy: true, descriptor: 'Light', lastCooked: '2 weeks ago',
      cook: { skill: 'Basic', equipment: 'None special', special: 'Fresh curd', recipe: ['Mash warm rice with curd, milk and salt.', 'Temper mustard, curry leaves, ginger; mix in.'] } },
    kadhaiPaneer: { name: 'Kadhai paneer', img: IMG('kadhai-paneer'), meal: 'Lunch', cuisine: 'North Indian', protein: 20, pc: 1.5, time: 40, complexity: 'Medium', healthy: true, descriptor: 'High protein', lastCooked: 'Never',
      cook: { skill: 'Comfortable, fresh ground masala is the point', equipment: 'Kadhai, small grinder', special: 'Paneer 250g, capsicum', recipe: ['Dry roast and crush coriander seeds and red chilli.', 'Cook onion, tomato, capsicum with the kadhai masala.', 'Fold in paneer, finish with kasuri methi.'] } },
    matarPaneer:  { name: 'Matar paneer', img: IMG('matar-paneer'), meal: 'Lunch', cuisine: 'North Indian', protein: 17, pc: 1.1, time: 35, complexity: 'Medium', healthy: true, descriptor: 'High protein', lastCooked: 'Never',
      cook: { skill: 'Basic gravy work', equipment: 'Kadhai, mixer jar', special: 'Paneer 250g, green peas', recipe: ['Blend a smooth onion tomato gravy.', 'Simmer with garam masala, add peas.', 'Add paneer cubes for the last five minutes.'] } },
    vegPulao:     { name: 'Vegetable pulao', img: IMG('veg-pulao'), meal: 'Lunch', cuisine: 'North Indian', protein: 7, pc: 0.2, time: 35, complexity: 'Easy', healthy: false, descriptor: 'Complete meal', lastCooked: '6 weeks ago',
      cook: { skill: 'Basic', equipment: 'Pot with lid', special: 'None', recipe: ['Saute whole spices and vegetables.', 'Add soaked basmati and water, cook covered.'] } },
    dalMakhani:   { name: 'Dal makhani', img: IMG('dal-makhani'), meal: 'Lunch', cuisine: 'North Indian', protein: 13, pc: 0.6, time: 60, complexity: 'Hard', healthy: false, descriptor: 'Filling', lastCooked: 'Never', prep: 'Soak whole urad the night before',
      cook: { skill: 'Patient, long slow simmer is the dish', equipment: 'Pressure cooker, heavy pot', special: 'Whole urad, soak overnight; cream', recipe: ['Pressure cook soaked urad and rajma till very soft.', 'Simmer with butter, tomato puree and spices for 40 minutes.', 'Finish with cream, rest before serving.'] } },
  };

  // Fruit of the day library. One in-season fruit per day, its own light section,
  // category-locked (swap only, no add, no delete, no one-off). Quieter than a dish:
  // a soft colour swatch stands in for a photo.
  const FRUITS = {
    banana:      { name: 'Banana bowl', fruit: true, swatch: '#EAD9A6', time: 5, season: 'All year' },
    papaya:      { name: 'Papaya', fruit: true, swatch: '#F0C39A', time: 5, season: 'Monsoon' },
    muskmelon:   { name: 'Muskmelon', fruit: true, swatch: '#E9D49B', time: 5, season: 'Summer' },
    watermelon:  { name: 'Watermelon', fruit: true, swatch: '#E7B6AE', time: 5, season: 'Summer' },
    pomegranate: { name: 'Pomegranate', fruit: true, swatch: '#DDA6A0', time: 5, season: 'Monsoon' },
    guava:       { name: 'Guava', fruit: true, swatch: '#D7DEB0', time: 5, season: 'Monsoon' },
    sapota:      { name: 'Chikoo', fruit: true, swatch: '#D3BC9C', time: 5, season: 'Monsoon' },
  };

  // One line descriptions, shown under the dish name in details.
  const DESC = {
    poha: 'Flattened rice tossed with onion, curry leaves and lemon',
    omelette: 'Eggs whisked with onion, chilli and coriander',
    chilla: 'Savoury gram flour pancakes with ajwain',
    idli: 'Steamed rice cakes with a vegetable sambar',
    dosa: 'Crisp rice crepe around a spiced potato filling',
    upma: 'Soft roasted rava with mustard and ginger',
    dalTadka: 'Toor dal finished with a ghee and garlic tadka',
    palakPaneer: 'Paneer cubes in a smooth spinach gravy',
    chickenCurry: 'Everyday curry built on slow browned onions',
    eggCurry: 'Boiled eggs in an onion tomato masala',
    fishCurry: 'Gently simmered fish in a tangy tamarind base',
    prawnMalai: 'Prawns in a rich coconut milk gravy',
    rajma: 'Kidney beans simmered till thick and creamy',
    chanaMasala: 'Chana in a dark, tangy onion masala',
    bhindiFry: 'Crisp fried okra with amchur',
    bhindiMasala: 'Okra tossed in onion tomato masala',
    alooGobi: 'Dry potato and cauliflower with turmeric',
    jeeraRice: 'Basmati tempered with cumin in ghee',
    chapati: 'Soft whole wheat flatbreads',
    lemonRice: 'Rice with lemon, peanuts and curry leaves',
    curdRice: 'Cooling curd rice with a mustard tempering',
    kadhaiPaneer: 'Paneer and capsicum in a fresh ground kadhai masala',
    matarPaneer: 'Paneer and peas in a smooth tomato gravy',
    vegPulao: 'Basmati cooked with whole spices and vegetables',
    dalMakhani: 'Whole urad simmered long with butter and cream',
  };
  Object.keys(DESC).forEach((k) => { if (DISHES[k]) DISHES[k].desc = DESC[k]; });

  // Plain language complexity, used everywhere the user sees it.
  const COMPLEXITY_LABELS = { Easy: 'Easy to cook', Medium: 'Cook will need some help', Hard: 'Takes time and effort' };

  // Week of June 15 to 20. Entry: { key, includeRecipe } or { custom: name, includeRecipe }.
  // Breakfast is savoury only. Each Mon-Sat day also carries a category-locked fruit.
  const WEEK = [
    { id: 'mon', day: 'Monday', short: 'Mon', date: 15, fruit: 'banana',
      breakfast: [{ key: 'poha' }, { key: 'omelette' }], lunch: [{ key: 'dalTadka' }, { key: 'bhindiFry' }, { key: 'chapati' }] },
    { id: 'tue', day: 'Tuesday', short: 'Tue', date: 16, fruit: 'papaya',
      breakfast: [{ key: 'chilla' }], lunch: [{ key: 'chickenCurry' }, { key: 'jeeraRice' }, { key: 'alooGobi' }, { key: 'curdRice' }] },
    { id: 'wed', day: 'Wednesday', short: 'Wed', date: 17, fruit: 'muskmelon',
      breakfast: [{ key: 'idli' }, { key: 'omelette' }], lunch: [{ key: 'palakPaneer', includeRecipe: true }, { key: 'lemonRice' }, { key: 'bhindiMasala' }] },
    { id: 'thu', day: 'Thursday', short: 'Thu', date: 18, fruit: 'pomegranate',
      breakfast: [{ key: 'upma' }], lunch: [{ key: 'fishCurry' }, { key: 'vegPulao' }, { key: 'curdRice' }, { key: 'chapati' }] },
    { id: 'fri', day: 'Friday', short: 'Fri', date: 19, fruit: 'guava',
      breakfast: [{ key: 'poha' }, { key: 'chilla' }], lunch: [{ key: 'eggCurry' }, { key: 'jeeraRice' }, { key: 'bhindiFry' }] },
    { id: 'sat', day: 'Saturday', short: 'Sat', date: 20, fruit: 'sapota',
      breakfast: [], lunch: [{ key: 'rajma' }, { key: 'chapati' }, { key: 'alooGobi' }] },
  ];

  // Explore: dishes never cooked, with a short reason they fit this household.
  const EXPLORE_WHY = {
    kadhaiPaneer: 'You cook paneer most weeks; this one is new',
    matarPaneer: 'Close to your usual paneer gravies',
    chanaMasala: 'Fits your high protein lunches',
    prawnMalai: 'You like prawns; this is a weekend dish',
    dosa: 'A change from idli mornings',
    lemonRice: 'Quick rice change from jeera rice',
    dalMakhani: 'A slow Sunday style dal',
  };

  // Grocery list, fixed group order. Each item is { name, qty }. Tracked items
  // (a declared pack size) round up to whole packs and show the pack count.
  const GROCERY = [
    { group: 'Proteins and Dairy', items: [
      { name: 'Chicken', qty: '600 g' },
      { name: 'Curd', qty: '1 kg (1 pack)' },
      { name: 'Egg', qty: '12 pcs' },
      { name: 'Fish', qty: '500 g (1 pack)' },
      { name: 'Milk', qty: '1 L' },
      { name: 'Paneer', qty: '500 g (2 packs)' },
    ] },
    { group: 'Pantry', items: [
      { name: 'Besan', qty: '500 g (1 pack)' },
      { name: 'Idli batter', qty: '1 kg (1 pack)' },
      { name: 'Poha', qty: '500 g (1 pack)' },
      { name: 'Rajma', qty: '250 g' },
      { name: 'Rava', qty: '200 g' },
      { name: 'Toor dal', qty: '500 g (1 pack)' },
    ] },
    { group: 'Vegetables', items: [
      { name: 'Bhindi', qty: '800 g' },
      { name: 'Cauliflower', qty: '1 pc' },
      { name: 'Green pea', qty: '250 g' },
      { name: 'Onion', qty: '2 kg' },
      { name: 'Palak', qty: '2 bunches' },
      { name: 'Potato', qty: '1 kg' },
      { name: 'Tomato', qty: '1.5 kg' },
    ] },
    { group: 'Aromatics and Herbs', items: [
      { name: 'Coriander', qty: '3 bunches' },
      { name: 'Curry leaves', qty: '2 sprigs' },
      { name: 'Garlic', qty: '200 g' },
      { name: 'Ginger', qty: '200 g' },
      { name: 'Green chilli', qty: '100 g' },
      { name: 'Lemon', qty: '6 pcs' },
    ] },
    { group: 'Other', items: [
      { name: 'Coconut milk', qty: '400 ml' },
      { name: 'Tamarind', qty: '100 g' },
    ] },
  ];

  // Fruit of the day, listed in its own quiet group at the foot of the buy list.
  const GROCERY_FRUIT = { group: 'Fruit', items: [
    { name: 'Banana', qty: '6 pcs' },
    { name: 'Papaya', qty: '1 pc' },
    { name: 'Muskmelon', qty: '1 pc' },
    { name: 'Pomegranate', qty: '2 pcs' },
    { name: 'Guava', qty: '4 pcs' },
    { name: 'Chikoo', qty: '6 pcs' },
  ] };

  const CUISINES = ['North Indian', 'South Indian', 'Coastal', 'Bengali', 'Maharashtrian'];

  const ACTIVITY = [
    { who: 'Tuhina', kind: 'swap', text: 'Swapped Wednesday lunch to palak paneer', when: '2h ago', reason: 'Palak is fresh at the market' },
    { who: 'Rajat', kind: 'add', text: 'Added curd rice to Tuesday', when: 'Yesterday', reason: 'Tuesday lunch felt heavy' },
    { who: 'Tuhina', kind: 'skip', text: 'Skipped Saturday', when: 'Yesterday', reason: 'Plan changed, eating out' },
    // Historical comment. Comment entry was removed from the UI; the Changes tab
    // still renders comments queued earlier (and by the untouched backend).
    { who: 'Rajat', kind: 'comment', text: 'Thursday has two rice dishes, feels heavy', when: '2 days ago', reason: '' },
  ];

  // ---------------------------------------------------------------------------
  // Day-aware grocery model.
  //
  // The Grocery tab is forward looking: it lists only what is still to be bought
  // for the days that have not passed. To do that it needs ingredients attributed
  // to dishes, not a single hand made aggregate. INGREDIENTS maps each dish that
  // appears on the week to its shopping ingredients (the items you buy, not the
  // salt and oil you always have), in a canonical unit. ING_META carries each
  // ingredient's group and, where it is sold in packs, its pack size, so the list
  // can round up to whole packs the way the legacy list did.
  // ---------------------------------------------------------------------------
  const ING_META = {
    Chicken: { g: 'Proteins and Dairy', u: 'g' },
    Fish: { g: 'Proteins and Dairy', u: 'g', pack: 500 },
    Egg: { g: 'Proteins and Dairy', u: 'pc', pack: 6 },
    Paneer: { g: 'Proteins and Dairy', u: 'g', pack: 250 },
    Curd: { g: 'Proteins and Dairy', u: 'g', pack: 1000 },
    Milk: { g: 'Proteins and Dairy', u: 'ml', pack: 1000 },
    Cream: { g: 'Proteins and Dairy', u: 'ml', pack: 200 },
    Poha: { g: 'Pantry', u: 'g', pack: 500 },
    Besan: { g: 'Pantry', u: 'g', pack: 500 },
    'Idli batter': { g: 'Pantry', u: 'g', pack: 500 },
    Rava: { g: 'Pantry', u: 'g' },
    'Toor dal': { g: 'Pantry', u: 'g', pack: 500 },
    Rajma: { g: 'Pantry', u: 'g' },
    'Basmati rice': { g: 'Pantry', u: 'g' },
    Rice: { g: 'Pantry', u: 'g' },
    Atta: { g: 'Pantry', u: 'g' },
    Peanuts: { g: 'Pantry', u: 'g' },
    Onion: { g: 'Vegetables', u: 'g' },
    Tomato: { g: 'Vegetables', u: 'g' },
    Potato: { g: 'Vegetables', u: 'g' },
    Bhindi: { g: 'Vegetables', u: 'g' },
    Cauliflower: { g: 'Vegetables', u: 'pc' },
    Palak: { g: 'Vegetables', u: 'bunch' },
    'Green pea': { g: 'Vegetables', u: 'g' },
    Ginger: { g: 'Aromatics and Herbs', u: 'g' },
    Garlic: { g: 'Aromatics and Herbs', u: 'g' },
    'Green chilli': { g: 'Aromatics and Herbs', u: 'g' },
    Coriander: { g: 'Aromatics and Herbs', u: 'bunch' },
    'Curry leaves': { g: 'Aromatics and Herbs', u: 'sprig' },
    Lemon: { g: 'Aromatics and Herbs', u: 'pc' },
    Tamarind: { g: 'Pantry', u: 'g' },
  };

  // Dish -> [ [ingredient, qty in canonical unit], ... ]. Only dishes on the week.
  const INGREDIENTS = {
    poha: [['Poha', 125], ['Onion', 100], ['Potato', 80], ['Peanuts', 25], ['Lemon', 1], ['Curry leaves', 1]],
    omelette: [['Egg', 3], ['Onion', 40], ['Green chilli', 8], ['Coriander', 0.3]],
    chilla: [['Besan', 120], ['Onion', 50], ['Green chilli', 8], ['Coriander', 0.3]],
    idli: [['Idli batter', 500], ['Toor dal', 60], ['Onion', 50], ['Tomato', 80], ['Curry leaves', 1]],
    upma: [['Rava', 150], ['Onion', 50], ['Ginger', 15], ['Curry leaves', 1]],
    dalTadka: [['Toor dal', 150], ['Tomato', 100], ['Garlic', 25], ['Coriander', 0.3]],
    bhindiFry: [['Bhindi', 400], ['Onion', 40]],
    chapati: [['Atta', 250]],
    chickenCurry: [['Chicken', 600], ['Onion', 250], ['Tomato', 200], ['Ginger', 25], ['Garlic', 25], ['Coriander', 0.3]],
    jeeraRice: [['Basmati rice', 180]],
    alooGobi: [['Potato', 250], ['Cauliflower', 1], ['Tomato', 80]],
    curdRice: [['Curd', 400], ['Milk', 150], ['Rice', 150], ['Curry leaves', 1]],
    palakPaneer: [['Paneer', 250], ['Palak', 2], ['Onion', 80], ['Tomato', 80], ['Cream', 40]],
    lemonRice: [['Rice', 180], ['Peanuts', 25], ['Lemon', 2], ['Curry leaves', 1]],
    bhindiMasala: [['Bhindi', 350], ['Onion', 80], ['Tomato', 80]],
    fishCurry: [['Fish', 500], ['Onion', 120], ['Tomato', 80], ['Tamarind', 40]],
    vegPulao: [['Basmati rice', 180], ['Green pea', 100], ['Onion', 80]],
    eggCurry: [['Egg', 6], ['Onion', 120], ['Tomato', 120], ['Ginger', 15], ['Garlic', 15]],
    rajma: [['Rajma', 250], ['Onion', 120], ['Tomato', 120], ['Ginger', 15], ['Garlic', 15]],
  };

  // Per-day fruit purchase (its own quiet group, in upcoming-day order).
  const FRUIT_BUY = {
    banana: ['Banana', 6], papaya: ['Papaya', 1], muskmelon: ['Muskmelon', 1],
    pomegranate: ['Pomegranate', 2], guava: ['Guava', 4], sapota: ['Chikoo', 6],
  };

  const GROUP_ORDER = ['Proteins and Dairy', 'Fruit', 'Vegetables', 'Aromatics and Herbs', 'Other', 'Pantry'];
  // Items pinned to the end of their group, overriding the default A-Z order.
  const ITEM_LAST = { Besan: 1 };
  function sortItems(a, b) {
    const la = ITEM_LAST[a] ? 1 : 0, lb = ITEM_LAST[b] ? 1 : 0;
    if (la !== lb) return la - lb;
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function trimNum(n) { return Number(n.toFixed(2)); }
  function roundUpNice(x) {
    if (x <= 0) return 0;
    if (x < 100) return Math.ceil(x / 10) * 10;
    if (x < 1000) return Math.ceil(x / 50) * 50;
    return Math.ceil(x / 100) * 100;
  }
  function fmtWeight(g) { return g >= 1000 ? trimNum(g / 1000) + ' kg' : g + ' g'; }
  function fmtVol(ml) { return ml >= 1000 ? trimNum(ml / 1000) + ' L' : ml + ' ml'; }
  function packNote(n) { return ' (' + n + ' pack' + (n > 1 ? 's' : '') + ')'; }

  function formatQty(name, total) {
    const m = ING_META[name];
    if (!m) return total + '';
    if (m.u === 'pc') {
      let n = Math.ceil(total);
      if (m.pack) n = Math.ceil(n / m.pack) * m.pack;
      return n + ' ' + (n === 1 ? 'pc' : 'pcs');
    }
    if (m.u === 'bunch') { const n = Math.ceil(total); return n + ' ' + (n === 1 ? 'bunch' : 'bunches'); }
    if (m.u === 'sprig') { const n = Math.ceil(total); return n + ' ' + (n === 1 ? 'sprig' : 'sprigs'); }
    if (m.u === 'g') {
      if (m.pack) { const p = Math.ceil(total / m.pack); return fmtWeight(p * m.pack) + packNote(p); }
      return fmtWeight(roundUpNice(total));
    }
    if (m.u === 'ml') {
      if (m.pack) { const p = Math.ceil(total / m.pack); return fmtVol(p * m.pack) + packNote(p); }
      return fmtVol(roundUpNice(total));
    }
    return total + '';
  }

  // Build the grocery list from a set of week-day objects. Skipped days and days
  // without dishes contribute nothing. Returns grouped items (fixed order, with a
  // Fruit group last) and the total item-row count.
  function computeGrocery(days) {
    const acc = {};
    const fruitAcc = {};
    days.forEach((d) => {
      if (!d || d.skipped) return;
      [...(d.breakfast || []), ...(d.lunch || [])].forEach((e) => {
        if (!e.key || !INGREDIENTS[e.key]) return;
        INGREDIENTS[e.key].forEach(([name, qty]) => { acc[name] = (acc[name] || 0) + qty; });
      });
      if (d.fruit && FRUIT_BUY[d.fruit]) { const fb = FRUIT_BUY[d.fruit]; fruitAcc[fb[0]] = (fruitAcc[fb[0]] || 0) + fb[1]; }
    });
    const groups = GROUP_ORDER.map((g) => {
      if (g === 'Fruit') {
        const names = Object.keys(fruitAcc);
        return names.length ? { group: 'Fruit', items: names.map((n) => ({ name: n, qty: fruitAcc[n] + ' ' + (fruitAcc[n] === 1 ? 'pc' : 'pcs') })) } : null;
      }
      const items = Object.keys(acc).filter((n) => ING_META[n] && ING_META[n].g === g).sort(sortItems)
        .map((n) => ({ name: n, qty: formatQty(n, acc[n]) }));
      return items.length ? { group: g, items } : null;
    }).filter(Boolean);
    const count = groups.reduce((n, g) => n + g.items.length, 0);
    return { groups, count };
  }

  // The prototype clock. Today is Wednesday June 17, early afternoon, so the
  // "include today after 11 AM" rule resolves to off by default (the day's run is
  // assumed done). The live app reads the device clock.
  const NOW = { date: 17, dayId: 'wed', dayName: 'Wednesday', short: 'Wed', hour: 14, minute: 5 };

  window.PlantryData = { DISHES, FRUITS, WEEK, EXPLORE_WHY, GROCERY, GROCERY_FRUIT, CUISINES, ACTIVITY, COMPLEXITY_LABELS, INGREDIENTS, ING_META, FRUIT_BUY, computeGrocery, NOW };
})();
