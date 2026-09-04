# Engine v6 dry-run menu, round 2: 10 weeks from 2026-08-31

This is the second read-only dry run of `features/engine-v6.md`, generated 2026-08-31 by the updated prototype simulator (scratchpad only, nothing in the repo tree, nothing written to production), self-feeding from the household record with no swaps and no skips. The determinism check passes on both horizons: two full 10-week runs and two full 60-week runs each produce byte-identical output. Every dish name in the record resolved to a library id; the 6 "(custom)" one-offs contribute no rows.

**What changed since round 1** (the seven spec amendments, all implemented):

1. The record is the 8 served weeks only (recordWeeks 8 at cutover); the 5-week seed history is retired from the rate signal and from the weekday-occupation memory, and seed-only dishes are candidates.
2. A season with zero record weeks falls back to each fruit's all-season rate instead of a zero rate.
3. Deficits cold-start by backdated accrual, `min(rate x weeksSinceLastEaten, 1)`, staggered per dish, instead of an all-zero ledger.
4. The protein floor is day-scoped: a breakfast HP item (eggs, paneer included) satisfies the day, and Saturday is fully exempt.
5. The Saturday accompaniment is optional under the positive-deficit rule (2 or 3 items), and the everyday-base-plus-special-protein form is part of the treat register, its special protein restricted to Category Keto or Dry dish, never complete_meal or Gravy.
6. Exploration carries a family governor: a candidate whose protein family is served at or above its record rate over the trailing 8 generated weeks is demoted below all other candidates.
7. Gate threshold 4 exempts the two §4 anchors and rate-forced dishes (rate above half the role's weekly slots).

**Known approximations against the spec**, most-literal readings, never redesigns:

1. A week's season is the season of its start date, so the week of 2026-09-28 runs as Monsoon although its Thursday to Saturday fall in October.
2. The cold-start seed subsumes week 1's accrual: `weeksSinceLastEaten` counts up to and including the cutover week, so the seeded ledger already holds the cutover week's accrual and generation of week 1 skips the separate §6 step 1.
3. Exploration runs two picks whenever two placeable candidates exist ("up to two, at least one" gives no selector between one and two). A companion-shaped pick attaches to the first accepting Indian plate that is not itself an exploration pick's plate, keeping the two picks on distinct days.
4. The family governor reads `protein family` as the §4.6-normalized family of any `primaryIngredient` (non-protein primaries included), measures the family's record rate against the current growing record, and is evaluated once per week over the trailing 8 generated weeks; with no generated weeks yet, only zero-rate families are demoted, so week 1 can carry two same-family picks.
5. The LRU tie-break "fewest total occupations" among never-occupied weekdays is read as the dish's total occupations of that weekday across all meals.
6. The Saturday everyday base is detected as a non-HP, non-Keto complete meal whose name contains khichdi or pulao (the spec's two examples); when a base wins the treat slot its special protein is structural and the optional accompaniment is skipped (the 3-item ceiling is already reached).
7. The §5.3 international ceiling of 2 is counted over weekday lunch stars only; a Saturday international treat does not consume it.
8. Carb-forward international mains are detected by name (noodle, pasta, spaghetti, macaroni, fried rice) on non-Indian complete meals; the dry-protein companion pool is HP-or-Keto dishes in Category Keto or Dry dish, tikka and grilled preparations allowed across registers.
9. There is no treat-register field in the library; the treat pool is every eligible Lunch dish carrying the complete_meal tag or Category Complete meal.
10. The lunch-star pool is HP dishes plus Category Gravy dish, Keto, and Complete meal; Category Accompaniment dishes, including HP salads, stay companions and floor candidates, never stars.
11. Per §13, Soya chunks masala's HP tag is ignored for the protein floor, and tofu and soya-as-protein dishes are excluded from the exploration pool as if the §13 deactivation content task had run.
12. The dish-driven chutney (Chilla or Paratha main), the boiled-eggs-standalone chutney, and the Thursday light-grain boiled-eggs rider are structural; all other breakfast small items follow the positive-deficit rule. There is no breakfast-side floor append; the day-scoped floor only ever appends at lunch.
13. Indian complete-meal lunch mains may take one small companion from Category Accompaniment only, by the positive-deficit rule.
14. Constraint-pass repairs refund the replaced dish's charge and charge the replacement (the no-refund rule is written for household swap-outs). Cross-meal conflicts try a whole-plate swap between days first, then next-ranked replacement, then allow the repeat.
15. Prep-ceiling repairs treat optional lunch companions and breakfast small items as droppable; the carb, star, dessert, special protein, and floor are protected. A day with nothing droppable stays over the ceiling (the spec names no further repair).
16. The Saturday accompaniment is not cuisine-filtered, and rice spacing is keyed on Category Rice items.
17. The Explore affinity score uses row-weighted ingredient and category shares and the row-weighted median of derived per-person protein; the §2 base rate formula is used throughout (the §14.1 variant was not A/B tested here).
18. Gate 4's rate-forced exemption is computed as final-record rate above half the role's weekly slots (5 for breakfast and lunch roles, 6 for fruit).
19. Gate 8's "international lunches" is counted both ways below (weekday stars only, and all lunch mains including a non-Indian Saturday treat); the spec does not say which.
20. The §3 reconciliation branch is never exercised (the self-feed has no swaps).

**Measurements against the §11 gates on the 10-week horizon** (all warm-up; the gate's own window is weeks 20 to 60, reported in the section at the end):

1. Distribution fidelity (served vs the 8-week record rate, within 25 percent): chicken +16.4, paneer +16.4, egg +15.6, fish +14.3, prawn 0, mutton +20, dal-family 0, international +16.9, plain roti -5.9, raita/curd -6.7, all PASS; specialty roti +76 FAIL (1.10 vs 0.625); salad +46.7 FAIL (1.10 vs 0.75). 10 of 12 pass, against 7 of 12 in round 1.
2. Lunch-main uniqueness: 72.9, 75.0, 77.1 percent across the three rolling windows, all above 65. PASS.
3. Jaccard: average 0.189 against the 0.20 to 0.35 band. FAIL, marginally and improving (0.161 in round 1; household 0.263).
4. Slot anti-lock: no non-exempt dish lock (Boiled eggs at Thursday breakfast, 10 of 10, is anchor-exempt). Category clause: international is day-locked on Saturday (8 of 10 weeks carry an international item there), FAIL; specialty roti max 4, chutney max 3, PASS.
5. Saturday: dessert 10 of 10 PASS; treat mains NOT all distinct within rolling 8 (Singapore noodles on the Saturdays of weeks 2 and 7). FAIL.
6. Fruit: Monsoon weeks run 6 distinct, no repeats; Winter weeks (6 to 10) run 3 distinct (pool: banana, papaya, pomegranate), max twice, consecutive repeats in 3 weeks under the thin pool. The 4-distinct floor stays unsatisfiable in Winter (content, §14.4).
7. Coverage: not computable (needs a 20-week window).
8. International persistence: 1.5 per week counting all lunch mains (single window, in band) PASS; 1.0 counting weekday stars only, also in band.
9. Breakfast and forms: 12 distinct breakfast mains in 10 weeks (25-week threshold not computable), standalone boiled-egg breakfasts 7, dal-led lunches 4. On track.
10. Plate size and effort: 4-item lunches 6.7 percent PASS (27 in round 1); 5-item zero PASS; days over the prep ceiling 1 (2026-10-26 Wednesday, 125 minutes with nothing droppable) FAIL.

## Week of 2026-08-31 (Monsoon)

**Monday**

- Breakfast: Avocado toast (favorite)
- Lunch: Egg pulao (exploration), Cucumber salad
- Fruit: Jamun bowl
  **Tuesday**
- Breakfast: Vegetable sevai, Garlic chutney
- Lunch: Egg curry (exploration), Roti (carb), Bhindi
- Fruit: Banana bowl
  **Wednesday**
- Breakfast: Besan paneer chilla, Peanut chutney
- Lunch: Chicken masala gravy, Beetroot roti (carb), Capsicum aloo
- Fruit: Litchi bowl
  **Thursday**
- Breakfast: Boiled eggs, Mint chutney
- Lunch: Chole, Steamed rice (carb), Jeera aloo
- Fruit: Mango bowl
  **Friday**
- Breakfast: Bread omelette, Coriander chutney
- Lunch: Palak chicken gravy, Missi roti (carb), Broccoli corn
- Fruit: Plum bowl
  **Saturday**
- Lunch: Khichdi (special), Grilled chicken breast (special), Kheer (dessert)
- Fruit: Papaya bowl

## Week of 2026-09-07 (Monsoon)

**Monday**

- Breakfast: Paneer paratha, Mint chutney
- Lunch: Veg biryani (exploration), Onion tomato salad
- Fruit: Pomegranate bowl
  **Tuesday**
- Breakfast: Aloo paratha, Peanut chutney
- Lunch: Prawn pepper fry, Beetroot roti (carb), Kadhi
- Fruit: Peach bowl
  **Wednesday**
- Breakfast: Vegetable upma, Boiled eggs
- Lunch: Fish tikka, Roti (carb), Tomato soup (exploration)
- Fruit: Pineapple bowl
  **Thursday**
- Breakfast: Boiled eggs, Garlic chutney
- Lunch: Soya chunks masala, Missi roti (carb), Cucumber tomato salad
- Fruit: Papaya bowl
  **Friday**
- Breakfast: Avocado toast (favorite)
- Lunch: Moong dal, Roti (carb), Mixed veg salad, Chicken tikka (protein floor)
- Fruit: Mango bowl
  **Saturday**
- Lunch: Singapore noodles (special), Raita, Sewaiyan kheer (dessert)
- Fruit: Banana bowl

## Week of 2026-09-14 (Monsoon)

**Monday**

- Breakfast: Grilled cheese sandwich, Garlic chutney
- Lunch: Paneer fried rice (exploration), Carrot cucumber salad
- Fruit: Pineapple bowl
  **Tuesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Paneer bhurji keto (exploration), Roti (carb), Toor dal
- Fruit: Mango bowl
  **Wednesday**
- Breakfast: Vegetable sevai, Mint chutney
- Lunch: Malai kofta, Roti (carb), Raita, Paneer tikka (protein floor)
- Fruit: Jamun bowl
  **Thursday**
- Breakfast: Sabudana khichdi, Boiled eggs
- Lunch: Fish tikka, Roti (carb), Aloo matar
- Fruit: Plum bowl
  **Friday**
- Breakfast: Bread omelette, Coriander chutney
- Lunch: Mushroom matar, Beetroot roti (carb), Bhindi
- Fruit: Litchi bowl
  **Saturday**
- Lunch: Curd rice (special), Hummus, Shrikhand (dessert)
- Fruit: Pomegranate bowl

## Week of 2026-09-21 (Monsoon)

**Monday**

- Breakfast: Besan paneer chilla, Mint chutney
- Lunch: Chicken breast (exploration), Roti (carb), Panchmel dal
- Fruit: Mango bowl
  **Tuesday**
- Breakfast: Paneer paratha, Garlic chutney
- Lunch: Fish tikka, Missi roti (carb), Vegetable korma
- Fruit: Papaya bowl
  **Wednesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Prawn curry, Beetroot roti (carb), Mix veg sabzi
- Fruit: Peach bowl
  **Thursday**
- Breakfast: Boiled eggs, Peanut chutney
- Lunch: Grilled chicken breast, Roti (carb), Moong dal kosambari (exploration)
- Fruit: Pomegranate bowl
  **Friday**
- Breakfast: Aloo paratha, Coriander chutney
- Lunch: Pav bhaji, Mutton keema (protein floor)
- Fruit: Banana bowl
  **Saturday**
- Lunch: Egg biryani (special), Onion tomato salad, Fruit custard (dessert)
- Fruit: Jamun bowl

## Week of 2026-09-28 (Monsoon)

**Monday**

- Breakfast: Avocado toast (favorite)
- Lunch: Mushroom risotto (exploration), Grilled chicken breast (protein floor)
- Fruit: Papaya bowl
  **Tuesday**
- Breakfast: Anda paratha, Peanut chutney
- Lunch: Japanese egg fried rice (exploration), Paneer do pyaza
- Fruit: Pomegranate bowl
  **Wednesday**
- Breakfast: Bread omelette
- Lunch: Moong dal, Roti (carb), Capsicum aloo
- Fruit: Mango bowl
  **Thursday**
- Breakfast: Boiled eggs, Garlic chutney
- Lunch: Mutton pepper fry, Missi roti (carb), Broccoli corn
- Fruit: Plum bowl
  **Friday**
- Breakfast: Vegetable sevai, Boiled eggs
- Lunch: Prawn pepper fry, Roti (carb), Chole
- Fruit: Pineapple bowl
  **Saturday**
- Lunch: Thai pineapple fried rice (special), Raita, Sewaiyan kheer (dessert)
- Fruit: Litchi bowl

## Week of 2026-10-05 (Winter)

**Monday**

- Breakfast: Sabudana khichdi, Boiled eggs
- Lunch: Fish tikka, Roti (carb), Carrot aloo (exploration)
- Fruit: Banana bowl
  **Tuesday**
- Breakfast: Besan paneer chilla, Mint chutney
- Lunch: Thai green curry chicken (international), Steamed rice (carb)
- Fruit: Banana bowl
  **Wednesday**
- Breakfast: Paneer paratha, Garlic chutney
- Lunch: Palak chicken gravy, Roti (carb), Gajar matar (exploration)
- Fruit: Pomegranate bowl
  **Thursday**
- Breakfast: Boiled eggs, Mint chutney
- Lunch: Khichdi, Cucumber salad
- Fruit: Papaya bowl
  **Friday**
- Breakfast: Avocado toast (favorite)
- Lunch: Chole bhature, Cucumber raita
- Fruit: Papaya bowl
  **Saturday**
- Lunch: White sauce pasta (special), Hummus, Kheer (dessert)
- Fruit: Pomegranate bowl

## Week of 2026-10-12 (Winter)

**Monday**

- Breakfast: Aloo paratha
- Lunch: Bisi bele bath (exploration), Butter chicken (protein floor)
- Fruit: Pomegranate bowl
  **Tuesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Soya chunks masala, Roti (carb), Bhindi, Prawn pepper fry (protein floor)
- Fruit: Banana bowl
  **Wednesday**
- Breakfast: Vegetable upma
- Lunch: Rajma chawal, Cucumber tomato salad, Chicken masala gravy (protein floor)
- Fruit: Papaya bowl
  **Thursday**
- Breakfast: Vegetable sevai, Boiled eggs
- Lunch: Veg hakka noodles (international), Thai basil chicken
- Fruit: Banana bowl
  **Friday**
- Breakfast: Bread omelette
- Lunch: Fish tikka, Roti (carb), Bhindi do pyaza (exploration)
- Fruit: Pomegranate bowl
  **Saturday**
- Lunch: Singapore noodles (special), Raita, Shrikhand (dessert)
- Fruit: Papaya bowl

## Week of 2026-10-19 (Winter)

**Monday**

- Breakfast: Masala oats, Boiled eggs
- Lunch: Penne arrabbiata (exploration)
- Fruit: Papaya bowl
  **Tuesday**
- Breakfast: Grilled cheese sandwich, Mint chutney
- Lunch: Pasta pomodoro (exploration), Chicken tikka
- Fruit: Papaya bowl
  **Wednesday**
- Breakfast: Avocado toast (favorite)
- Lunch: Fish tikka, Beetroot roti (carb), Moong dal
- Fruit: Banana bowl
  **Thursday**
- Breakfast: Boiled eggs, Garlic chutney
- Lunch: Malai kofta, Roti (carb), Jeera aloo
- Fruit: Pomegranate bowl
  **Friday**
- Breakfast: Paneer paratha, Peanut chutney
- Lunch: Grilled chicken breast, Roti (carb), Kadhi
- Fruit: Banana bowl
  **Saturday**
- Lunch: Baked mozzarella pasta (special), Mixed veg salad, Sewaiyan kheer (dessert)
- Fruit: Pomegranate bowl

## Week of 2026-10-26 (Winter)

**Monday**

- Breakfast: Avocado toast (favorite)
- Lunch: Fish curry (exploration), Roti (carb), Bhindi
- Fruit: Banana bowl
  **Tuesday**
- Breakfast: Bread omelette
- Lunch: Fish fry (exploration), Roti (carb), Mushroom matar
- Fruit: Pomegranate bowl
  **Wednesday**
- Breakfast: Aloo paratha
- Lunch: Chole, Steamed rice (carb), Mutton keema (protein floor)
- Fruit: Pomegranate bowl
  **Thursday**
- Breakfast: Vegetable sevai, Boiled eggs
- Lunch: Red sauce pasta (international), Paneer tikka
- Fruit: Papaya bowl
  **Friday**
- Breakfast: Besan paneer chilla, Garlic chutney
- Lunch: Fish tikka, Beetroot roti (carb), Toor dal
- Fruit: Papaya bowl
  **Saturday**
- Lunch: Veg fried rice (special), Onion tomato salad, Kheer (dessert)
- Fruit: Banana bowl

## Week of 2026-11-02 (Winter)

**Monday**

- Breakfast: Paneer paratha, Peanut chutney
- Lunch: Spanish omelette (exploration)
- Fruit: Pomegranate bowl
  **Tuesday**
- Breakfast: Sabudana khichdi, Garlic chutney
- Lunch: Shakshuka (exploration), Hummus
- Fruit: Banana bowl
  **Wednesday**
- Breakfast: Anda paratha, Coriander chutney
- Lunch: Prawn pepper fry, Roti (carb), Moong dal
- Fruit: Papaya bowl
  **Thursday**
- Breakfast: Boiled eggs, Mint chutney
- Lunch: Palak chicken gravy, Roti (carb), Raita
- Fruit: Banana bowl
  **Friday**
- Breakfast: Avocado toast (favorite)
- Lunch: Soya chunks masala, Missi roti (carb), Carrot cucumber salad, Fish tikka (protein floor)
- Fruit: Pomegranate bowl
  **Saturday**
- Lunch: Khichdi (special), Grilled chicken breast (special), Fruit custard (dessert)
- Fruit: Papaya bowl

## 60-week gate measurements

The same simulator self-feeding for 60 weeks from 2026-08-31; every §11 threshold measured on weeks 20 to 60 (41 weeks) as the spec requires. Determinism: two 60-week runs are byte-identical. The menu itself is withheld here by design; the run seed, harness, and full weekly output live in the session scratchpad.

1. **Distribution fidelity** (within 25 percent of the 8-week record rate). PASS 8 of 12: egg +1.9 (2.293 vs 2.25), plain roti +1.0 (2.146 vs 2.125), dal-family -4.1 (1.439 vs 1.5), raita/curd +7.3 (0.805 vs 0.75), fish -8.0 (0.805 vs 0.875), prawn +17.1 (0.585 vs 0.5), international +17.1 (1.902 vs 1.625), paneer +20.6 (1.659 vs 1.375, the round-1 worst offender, now inside the bar with the family governor). FAIL 4 of 12: chicken +25.9 (1.732 vs 1.375), mutton +26.8 (0.317 vs 0.25), salad +39.8 (1.049 vs 0.75), specialty roti +75.6 (1.098 vs 0.625).
2. **Lunch-main uniqueness** (at least 65 percent per rolling 8 weeks): minimum 66.7 percent across the 34 windows. PASS, thin margin against the household's 77.
3. **Overlap band** (Jaccard 0.20 to 0.35 averaged): 0.1996. FAIL by a hair (household baseline 0.263); the ledger spreads consecutive weeks slightly wider than the band floor.
4. **Slot anti-lock**: Boiled eggs at Thursday breakfast (34 of 41) is anchor-exempt as amended. FAIL on two counts: Roti holds Monday lunch in 22 of 41 weeks and is not rate-exempt (final rate 2.15, below the 2.5 bar for a 5-slot role); and the international category is day-locked on Saturday (an international item on 25 of 41 Saturdays, over the 20.5 half). Specialty roti max 15 and chutney max 17 PASS.
5. **Saturday**: dessert on 41 of 41 PASS. Treat distinctness FAIL: Khichdi takes 10 of 41 Saturdays and Singapore noodles 8, so rolling-8 windows repeat.
6. **Fruit**: FAIL. Winter weeks run 3 distinct fruits (below the 4 floor) and one week reaches 3 servings of one fruit (above the twice cap, a clause with no thin-pool exception); consecutive-day repeats occur in 20 of 41 weeks, all under a thin pool (Winter pool 3: banana, papaya, pomegranate; Summer pool 4). Mechanically clean in Monsoon (6 distinct, no repeats).
7. **Coverage** (every start dish with eatenCount of 2 or more served in every rolling 20-week window): FAIL as written, entirely on the four Monsoon-only fruits (pineapple, jamun, plum, peach), which are out of season for about 26 consecutive weeks and so miss the windows inside that span; each returns immediately in Monsoon 2027. Every non-fruit tracked dish passes every window.
8. **International persistence** (0.75 to 1.75 per week per 10-week window, never a window at 0): counting all lunch mains including Saturday treats, average 1.56, windows 1.0 to 2.0, FAIL on the upper bound; counting weekday stars only, average 1.07, windows 0.6 to 1.4, PASS. The spec does not say which count it means.
9. **Breakfast and forms**: 12 distinct breakfast mains in every rolling 25-week window (threshold 10), standalone boiled-egg breakfasts 28, dal-led lunches 21. PASS.
10. **Plate size and effort**: 4-item lunches 5.3 percent (13 of 246) PASS; 5-item lunches zero PASS; days over the 120-minute prep ceiling 1 (2027-06-14 Friday, 125 minutes, no droppable companion left) FAIL against the zero bar.

**Failing thresholds, one-line diagnoses:**

- Fidelity, specialty roti (+75.6) and salad (+39.8): mechanism; the structural carb slot demands about 3.4 fills a week against a carb-pool record sum of about 3.1, so the overflow lands on the low-rate rotis by turn, and salads over-fill the always-offered optional-companion and Saturday-accompaniment slots; the self-feed then ratifies the drift (every over-serving raises the dish's own rate, with no household swap to correct it).
- Fidelity, chicken (+25.9) and mutton (+26.8): marginal, part self-feed ratchet (see above), part granularity (mutton is a 2-row family; 13 servings against an implied 10.25).
- Jaccard (0.1996): threshold arithmetic at the margin; one more shared staple per week would clear it, and the household band was measured on hand-built weeks that share hand-repeated companions the ledger deliberately spreads.
- Slot anti-lock, Roti at Monday (22 of 41): mechanism; a never-eaten exploration pick has no occupation history, so the LRU tie-break's Monday-first order sends exploration plates (and the Roti they carry) to Monday and Tuesday nearly every week (64 of 71 exploration picks landed there).
- Slot anti-lock, international day-locked on Saturday (25 of 41): threshold arithmetic or spec tension; 13 of the 21 treat-register dishes are international, so an international Saturday is the register's own majority, and the anchor exemption covers the dish clause but not the category clause.
- Saturday treat distinctness (Khichdi 10, Singapore noodles 8): threshold arithmetic; one treat slot a week means any treat with a record rate of 0.25 or more must repeat inside 8 Saturdays, and the record holds several such treats.
- Fruit (Winter 3 distinct, one triple): content, the §14.4 winter-pool task; exploration places only weekday lunch dishes, so no new fruit can ever enter the rotation and the pool cannot grow.
- Coverage (4 Monsoon-only fruits): threshold arithmetic; the clause needs an in-season qualifier, since an out-of-season dish cannot be served for 26 straight weeks by eligibility alone.
- International upper bound (window at 2.0 on the all-mains count): counting ambiguity first, then mechanism; the international-heavy treat register adds about 0.5 a week on Saturdays on top of a weekday rate that alone sits in band.
- Prep ceiling (one day at 125): mechanism edge; a plate whose protected items alone exceed 120 has no spec'd repair, so the day stays over.
