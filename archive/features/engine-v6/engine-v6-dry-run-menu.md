# Engine v6 dry-run menu: 10 weeks from 2026-08-31

This is a read-only dry run of `features/engine-v6.md`, generated 2026-08-27 by a throwaway prototype simulator (scratchpad only, nothing in the repo tree, nothing written to production). The simulator implements the v6 mechanism end to end: the cumulative as-eaten record and per-dish rates (§2), the deficit ledger with accrual, charge, and cold start at 0 (§3), structural versus optional slot filling, the two weekday anchors (§4), the §5 composition forms and amendments, plan-then-place generation in the six ordered steps with LRU-weekday assignment and the deterministic constraint pass (§6), exploration (§7), favorites pinning (§8, the prod favorites table holds one row, Avocado toast), and season-scoped fruit deficits (§9). It self-feeds: each generated week finalizes into the record exactly as generated (no swaps, no skips) and feeds the next. The starting record is the 5 seed weeks of `data/menu_history.md` plus the 8 served weeks of `features/as-eaten-8-weeks.md` (13 record weeks; every dish name resolved to a library id; the 6 "(custom)" one-offs have no library id and contribute no rows). The determinism check passes: two full simulation runs produce byte-identical output. The season boundary falls inside the window; weeks starting in September run as Monsoon, weeks starting 2026-10-05 onward as Winter.

**Known approximations against the spec.** Where a clause was ambiguous the most literal implementable reading was taken, never a redesign:

1. A week's season is the season of its start date, so the week of 2026-09-28 runs as Monsoon although its Thursday to Saturday fall in October.
2. Winter fruit rates divide by the number of Winter record weeks, which is zero until the first Winter week finalizes; the rate is taken as 0 in that case, so the first Winter week selects fruit on deficits carried over from Monsoon.
3. Exploration runs two picks whenever two placeable candidates exist ("up to two, at least one" gives no selector between one and two). A companion-shaped pick attaches to the first accepting Indian plate that is not itself an exploration pick's plate, which keeps the two picks on distinct days.
4. The LRU tie-break "fewest total occupations" among never-occupied weekdays is read as the dish's total occupations of that weekday across all meals.
5. The Saturday everyday-base-plus-special-protein form is implemented through the Saturday protein floor with its category restriction (Keto or Dry dish, never complete_meal or Gravy) rather than as a composite treat-pool entry; a non-protein treat main (khichdi, veg pulao, curd rice) draws its special protein that way, which is how Khichdi plus a protein and Veg pulao plus a protein arise below.
6. The §5.3 international ceiling of 2 is counted over weekday lunch stars only; a Saturday international treat (the treat register explicitly includes them) does not consume it.
7. Carb-forward international mains are detected by name (noodle, pasta, spaghetti, macaroni, fried rice) on non-Indian complete meals; the dry-protein companion pool is HP-or-Keto dishes in Category Keto or Dry dish, with tikka and grilled preparations allowed across registers as the amendment intends.
8. There is no treat-register field in the library; the treat pool is every eligible Lunch dish carrying the complete_meal tag or Category Complete meal, per §5.4.
9. The lunch-star pool is HP dishes plus Category Gravy dish, Keto, and Complete meal (dal-family dishes are Gravy category, so hearty dals are stars); Category Accompaniment dishes, including HP salads, stay companions and floor candidates, never stars.
10. Per §13, Soya chunks masala's HP tag is ignored for the protein floor (it counts as a sabzi, never the day's protein), and tofu and soya-as-protein dishes are excluded from the exploration pool as if the §13 deactivation content task had run; the library itself still marks them Active.
11. The dish-driven chutney (Chilla or Paratha main), the boiled-eggs-standalone chutney, and the Thursday light-grain boiled-eggs rider are treated as structural; all other breakfast small items follow the positive-deficit optional rule. No breakfast protein floor exists (it is not in the §5 retained list; the §5.2 form governs).
12. Indian complete-meal lunch mains may take one small companion from Category Accompaniment only, by the positive-deficit rule.
13. Constraint-pass repairs refund the replaced dish's charge and charge the replacement (the spec's no-refund rule is written for household swap-outs, not engine-internal repairs). Cross-meal conflicts try a whole-plate swap between days first, then next-ranked replacement, then allow the repeat.
14. Prep-ceiling repairs treat optional lunch companions and breakfast small items as droppable; the carb, star, dessert, and protein floor are protected.
15. The Saturday accompaniment is not cuisine-filtered (the record itself mixes registers on Saturday), and the rice-spacing rule is keyed on Category Rice items.
16. The Explore affinity score uses row-weighted ingredient and category shares and the row-weighted median of derived per-person protein; the §2 base rate formula is used throughout (the §14.1 variant was not A/B tested here).
17. The §3 reconciliation branch (hand swap-ins and swap-outs) is never exercised because the self-feed has no swaps.

**Measurements against the §11 gates.** The gate specifies a 60-week run measured on weeks 20 to 60; this 10-week horizon is entirely warm-up, so every number below carries that caveat.

1. Distribution fidelity (served rate per week over 10 weeks vs record rate, threshold within 25 percent): chicken 2.00 vs 1.92 (+4, pass), fish 1.00 vs 0.85 (+18, pass), prawn 0.50 vs 0.46 (+8, pass), dal-family 1.80 vs 1.54 (+17, pass), international rows 0.80 vs 1.00 (-20, pass), plain roti 2.80 vs 2.69 (+4, pass), raita/curd 0.90 vs 0.77 (+17, pass); egg 2.60 vs 2.08 (+25.2, marginal fail); mutton 0.20 vs 0.15 (+30 on a 2-row base, integer granularity at this horizon); salad 2.00 vs 1.54 (+30, fail); paneer 2.50 vs 1.69 (+48, fail, driven by the exploration channel's paneer-heavy picks); specialty roti 0.70 vs 0.38 (+82, fail). 7 of 12 clean passes.
2. Lunch-main uniqueness (at least 65 percent distinct over rolling 8 weeks): 85, 92, 92 percent across the three windows. Pass.
3. Week-over-week Jaccard (band 0.20 to 0.35): average 0.161, below the band and the household baseline 0.263. Fail at this horizon; the warm-up ledger spreads dishes so widely that consecutive weeks share little beyond roti, boiled eggs, and fruit.
4. Slot anti-lock (no dish in the same weekday-meal slot more than half the weeks): fails for Boiled eggs at Thursday breakfast (8 of 10) and for Roti at Wednesday, Thursday, and Friday lunch (6 of 10 each). No category day-lock: international lunches spread over 4 weekdays plus Saturday, specialty roti peaks at 3 of 10 on one day, no single chutney exceeds 5.
5. Saturday: treat mains all distinct within every rolling 8 Saturdays (10 treats, 8 distinct dishes, repeats 9 and 10 weeks apart), dessert on 10 of 10. Pass.
6. Fruit: Monsoon weeks run 6 distinct fruits, no repeats. Winter weeks run 3 distinct (the eligible eaten pool is exactly banana, papaya, pomegranate), max twice each, with occasional consecutive-day repeats; the thin-pool exception covers the repeats, but the 4-distinct floor is unsatisfiable in Winter with the current library and record. Fail by pool, not by mechanism.
7. Coverage (rolling 20-week window): not computable on 10 weeks. Indicator: every dish with eatenCount of 2 or more at start was served within the 10 weeks except Seasonal fruit, which is Active: No and correctly ineligible.
8. International persistence (0.75 to 1.75 per week per 10-week window): 0.4 weekday international lunches per week (0.5 counting the one Saturday international treat), window not zero. Fail at this horizon: once-eaten internationals carry a rate of 1/13 and need roughly 13 weeks of accrual before they surface, so the whole window is their warm-up.
9. Breakfast and forms (25-week window): not computable at this horizon. Indicators: 18 distinct breakfast mains in 10 weeks (the threshold is 10 over 25), standalone boiled-egg breakfasts present (7), dal-led lunches present (6). On track.
10. Plate size and effort: 5-item lunches 0 (pass), days over the 120-minute prep ceiling 0 (pass), 4-item lunches 16 of 60 lunch days at 27 percent (fail against the 10 percent line; every one is the protein floor appending a fourth item to a dal-led or veg-led 3-item plate, a shape the household's own record also produces regularly).

**Soft spots observed.**

- The Thursday egg anchor and gate 4 collide: Boiled eggs is the record's highest-rate breakfast item (about 1 serving per week), so it tops the egg-anchored pool most Thursdays, and the anchor pins the day. As written, §4 anchor 2 plus §11 gate 4 (no exemptions) cannot both hold.
- Gate 4 is arithmetically unsatisfiable for plain Roti: at its record rate of 2.69 lunches per week over 5 weekday slots, average slot occupancy is 5.4 of any 10 weeks, so some slot must exceed half. A §11 order-of-work amendment seems required for high-rate carbs.
- The exploration channel is paneer-and-egg heavy (the shared-ingredient affinity signal rewards the household's dominant ingredients), which is what pushed paneer to +48 percent at this horizon; 20 explored dishes also entered the record and will each demand future placements at rate 1/N.
- Exploration places only into weekday lunch positions, so no new fruit can ever enter the fruit rotation; combined with the 3-fruit Winter pool this makes the Winter fruit gate unreachable until the §14.4 winter fruit content task lands.
- Three plain breakfast carbs (Pav, Toast, Plain paratha) are placeable nowhere (Option C is dead per §13 and they fit no v6 form), so their deficits grow without bound; the §13 retagging content task is what resolves them.
- Specialty rotis over-serve (+82 percent) because the structural carb slot demands about 3.4 fills per week while the whole Chapati pool's summed rate is about 3.1; the deficit ledger drains plain Roti negative and hands the shortfall to the low-rate rotis by turn.

## Week of 2026-08-31 (Monsoon)

**Monday**

- Breakfast: Avocado toast (favorite)
- Lunch: Egg pulao (exploration), Cucumber salad
- Fruit: Pomegranate bowl
  **Tuesday**
- Breakfast: Bread omelette, Mint chutney
- Lunch: Bisi bele bath (exploration), Onion tomato salad, Chicken tikka (protein floor)
- Fruit: Banana bowl
  **Wednesday**
- Breakfast: Paneer paratha, Peanut chutney
- Lunch: Fish tikka, Roti (carb), Bhindi
- Fruit: Jamun bowl
  **Thursday**
- Breakfast: Boiled eggs, Garlic chutney
- Lunch: Grilled chicken breast, Roti (carb), Mixed veg salad
- Fruit: Mango bowl
  **Friday**
- Breakfast: Vegetable sevai, Coriander chutney
- Lunch: Moong dal, Roti (carb), Carrot cucumber salad, Prawn pepper fry (protein floor)
- Fruit: Pineapple bowl
  **Saturday**
- Lunch: Khichdi (special), Raita, Kheer (dessert), Paneer do pyaza (protein floor)
- Fruit: Papaya bowl

## Week of 2026-09-07 (Monsoon)

**Monday**

- Breakfast: Sabudana khichdi, Boiled eggs
- Lunch: Kadhi, Lemon rice (carb), Mix veg sabzi, Chicken salad (protein floor)
- Fruit: Plum bowl
  **Tuesday**
- Breakfast: Aloo paratha, Mint chutney
- Lunch: Fish tikka, Roti (carb), Moong dal kosambari (exploration)
- Fruit: Litchi bowl
  **Wednesday**
- Breakfast: Besan paneer chilla, Peanut chutney
- Lunch: Palak chicken gravy, Roti (carb), Broccoli corn
- Fruit: Peach bowl
  **Thursday**
- Breakfast: Boiled eggs, Garlic chutney
- Lunch: Paneer fried rice (exploration), Cucumber raita
- Fruit: Papaya bowl
  **Friday**
- Breakfast: Avocado toast (favorite)
- Lunch: Chole, Steamed rice (carb), Jeera aloo, Prawn salad (protein floor)
- Fruit: Mango bowl
  **Saturday**
- Lunch: Chole bhature (special), Hummus, Fruit custard (dessert)
- Fruit: Pomegranate bowl

## Week of 2026-09-14 (Monsoon)

**Monday**

- Breakfast: Poha
- Lunch: Egg curry, Roti (carb), Capsicum aloo
- Fruit: Jamun bowl
  **Tuesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Spanish omelette (exploration), Grilled chicken breast (protein floor)
- Fruit: Mango bowl
  **Wednesday**
- Breakfast: Masala oats
- Lunch: Prawn curry, Roti (carb), Beans onion
- Fruit: Pineapple bowl
  **Thursday**
- Breakfast: Vegetable upma, Boiled eggs
- Lunch: Mushroom risotto (exploration), Chicken breast (protein floor)
- Fruit: Pomegranate bowl
  **Friday**
- Breakfast: Sprouts salad
- Lunch: Butter chicken, Roti (carb), Turai sabzi
- Fruit: Banana bowl
  **Saturday**
- Lunch: Pav bhaji (special), Raita, Sewaiyan kheer (dessert), Egg masala dry (protein floor)
- Fruit: Papaya bowl

## Week of 2026-09-21 (Monsoon)

**Monday**

- Breakfast: Paneer paratha, Mint chutney
- Lunch: Shakshuka (exploration)
- Fruit: Mango bowl
  **Tuesday**
- Breakfast: Vegetable sevai, Boiled eggs
- Lunch: Chicken curry, Beetroot roti (carb), Lauki sabzi
- Fruit: Pomegranate bowl
  **Wednesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Egg roast (exploration), Roti (carb), Bhindi
- Fruit: Litchi bowl
  **Thursday**
- Breakfast: Bread omelette, Garlic chutney
- Lunch: Fish tikka, Roti (carb), Malai kofta
- Fruit: Plum bowl
  **Friday**
- Breakfast: Grilled cheese sandwich
- Lunch: Aloo matar, Roti (carb), Palak corn, Fish fry (protein floor)
- Fruit: Banana bowl
  **Saturday**
- Lunch: Rajma chawal (special), Chicken breast salad, Suji halwa (dessert)
- Fruit: Peach bowl

## Week of 2026-09-28 (Monsoon)

**Monday**

- Breakfast: Avocado toast (favorite)
- Lunch: Dum aloo (exploration), Roti (carb), Cucumber tomato salad, Grilled chicken breast (protein floor)
- Fruit: Papaya bowl
  **Tuesday**
- Breakfast: Besan paneer chilla, Peanut chutney
- Lunch: Vegetable daliya (exploration), Cucumber salad, Chicken masala gravy (protein floor)
- Fruit: Litchi bowl
  **Wednesday**
- Breakfast: Chicken sandwich
- Lunch: Vegetable korma, Missi roti (carb), Mixed veg salad, Chilli paneer dry (protein floor)
- Fruit: Mango bowl
  **Thursday**
- Breakfast: Boiled eggs, Coriander chutney
- Lunch: Soya chunks masala, Roti (carb), Onion tomato salad, Pepper chicken dry (protein floor)
- Fruit: Jamun bowl
  **Friday**
- Breakfast: Aloo paratha, Garlic chutney
- Lunch: Fish tikka, Roti (carb), Mushroom matar
- Fruit: Pomegranate bowl
  **Saturday**
- Lunch: Singapore noodles (special), Raita, Shrikhand (dessert), Paneer tikka (protein floor)
- Fruit: Pineapple bowl

## Week of 2026-10-05 (Winter)

**Monday**

- Breakfast: Sabudana khichdi
- Lunch: Paneer jalfrezi (exploration), Roti (carb), Raita
- Fruit: Banana bowl
  **Tuesday**
- Breakfast: Paneer paratha, Garlic chutney
- Lunch: Egg bhurji keto (exploration), Roti (carb), Dal tadka
- Fruit: Papaya bowl
  **Wednesday**
- Breakfast: Boiled eggs, Peanut chutney
- Lunch: Moong dal, Beetroot roti (carb), Broccoli corn, Paneer salad (protein floor)
- Fruit: Pomegranate bowl
  **Thursday**
- Breakfast: Bread omelette, Mint chutney
- Lunch: Prawn pepper fry, Missi roti (carb), Masoor dal
- Fruit: Banana bowl
  **Friday**
- Breakfast: Avocado toast (favorite)
- Lunch: Chicken tikka, Roti (carb), Dal fry
- Fruit: Papaya bowl
  **Saturday**
- Lunch: Curd rice (special), Carrot cucumber salad, Kheer (dessert), Thai basil chicken (protein floor)
- Fruit: Pomegranate bowl

## Week of 2026-10-12 (Winter)

**Monday**

- Breakfast: Aloo paratha, Mint chutney
- Lunch: Paneer bhurji keto (exploration), Roti (carb), Toor dal
- Fruit: Pomegranate bowl
  **Tuesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Mushroom paneer (exploration), Roti (carb), Bhindi
- Fruit: Banana bowl
  **Wednesday**
- Breakfast: Vegetable upma
- Lunch: Fish tikka, Roti (carb), Chana dal
- Fruit: Papaya bowl
  **Thursday**
- Breakfast: Vegetable sevai, Boiled eggs
- Lunch: Palak paneer, Beetroot roti (carb), Jeera aloo
- Fruit: Papaya bowl
  **Friday**
- Breakfast: Anda bhurji
- Lunch: Fish curry, Missi roti (carb), Mix veg sabzi
- Fruit: Pomegranate bowl
  **Saturday**
- Lunch: Aloo puri (special), Egg salad, Fruit custard (dessert)
- Fruit: Banana bowl

## Week of 2026-10-19 (Winter)

**Monday**

- Breakfast: Paneer paratha
- Lunch: Veg biryani (exploration), Mutton keema (protein floor)
- Fruit: Papaya bowl
  **Tuesday**
- Breakfast: Paneer sandwich
- Lunch: Fish tikka, Roti (carb), Dal palak
- Fruit: Pomegranate bowl
  **Wednesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Paneer butter masala, Beetroot roti (carb), Mixed veg salad
- Fruit: Banana bowl
  **Thursday**
- Breakfast: Boiled eggs, Garlic chutney
- Lunch: Shahi paneer (exploration), Roti (carb), Onion tomato salad
- Fruit: Pomegranate bowl
  **Friday**
- Breakfast: Bread omelette
- Lunch: Grilled chicken breast, Roti (carb), Dal makhani
- Fruit: Banana bowl
  **Saturday**
- Lunch: Veg pulao (special), Raita, Sewaiyan kheer (dessert), Mutton pepper fry (protein floor)
- Fruit: Papaya bowl

## Week of 2026-10-26 (Winter)

**Monday**

- Breakfast: Avocado toast (favorite)
- Lunch: Paneer lababdar (exploration), Roti (carb), Cucumber salad
- Fruit: Banana bowl
  **Tuesday**
- Breakfast: Veg sandwich
- Lunch: Kadai paneer, Roti (carb)
- Fruit: Papaya bowl
  **Wednesday**
- Breakfast: Paneer bhurji
- Lunch: Chana pulao (exploration), Carrot cucumber salad, Palak chicken gravy (protein floor)
- Fruit: Pomegranate bowl
  **Thursday**
- Breakfast: Boiled eggs, Coriander chutney
- Lunch: Matar paneer, Roti (carb)
- Fruit: Banana bowl
  **Friday**
- Breakfast: Besan paneer chilla, Mint chutney
- Lunch: Chicken biryani
- Fruit: Papaya bowl
  **Saturday**
- Lunch: Khichdi (special), Hummus, Suji halwa (dessert), Fish tikka (protein floor)
- Fruit: Pomegranate bowl

## Week of 2026-11-02 (Winter)

**Monday**

- Breakfast: Vegetable sevai, Boiled eggs
- Lunch: Chole, Steamed rice (carb), Cucumber raita, Prawn pepper fry (protein floor)
- Fruit: Pomegranate bowl
  **Tuesday**
- Breakfast: Bread omelette
- Lunch: Vietnamese noodle salad (exploration), Chicken tikka
- Fruit: Banana bowl
  **Wednesday**
- Breakfast: Aloo paratha, Peanut chutney
- Lunch: Grilled chicken breast, Roti (carb), Panchmel dal
- Fruit: Papaya bowl
  **Thursday**
- Breakfast: Boiled eggs, Garlic chutney
- Lunch: Aloo tamatar sabzi (exploration), Roti (carb), Bhindi, Paneer do pyaza (protein floor)
- Fruit: Papaya bowl
  **Friday**
- Breakfast: Avocado toast (favorite)
- Lunch: Kadhi, Steamed rice (carb), Fish tikka (protein floor)
- Fruit: Pomegranate bowl
  **Saturday**
- Lunch: Chole bhature (special), Raita, Kheer (dessert)
- Fruit: Banana bowl
