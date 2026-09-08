# Claude Code review: medium-confidence dish-data findings

Date: 8 September 2026. Base commit: `a8778b8`. Fix branch: `fix/dish-audit-confidence`. Review snapshot captured from the fix branch; after merge, use the main checkout. All source paths below are repository-relative.

**Task for Claude Code:** Review every M01-M59 finding below. This is a review request, not blanket authorization to implement all proposed changes. Return one verdict per finding: confirmed mistake, valid intentional choice, or household decision needed. State your confidence, evidence, affected dish IDs, exact proposed quantities/units where supportable, and what additional information would settle uncertainty. Do not assume the original suspicion is correct. Do not automatically retag HP dishes, change active status, or impose authenticity-only ingredient rules.

**The high-confidence fixes accompany this review in the same PR.** Review the post-fix snapshots in this document, not the old source state alone. Their remaining limitation is explicit: macro totals are partial tracked-ingredient estimates and cannot produce a Healthy classification. Full recipe nutrition, dry/cooked weights and product choices still need review.

This document includes the original reasoning for all 59 medium-confidence groups, current quantities and method references, overlap with high-confidence fixes, a refreshed protein comparison, all 270 current dish snapshots, and the entire 103-entry catalog. No earlier conversation or separate attachment is required. Source paths are relative to the working checkout. Snapshots are review evidence; the live files remain authoritative if their hashes differ.

## Review conventions

- Every recipe is a batch for two people. No universal portion-size target is assumed.
- Pantry flour, base rice, salt, spices and base cooking oil are deliberately omitted from groceries. A pantry exclusion is not automatically a wrong shopping list. Recipe amounts can still be incomplete.
- Ingredient units are canonical g/ml/pcs. All 1,554 post-fix rows resolve to catalog ingredients. The concerns below mostly involve food form or weight basis rather than a literal unit typo.
- HP tags are structural and unchanged. The 20 g protein/person comparison is a reporting diagnostic using partial inputs.
- prepMinutes measures active preparation, not soaking, cooling, baking or freezing elapsed time.
- primaryIngredient is a grouping label and need not be an exact catalog item.
- Dish #188 is now Kidney bean quesadilla, retaining its existing Kidney Bean quantity and stable ID. The former name was Black bean quesadilla.
- High-confidence recipe defaults are documented choices, not kitchen-tested or household-approved exact portions. If a medium finding challenges one, explain the conflict.

## Changes already made that affect this review

H01-H50 correct 106 dish files. Empty tables are populated; missing ingredient rows are added; #188 is renamed; #207 orders sweet-potato glass noodles; Panchmel contains five dals totaling 130 g; rice/flour/dessert pantry quantities are supplied. Fruit custard uses cornflour, vanilla, banana and papaya. Sewaiyan kheer explicitly uses thin rice vermicelli. H51 adds partial/complete nutrition status and prevents partial inputs from being classified Healthy. Onion/Tomato macros and five new catalog products have documented source bases in the fix report.

M findings about butter/flour in #253/#254 are partly resolved by H49: the roux now has 10 g butter and 10 g flour per 150 ml milk. Grocery pantry treatment remains a decision. M59 is narrowed by the newly documented sources; it remains open for the rest of the catalog and actual household products.

White Vinegar now exists in the catalog because several high-confidence sauce recipes require it. Older M observations saying vinegar has no catalog entry describe the pre-fix state; the remaining questions are the vinegar type, quantity and pantry treatment in those specific dishes. The same distinction applies to original empty-table observations and old protein values: use the current snapshots below.

## Medium-confidence findings

### M01: Dry/cooked weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Chickpea 150 g uses the dry-pulse catalog, while the recipe (10 active prep minutes) starts with boiled chickpeas and has no soaking/cooking pre-prep.

**Why this is not a confirmed mistake:** The quantity may intentionally mean dry purchase weight even though the method assumes batch-cooked beans. Confirm that convention and add the missing preparation/yield before changing grams.

**Reviewer decision / proposed change:** State dry input and required soaking/cooking, or use a separately modeled cooked/drained quantity.

**Affected dishes:** #45 Chole salad (inactive).

| Current dish               | Current quantities for two                                                                                   | Full recipe evidence                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| #45 Chole salad (inactive) | Chickpea 150 g; Onion 50 g; Tomato 50 g; Cucumber 50 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs | [Snapshot #45](#dish-45) and `data/dishes/chole-salad.md` |

### M02: Dry/cooked weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Chickpea/Kidney Bean quantities use a dry-pulse catalog, but the recipe starts from cooked/mashable beans or merely warms them, without a soaking/cooking step or prePrep instruction.

**Why this is not a confirmed mistake:** The quantity may intentionally mean dry purchase weight even though the method assumes batch-cooked beans. Confirm that convention and add the missing preparation/yield before changing grams.

**Reviewer decision / proposed change:** Declare dry purchase weights and preparation/yield, or model cooked/drained beans separately; do not use dry-pulse macros on cooked grams.

**Affected dishes:** #174 Hummus; #186 Bean burrito bowl; #188 Kidney bean quesadilla; #196 Mediterranean couscous bowl; #198 Chicken enchilada bowl.

| Current dish                     | Current quantities for two                                                                                                            | Full recipe evidence                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| #174 Hummus                      | Chickpea 200 g; Tahini 40 g; Garlic 6 g; Lemon 1 pcs; Olive Oil 15 ml                                                                 | [Snapshot #174](#dish-174) and `data/dishes/hummus.md`                      |
| #186 Bean burrito bowl           | Kidney Bean 150 g; Sweet Corn 80 g; Tomato 100 g; Onion 60 g; Capsicum 60 g; Lemon 1 pcs; Coriander Leaf 10 g; Garlic 8 g             | [Snapshot #186](#dish-186) and `data/dishes/bean-burrito-bowl.md`           |
| #188 Kidney bean quesadilla      | Tortilla 4 pcs; Kidney Bean 120 g; Cheese 80 g; Onion 50 g; Capsicum 50 g; Coriander Leaf 8 g; Garlic 8 g                             | [Snapshot #188](#dish-188) and `data/dishes/kidney-bean-quesadilla.md`      |
| #196 Mediterranean couscous bowl | Couscous 180 g; Chickpea 120 g; Cucumber 80 g; Tomato 100 g; Capsicum 60 g; Feta 60 g; Olive Oil 15 ml; Lemon 1 pcs                   | [Snapshot #196](#dish-196) and `data/dishes/mediterranean-couscous-bowl.md` |
| #198 Chicken enchilada bowl      | Chicken 200 g; Kidney Bean 80 g; Tomato 150 g; Onion 60 g; Capsicum 60 g; Cheese 60 g; Garlic 8 g; Coriander Leaf 10 g; Lemon 0.5 pcs | [Snapshot #198](#dish-198) and `data/dishes/chicken-enchilada-bowl.md`      |

**High-confidence edits touching these dishes:**

- #186 Bean burrito bowl: Garlic: 8 g; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..
- #188 Kidney bean quesadilla: Garlic: 8 g; Rename to match the existing kidney-bean recipe, preserving ID 188 and its portion.
- #198 Chicken enchilada bowl: Lemon: 0.5 pcs; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

### M03: Dry/cooked weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Chickpea 180 g uses the dry-pulse catalog, but the recipe merely stirs in cooked chickpeas; soaking/cooking and yield are unspecified.

**Why this is not a confirmed mistake:** The quantity may intentionally mean dry purchase weight even though the method assumes batch-cooked beans. Confirm that convention and add the missing preparation/yield before changing grams.

**Reviewer decision / proposed change:** State whether 180 g is dry or cooked/drained and provide corresponding preparation and catalog basis.

**Affected dishes:** #203 Spanish chickpea spinach stew.

| Current dish                       | Current quantities for two                                                           | Full recipe evidence                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| #203 Spanish chickpea spinach stew | Chickpea 180 g; Spinach 150 g; Tomato 120 g; Onion 60 g; Garlic 8 g; Olive Oil 15 ml | [Snapshot #203](#dish-203) and `data/dishes/spanish-chickpea-spinach-stew.md` |

### M04: Dry/cooked substitution quantity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Chickpea 120 g can be soaked/boiled OR replaced with cooked chickpeas, but no cooked equivalent quantity is given.

**Why this is not a confirmed mistake:** Either preparation is valid, but substituting the same number of grams across dry and cooked states changes the serving.

**Reviewer decision / proposed change:** State 120 g dry and a measured cooked/drained equivalent; add advance soaking to prePrep if using dried chickpeas.

**Affected dishes:** #247 Chana pulao.

| Current dish     | Current quantities for two                                        | Full recipe evidence                                        |
| ---------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| #247 Chana pulao | Chickpea 120 g; Onion 80 g; Tomato 50 g; Ginger 10 g; Garlic 10 g | [Snapshot #247](#dish-247) and `data/dishes/chana-pulao.md` |

**High-confidence edits touching these dishes:**

- #247 Chana pulao: Ginger: 10 g; Garlic: 10 g; For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

### M05: Dry/cooked weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Kidney Bean 100 g uses dry-bean catalog values but recipe starts from boiled beans without preparation/yield.

**Why this is not a confirmed mistake:** The quantity may intentionally mean dry purchase weight even though the method assumes batch-cooked beans. Confirm that convention and add the missing preparation/yield before changing grams.

**Reviewer decision / proposed change:** State dry input and soaking/cooking requirements or model cooked/drained grams separately.

**Affected dishes:** #256 Bean tacos.

| Current dish    | Current quantities for two                                                                          | Full recipe evidence                                       |
| --------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| #256 Bean tacos | Tortilla 3 pcs; Kidney Bean 100 g; Lettuce 40 g; Tomato 50 g; Onion 40 g; Garlic 8 g; Lemon 0.5 pcs | [Snapshot #256](#dish-256) and `data/dishes/bean-tacos.md` |

**High-confidence edits touching these dishes:**

- #256 Bean tacos: Garlic: 8 g; Lemon: 0.5 pcs.

### M06: Drained-weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Curd 300 g is hung overnight; recipe starts from drained hung curd, with no stated final yield.

**Why this is not a confirmed mistake:** The listed amount may already be the original curd input. Draining also removes some nutrients, so final weight and macros are not fixed by grams alone.

**Reviewer decision / proposed change:** State whether 300 g is the purchase/input curd or drained output and give the expected yield.

**Affected dishes:** #35 Hung curd sandwiches (inactive).

| Current dish                        | Current quantities for two                                                                                 | Full recipe evidence                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| #35 Hung curd sandwiches (inactive) | Curd 300 g; Bread 4 pcs; Cucumber 80 g; Capsicum 50 g; Onion 50 g; Coriander Leaf 10 g; Green Chilli 1 pcs | [Snapshot #35](#dish-35) and `data/dishes/hung-curd-sandwiches.md` |

### M07: Drained-weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Curd 500 g is drained to chakka, but the final yield and whether the amount refers to original curd or drained chakka are not specified.

**Why this is not a confirmed mistake:** The listed amount may already be the original curd input. Draining also removes some nutrients, so final weight and macros are not fixed by grams alone.

**Reviewer decision / proposed change:** State input curd weight and expected drained yield, especially if calculating nutrients or substituting bought hung curd.

**Affected dishes:** #144 Shrikhand.

| Current dish   | Current quantities for two          | Full recipe evidence                                      |
| -------------- | ----------------------------------- | --------------------------------------------------------- |
| #144 Shrikhand | Curd 500 g; Cashew 15 g; Milk 15 ml | [Snapshot #144](#dish-144) and `data/dishes/shrikhand.md` |

**High-confidence edits touching these dishes:**

- #144 Shrikhand: Milk: 15 ml; For this two-person batch, measure 50 g powdered sugar; use the listed 15 ml milk to soak the saffron before adding it to the curd..

### M08: Drained-weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Curd 200 g / 250 g is strained before use, but input versus strained weight and expected yield are unstated.

**Why this is not a confirmed mistake:** The listed amount may already be the original curd input. Draining also removes some nutrients, so final weight and macros are not fixed by grams alone.

**Reviewer decision / proposed change:** Specify input curd and expected drained output; add pre-prep timing if thick strained curd is required.

**Affected dishes:** #214 Tzatziki; #215 Greek yogurt with honey and walnuts.

| Current dish                             | Current quantities for two                                             | Full recipe evidence                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| #214 Tzatziki                            | Curd 200 g; Cucumber 120 g; Garlic 6 g; Mint Leaf 8 g; Olive Oil 10 ml | [Snapshot #214](#dish-214) and `data/dishes/tzatziki.md`                            |
| #215 Greek yogurt with honey and walnuts | Curd 250 g; Honey 30 g; Walnut 30 g                                    | [Snapshot #215](#dish-215) and `data/dishes/greek-yogurt-with-honey-and-walnuts.md` |

### M09: Meat cut and weight basis

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The catalog supplies one macro profile each for Chicken, Mutton, Fish and Prawn despite dishes requiring curry cuts, boneless pieces, steaks or cleaned prawns. Chicken Breast has 31 g protein/100 g and generic Chicken 27 g, without raw/cooked provenance. A raw purchase weight, cooked edible weight and bone-in purchase weight are not interchangeable. Mutton also lacks species/cut/fat specification.

**Why this is not a confirmed mistake:** A reference food may legitimately be cooked or higher-fat meat. Confirm the intended raw/cooked product and bone/shell treatment before replacing the profile.

**Reviewer decision / proposed change:** Declare the purchased cut and raw edible versus as-purchased basis; source nutrition for that exact form. Record a yield only where needed for bone, shell or cooking loss. Confirm values before replacing them; no universal percentage correction is justified.

**Reference:** [USDA explains that cooking changes meat and poultry water content](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/water-meat-poultry). The suspected mismatch in this catalog is an inference; the source does not verify its individual values.

**Affected dishes:** #1 Chicken masala gravy; #2 Palak chicken gravy; #14 Chicken keema; #19 Fish curry; #20 Prawn curry; #40 Chicken sandwich; #43 Chicken salad; #44 Prawn salad; #54 Butter chicken; #55 Chicken curry; #56 Chicken stew; #77 Fish fry; #78 Prawn stir fry; #95 Chicken biryani; #113 Grilled chicken breast; #117 Chicken tikka; #118 Fish tikka; #120 Pepper chicken dry; #124 Chicken breast salad; #125 Keema paratha (inactive); #126 Keema pulao; #141 Prawn pepper fry; #159 Prawn pulao; #161 Thai green curry chicken; #162 Pad thai prawn; #163 Thai basil chicken; #166 Chicken fried rice; #168 Chilli chicken dry; #181 Chinese chilli garlic prawns; #187 Chicken fajita bowl; #190 Continental grilled chicken; #192 Korean chicken stir fry; #197 Greek chicken souvlaki; #198 Chicken enchilada bowl; #209 Japanese teriyaki chicken; #212 Vietnamese lemongrass chicken; #213 Greek lemon chicken and potatoes; #217 Mutton rogan josh; #218 Mutton curry; #219 Mutton keema; #220 Mutton pepper fry; #221 Mutton biryani; #244 Methi chicken; #258 Keto chicken stir fry.

**Catalog products:** Chicken, Chicken Breast, Chicken Keema, Mutton, Fish, Prawn. Full profiles and all usage IDs are in the catalog appendix.

**Overlap:** Some affected dishes now have additional ingredients or recipe quantities. Use current snapshots and recalculated values; the original numerical values are historical.

### M10: Product-dependent nutrition

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Tofu has one 12 g protein/100 g profile for both soft soup tofu and tofu pressed/seared in other dishes. Sprout has 9 g protein and 22 g carbohydrate/100 g without bean type or sprouting stage, while Bean Sprout is separately modeled at 3 g/6 g. Coconut Milk has 21 g fat/100 g without declaring thick, thin or diluted product. These can be valid products, but their form is not fixed.

**Why this is not a confirmed mistake:** The values can be plausible for particular products or sprouting stages. Missing product specification, rather than a proven false number, is the issue.

**Reviewer decision / proposed change:** Specify the actual purchased tofu, sprouts and coconut milk and use their label or a matching food-composition entry. Split catalog items only when distinct purchased forms are needed.

**Affected dishes:** #19 Fish curry; #20 Prawn curry; #42 Sprouts salad; #56 Chicken stew; #147 Coconut rice; #160 Thai red curry tofu (inactive); #161 Thai green curry chicken; #178 Thai tofu stir fry (inactive); #191 Tofu bibimbap (inactive); #193 Teriyaki tofu rice (inactive); #208 Korean tofu soup (inactive); #210 Japanese miso soup; #230 Sprouts usal; #243 Vegetable stew.

**Catalog products:** Tofu, Sprout, Bean Sprout, Coconut Milk. Full profiles and all usage IDs are in the catalog appendix.

**Overlap:** Some affected dishes now have additional ingredients or recipe quantities. Use current snapshots and recalculated values; the original numerical values are historical.

### M11: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Green Chilli 2 pcs is listed, while the method uses chilli powder and never explicitly uses the fresh green chilli.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Add the fresh-chilli step or remove the row if chilli powder is intended.

**Affected dishes:** #6 Chole.

| Current dish | Current quantities for two                                                                                   | Full recipe evidence                              |
| ------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| #6 Chole     | Chickpea 150 g; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g | [Snapshot #6](#dish-6) and `data/dishes/chole.md` |

### M12: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Green Chilli is listed but no recipe step explicitly uses it.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Add the step that uses the listed fresh chilli, or remove the row if it is not part of the recipe.

**Affected dishes:** #50 Chole bhature; #54 Butter chicken; #58 Egg masala dry; #59 Paneer butter masala; #60 Kadai paneer.

| Current dish             | Current quantities for two                                                                                                          | Full recipe evidence                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| #50 Chole bhature        | Chickpea 150 g; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Curd 50 g             | [Snapshot #50](#dish-50) and `data/dishes/chole-bhature.md`        |
| #54 Butter chicken       | Chicken 300 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Curd 60 g | [Snapshot #54](#dish-54) and `data/dishes/butter-chicken.md`       |
| #58 Egg masala dry       | Egg 4 pcs; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g                             | [Snapshot #58](#dish-58) and `data/dishes/egg-masala-dry.md`       |
| #59 Paneer butter masala | Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g             | [Snapshot #59](#dish-59) and `data/dishes/paneer-butter-masala.md` |
| #60 Kadai paneer         | Paneer 200 g; Onion 100 g; Tomato 100 g; Capsicum 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g           | [Snapshot #60](#dish-60) and `data/dishes/kadai-paneer.md`         |

**High-confidence edits touching these dishes:**

- #50 Chole bhature: Curd: 50 g; For four small bhature (two portions), mix 160 g maida, the listed 50 g curd, 2 g sugar, 1 g baking powder and 5 ml oil; knead with 45 ml water, adding up to 15 ml more only if needed. Cover and rest for 2 hours before rolling..
- #54 Butter chicken: Curd: 60 g.

### M13: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Coriander Leaf 10 g is listed but no recipe step uses it.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Add coriander to the dough step or remove the row.

**Affected dishes:** #90 Thepla.

| Current dish | Current quantities for two                                                            | Full recipe evidence                                 |
| ------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| #90 Thepla   | Fenugreek Leaf 100 g; Curd 50 g; Ginger 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g | [Snapshot #90](#dish-90) and `data/dishes/thepla.md` |

**High-confidence edits touching these dishes:**

- #90 Thepla: For six small theplas (two portions), use 160 g whole-wheat atta with the listed curd and fenugreek; add 40 ml water first and up to 30 ml more as the greens release moisture..

### M14: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Onion 50 g and Coriander Leaf 10 g are listed but not used in any recipe step; mashed potato also starts without a boiling step.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Specify onion/coriander incorporation and potato pre-cooking, or remove unintended rows.

**Affected dishes:** #91 Methi paratha.

| Current dish      | Current quantities for two                                                                           | Full recipe evidence                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| #91 Methi paratha | Fenugreek Leaf 100 g; Potato 100 g; Onion 50 g; Ginger 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g | [Snapshot #91](#dish-91) and `data/dishes/methi-paratha.md` |

**High-confidence edits touching these dishes:**

- #91 Methi paratha: For four parathas (two portions), use 160 g whole-wheat atta with the listed potato and fenugreek; add 60 ml water first and up to 30 ml more as needed..

### M15: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Green Chilli is listed but no step explicitly uses fresh green chilli.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Specify where fresh chilli is used or remove the unused row.

**Affected dishes:** #94 Veg biryani; #96 Egg biryani; #99 Rajma chawal.

| Current dish     | Current quantities for two                                                                                                                                               | Full recipe evidence                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| #94 Veg biryani  | Carrot 50 g; Green Pea 50 g; Potato 80 g; French Bean 30 g; Onion 150 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g | [Snapshot #94](#dish-94) and `data/dishes/veg-biryani.md`  |
| #96 Egg biryani  | Egg 4 pcs; Onion 150 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g                                                  | [Snapshot #96](#dish-96) and `data/dishes/egg-biryani.md`  |
| #99 Rajma chawal | Kidney Bean 150 g; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g                                                          | [Snapshot #99](#dish-99) and `data/dishes/rajma-chawal.md` |

**High-confidence edits touching these dishes:**

- #94 Veg biryani: For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed..
- #96 Egg biryani: For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed..
- #99 Rajma chawal: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

### M16: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Coriander Leaf 10 g is listed but absent from the written method.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Add the finishing garnish instruction or remove the row.

**Affected dishes:** #98 Pav bhaji.

| Current dish  | Current quantities for two                                                                                                                                             | Full recipe evidence                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| #98 Pav bhaji | Potato 200 g; Cauliflower 100 g; Capsicum 80 g; Green Pea 50 g; Onion 150 g; Tomato 200 g; Ginger 10 g; Garlic 10 g; Coriander Leaf 10 g; Pav Bread 4 pcs; Lemon 1 pcs | [Snapshot #98](#dish-98) and `data/dishes/pav-bhaji.md` |

**High-confidence edits touching these dishes:**

- #98 Pav bhaji: Lemon: 1 pcs.

### M17: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Green Chilli is listed but no method step explicitly uses it.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Specify its use or remove the unused row.

**Affected dishes:** #101 Malai kofta; #102 Paneer lababdar.

| Current dish         | Current quantities for two                                                                                                                            | Full recipe evidence                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| #101 Malai kofta     | Paneer 150 g; Potato 100 g; Onion 100 g; Tomato 100 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Cornflour 15 g | [Snapshot #101](#dish-101) and `data/dishes/malai-kofta.md`     |
| #102 Paneer lababdar | Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g                               | [Snapshot #102](#dish-102) and `data/dishes/paneer-lababdar.md` |

**High-confidence edits touching these dishes:**

- #101 Malai kofta: Cornflour: 15 g.

### M18: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Coriander Leaf 10 g is listed but no step uses it.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Add it to the filling instruction or remove it.

**Affected dishes:** #125 Keema paratha (inactive).

| Current dish                  | Current quantities for two                                                            | Full recipe evidence                                          |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| #125 Keema paratha (inactive) | Chicken Keema 150 g; Onion 50 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g | [Snapshot #125](#dish-125) and `data/dishes/keema-paratha.md` |

**High-confidence edits touching these dishes:**

- #125 Keema paratha (inactive): For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; cool the cooked keema before filling..

### M19: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Coriander Leaf 8 g is in the table but never used in the recipe.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Add coriander to the filling/serving step or remove the row.

**Affected dishes:** #188 Kidney bean quesadilla.

| Current dish                | Current quantities for two                                                                                | Full recipe evidence                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| #188 Kidney bean quesadilla | Tortilla 4 pcs; Kidney Bean 120 g; Cheese 80 g; Onion 50 g; Capsicum 50 g; Coriander Leaf 8 g; Garlic 8 g | [Snapshot #188](#dish-188) and `data/dishes/kidney-bean-quesadilla.md` |

**High-confidence edits touching these dishes:**

- #188 Kidney bean quesadilla: Garlic: 8 g; Rename to match the existing kidney-bean recipe, preserving ID 188 and its portion.

### M20: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Green Chilli 2 pcs is listed, but the method explicitly uses Kashmiri chilli and never uses the green chilli.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Specify the fresh chilli step or remove the row.

**Affected dishes:** #217 Mutton rogan josh.

| Current dish           | Current quantities for two                                                                                           | Full recipe evidence                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| #217 Mutton rogan josh | Mutton 300 g; Onion 150 g; Curd 80 g; Tomato 80 g; Ginger 12 g; Garlic 12 g; Green Chilli 2 pcs; Coriander Leaf 10 g | [Snapshot #217](#dish-217) and `data/dishes/mutton-rogan-josh.md` |

### M21: Listed ingredient not used

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Green Chilli 2 pcs is in the table but absent from the method.

**Why this is not a confirmed mistake:** An abbreviated method may implicitly include this with spices or garnish. Confirm the cooking intent before removing a shopping row.

**Reviewer decision / proposed change:** Specify when the fresh chilli is used or remove its row.

**Affected dishes:** #241 Paneer jalfrezi.

| Current dish         | Current quantities for two                                               | Full recipe evidence                                            |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| #241 Paneer jalfrezi | Paneer 150 g; Capsicum 80 g; Onion 80 g; Tomato 60 g; Green Chilli 2 pcs | [Snapshot #241](#dish-241) and `data/dishes/paneer-jalfrezi.md` |

### M22: Untracked dairy fat

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe uses cream, and IDs 54/59 also require butter; neither ingredient has a quantity or catalog entry.

**Why this is not a confirmed mistake:** The household may intentionally stock butter or cream. This would justify grocery exclusion, but recipe amounts still need to be explicit.

**Reviewer decision / proposed change:** Confirm whether these are deliberately stocked staples. Otherwise catalog and quantify them; either way quantify substantial additions for a usable recipe and honest nutrition.

**Affected dishes:** #3 Palak paneer; #5 Shahi paneer; #54 Butter chicken; #59 Paneer butter masala.

| Current dish             | Current quantities for two                                                                                                          | Full recipe evidence                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| #3 Palak paneer          | Paneer 200 g; Spinach 250 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs                                  | [Snapshot #3](#dish-3) and `data/dishes/palak-paneer.md`           |
| #5 Shahi paneer          | Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs                                  | [Snapshot #5](#dish-5) and `data/dishes/shahi-paneer.md`           |
| #54 Butter chicken       | Chicken 300 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Curd 60 g | [Snapshot #54](#dish-54) and `data/dishes/butter-chicken.md`       |
| #59 Paneer butter masala | Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g             | [Snapshot #59](#dish-59) and `data/dishes/paneer-butter-masala.md` |

**High-confidence edits touching these dishes:**

- #54 Butter chicken: Curd: 60 g.

### M23: Piece-size specification

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Piece units match the catalog, but the catalog assumes Bread 30 g/piece (a slice), Pav Bread 40 g/roll, Tortilla 45 g each, Banana 120 g edible flesh and Egg 50 g edible portion. The rows do not name a bread slice/loaf distinction or the purchased product size. No numeric pcs-unit error is established.

**Why this is not a confirmed mistake:** pcs is valid. Only the slice/roll/fruit size assumption may differ from the actual purchase; do not change all piece quantities to grams.

**Reviewer decision / proposed change:** Clarify Bread as slices and document the approximate size basis for the other piece-count products. Retain pcs for shopping; adjust gram-per-piece values only against the household products.

**Affected dishes:** #12 Egg curry; #30 Boiled eggs; #33 Bread omelette; #35 Hung curd sandwiches (inactive); #40 Chicken sandwich; #57 Anda bhurji; #58 Egg masala dry; #85 Paneer sandwich; #86 Veg sandwich; #87 Grilled cheese sandwich; #96 Egg biryani; #98 Pav bhaji; #127 Egg salad; #142 Egg bhurji keto; #154 Banana bowl; #156 Masala toast; #157 Bread upma; #158 Egg podimas; #162 Pad thai prawn; #164 Singapore noodles; #166 Chicken fried rice; #177 Shakshuka; #179 Thai pineapple fried rice; #188 Kidney bean quesadilla; #191 Tofu bibimbap (inactive); #194 Japanese egg fried rice; #201 Spanish omelette; #208 Korean tofu soup (inactive); #234 Anda paratha; #242 Egg roast; #252 Egg pulao; #255 Cheese quesadilla; #256 Bean tacos; #266 Fattoush; #269 Vegetable omelette; #273 Avocado toast; #281 Pav.

**Catalog products:** Bread, Pav Bread, Tortilla, Banana, Egg. Full profiles and all usage IDs are in the catalog appendix.

**Overlap:** Some affected dishes now have additional ingredients or recipe quantities. Use current snapshots and recalculated values; the original numerical values are historical.

### M24: Volume-to-mass approximation

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** All ml amounts are treated as the same number of grams even though the macro columns are per 100 g. This is a documented approximation, not a g/ml typo. Olive Oil 30 ml in aglio e olio becomes 30 g fat in the calculation; using about 0.913 g/ml gives about 27.4 g oil. Sesame oil and dense molasses also need a product-specific basis if better accuracy is wanted.

**Why this is not a confirmed mistake:** The 1:1 conversion is documented and may be adequate for approximate displays; grocery ml are not themselves erroneous. Materiality depends on the liquid and amount.

**Reviewer decision / proposed change:** Keep grocery quantities in ml. For nutrition, use an appropriate density or explicitly store values per 100 ml. Prioritize the larger missing-food errors first; verify each liquid rather than applying the olive-oil factor to all.

**Reference:** [FAO/Codex gives olive-oil relative density of 0.910 to 0.916 at 20 C](https://www.fao.org/4/Y2774E/y2774e04.htm). The approximate 27.4 g calculation uses the midpoint; the shopping volume remains 30 ml.

**Affected dishes:** #19 Fish curry; #20 Prawn curry; #53 Kheer; #56 Chicken stew; #131 Fruit custard; #132 Sewaiyan kheer; #139 Carrot halwa; #145 Aamras; #146 Moong dal halwa; #147 Coconut rice; #160 Thai red curry tofu (inactive); #161 Thai green curry chicken; #169 Penne arrabbiata; #170 Pasta pomodoro; #171 Spaghetti aglio e olio; #172 Pesto pasta; #173 Caprese salad; #174 Hummus; #176 Tabbouleh; #178 Thai tofu stir fry (inactive); #179 Thai pineapple fried rice; #180 Chinese garlic noodles; #181 Chinese chilli garlic prawns; #182 Pasta primavera; #183 Baked mozzarella pasta; #184 Muhammara; #185 Lebanese lentil soup; #189 Mushroom risotto; #190 Continental grilled chicken; #191 Tofu bibimbap (inactive); #192 Korean chicken stir fry; #193 Teriyaki tofu rice (inactive); #194 Japanese egg fried rice; #195 Greek salad; #196 Mediterranean couscous bowl; #197 Greek chicken souvlaki; #201 Spanish omelette; #202 Patatas bravas; #203 Spanish chickpea spinach stew; #204 Gazpacho; #205 Ratatouille; #206 Continental baked vegetables; #207 Korean japchae; #208 Korean tofu soup (inactive); #209 Japanese teriyaki chicken; #212 Vietnamese lemongrass chicken; #213 Greek lemon chicken and potatoes; #214 Tzatziki; #243 Vegetable stew; #253 Mac and cheese; #254 White sauce pasta; #264 Hot and sour soup; #270 Mango lassi; #284 Red sauce pasta.

**Catalog products:** Olive Oil, Sesame Oil, Pomegranate Molasses, Soy Sauce, Coconut Milk, Milk. Full profiles and all usage IDs are in the catalog appendix.

**Overlap:** Some affected dishes now have additional ingredients or recipe quantities. Use current snapshots and recalculated values; the original numerical values are historical.

### M25: Protein-cut mismatch

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** primaryIngredient is Chicken Breast but the ingredient row is generic Chicken; shopping and macro calculations use the generic row.

**Why this is not a confirmed mistake:** primaryIngredient is a free grouping label, not a required catalog key. A naming mismatch alone does not prove that the table quantity is wrong.

**Reviewer decision / proposed change:** Confirm the cut and use Chicken Breast consistently if breast is intended.

**Affected dishes:** #40 Chicken sandwich; #43 Chicken salad.

| Current dish         | Current quantities for two                                                                            | Full recipe evidence                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| #40 Chicken sandwich | Bread 4 pcs; Chicken 150 g; Lettuce 30 g; Tomato 50 g; Onion 30 g; Cucumber 30 g                      | [Snapshot #40](#dish-40) and `data/dishes/chicken-sandwich.md` |
| #43 Chicken salad    | Chicken 200 g; Lettuce 50 g; Cucumber 80 g; Tomato 80 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g | [Snapshot #43](#dish-43) and `data/dishes/chicken-salad.md`    |

### M26: Pantry-oil treatment

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Dressing explicitly requires olive oil, but no Olive Oil row or amount exists. Base oil is deliberately excluded by pantry policy, so the missing grocery row alone is not a proven error.

**Why this is not a confirmed mistake:** The documented pantry policy deliberately omits base oil. Olive-oil exclusion can therefore be intentional; confirm whether dressing oil is treated the same way.

**Reviewer decision / proposed change:** Add a measured Olive Oil row, or explicitly document it as a pantry omission and quantify it in the recipe.

**Affected dishes:** #44 Prawn salad.

| Current dish    | Current quantities for two                                                                          | Full recipe evidence                                      |
| --------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| #44 Prawn salad | Prawn 200 g; Lettuce 50 g; Cucumber 80 g; Tomato 80 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g | [Snapshot #44](#dish-44) and `data/dishes/prawn-salad.md` |

### M27: Unquantified alternative

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The coating is rice flour OR semolina, neither quantified; Semolina is otherwise a cataloged shopping ingredient.

**Why this is not a confirmed mistake:** Either coating can work, but shopping and quantities require a chosen default or explicit quantified options.

**Reviewer decision / proposed change:** Choose a default coating and quantity; keep the other as an explicit substitution.

**Affected dishes:** #77 Fish fry.

| Current dish | Current quantities for two                                    | Full recipe evidence                                   |
| ------------ | ------------------------------------------------------------- | ------------------------------------------------------ |
| #77 Fish fry | Fish 300 g; Onion 50 g; Ginger 10 g; Garlic 10 g; Lemon 1 pcs | [Snapshot #77](#dish-77) and `data/dishes/fish-fry.md` |

### M28: Untracked dairy fat

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipes require butter (ID 100 also cream), with no quantity or catalog entry.

**Why this is not a confirmed mistake:** The household may intentionally stock butter or cream. This would justify grocery exclusion, but recipe amounts still need to be explicit.

**Reviewer decision / proposed change:** Clarify the pantry policy for butter/cream and quantify their use, especially for toasted bread and dal makhani.

**Affected dishes:** #85 Paneer sandwich; #87 Grilled cheese sandwich; #98 Pav bhaji; #100 Dal makhani.

| Current dish                | Current quantities for two                                                                                                                                             | Full recipe evidence                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| #85 Paneer sandwich         | Bread 4 pcs; Paneer 100 g; Onion 30 g; Capsicum 30 g; Tomato 30 g; Coriander Leaf 10 g                                                                                 | [Snapshot #85](#dish-85) and `data/dishes/paneer-sandwich.md`         |
| #87 Grilled cheese sandwich | Bread 4 pcs; Cheese 80 g                                                                                                                                               | [Snapshot #87](#dish-87) and `data/dishes/grilled-cheese-sandwich.md` |
| #98 Pav bhaji               | Potato 200 g; Cauliflower 100 g; Capsicum 80 g; Green Pea 50 g; Onion 150 g; Tomato 200 g; Ginger 10 g; Garlic 10 g; Coriander Leaf 10 g; Pav Bread 4 pcs; Lemon 1 pcs | [Snapshot #98](#dish-98) and `data/dishes/pav-bhaji.md`               |
| #100 Dal makhani            | Black Urad Dal 100 g; Kidney Bean 30 g; Onion 80 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g                                    | [Snapshot #100](#dish-100) and `data/dishes/dal-makhani.md`           |

**High-confidence edits touching these dishes:**

- #98 Pav bhaji: Lemon: 1 pcs.

### M29: Untracked dairy fat

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe explicitly adds cream without a quantity or catalog entry.

**Why this is not a confirmed mistake:** The household may intentionally stock butter or cream. This would justify grocery exclusion, but recipe amounts still need to be explicit.

**Reviewer decision / proposed change:** Clarify pantry treatment and quantify the cream, or rewrite an intended cream-free version.

**Affected dishes:** #101 Malai kofta; #102 Paneer lababdar.

| Current dish         | Current quantities for two                                                                                                                            | Full recipe evidence                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| #101 Malai kofta     | Paneer 150 g; Potato 100 g; Onion 100 g; Tomato 100 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Cornflour 15 g | [Snapshot #101](#dish-101) and `data/dishes/malai-kofta.md`     |
| #102 Paneer lababdar | Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g                               | [Snapshot #102](#dish-102) and `data/dishes/paneer-lababdar.md` |

**High-confidence edits touching these dishes:**

- #101 Malai kofta: Cornflour: 15 g.

### M30: Untracked dairy fat

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Toast and Pav require butter or a buttered surface, with no amount or catalog entry.

**Why this is not a confirmed mistake:** The household may intentionally stock butter or cream. This would justify grocery exclusion, but recipe amounts still need to be explicit.

**Reviewer decision / proposed change:** Quantify the butter and confirm whether it is a stocked pantry ingredient.

**Affected dishes:** #109 Toast; #281 Pav.

| Current dish | Current quantities for two | Full recipe evidence                                  |
| ------------ | -------------------------- | ----------------------------------------------------- |
| #109 Toast   | Bread 4 pcs                | [Snapshot #109](#dish-109) and `data/dishes/toast.md` |
| #281 Pav     | Pav Bread 4 pcs            | [Snapshot #281](#dish-281) and `data/dishes/pav.md`   |

**High-confidence edits touching these dishes:**

- #109 Toast: Bread: 4 pcs.

### M31: Pantry-oil treatment

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Dressing explicitly uses olive oil, but the table lacks Olive Oil and its amount. Base oil is deliberately excluded by pantry policy, so the missing grocery row alone is not a proven error.

**Why this is not a confirmed mistake:** The documented pantry policy deliberately omits base oil. Olive-oil exclusion can therefore be intentional; confirm whether dressing oil is treated the same way.

**Reviewer decision / proposed change:** Add a measured Olive Oil row, or explicitly document pantry omission and give the recipe amount.

**Affected dishes:** #124 Chicken breast salad.

| Current dish              | Current quantities for two                                                                                   | Full recipe evidence                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| #124 Chicken breast salad | Chicken Breast 200 g; Lettuce 50 g; Cucumber 80 g; Tomato 80 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g | [Snapshot #124](#dish-124) and `data/dishes/chicken-breast-salad.md` |

### M32: Purchase/edible weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Mango 500 g / Papaya 300 g has no declared whole-purchase versus edible-flesh basis; the method removes peel and seeds. This does not establish which basis the author intended.

**Why this is not a confirmed mistake:** Recipe grams might intentionally refer to edible flesh, with shopping yield handled by the household. Do not apply a generic waste factor without confirming that convention.

**Reviewer decision / proposed change:** Specify whether listed grams mean edible flesh or whole purchased fruit; account for peel/stone waste when generating a shopping quantity.

**Affected dishes:** #145 Aamras; #155 Papaya bowl.

| Current dish     | Current quantities for two | Full recipe evidence                                        |
| ---------------- | -------------------------- | ----------------------------------------------------------- |
| #145 Aamras      | Mango 500 g; Milk 50 ml    | [Snapshot #145](#dish-145) and `data/dishes/aamras.md`      |
| #155 Papaya bowl | Papaya 300 g; Lemon 1 pcs  | [Snapshot #155](#dish-155) and `data/dishes/papaya-bowl.md` |

### M33: Noodle-form ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Pad thai is modeled with thin Rice Vermicelli, whereas the title and unspecified rice-noodle recipe may intend flat pad-thai noodles.

**Why this is not a confirmed mistake:** A rice-vermicelli pad-thai variation is possible. Confirm the intended texture/product rather than enforcing authenticity.

**Reviewer decision / proposed change:** Confirm whether this is an intentional vermicelli variation; otherwise specify flat rice noodles and their dry quantity/cooking instructions.

**Reference:** [RecipeTin Eats specifies flat dried rice noodles for pad thai](https://www.recipetineats.com/chicken-pad-thai/). This is a reference for product form, not a requirement to copy that recipe.

**Affected dishes:** #162 Pad thai prawn.

| Current dish        | Current quantities for two                                                                                                                                   | Full recipe evidence                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| #162 Pad thai prawn | Rice Vermicelli 150 g; Prawn 200 g; Egg 2 pcs; Bean Sprout 80 g; Spring Onion 40 g; Peanut 30 g; Garlic 8 g; Lemon 1 pcs; Soy Sauce 15 ml; Chilli Sauce 10 g | [Snapshot #162](#dish-162) and `data/dishes/pad-thai-prawn.md` |

**High-confidence edits touching these dishes:**

- #162 Pad thai prawn: Soy Sauce: 15 ml; Chilli Sauce: 10 g; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.; For the sauce, soak 5 g seedless dried tamarind from the pantry in 30 ml hot water for 10 minutes, mash and strain; mix the extract with the listed soy sauce and chilli sauce..

### M34: Description-method mismatch

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Description promises a chilli sauce, but ingredients and method contain no chilli ingredient or chilli instruction.

**Why this is not a confirmed mistake:** The description or the abbreviated method may be the outdated part. Confirm the intended dish before adding chilli.

**Reviewer decision / proposed change:** Specify the chilli seasoning or remove the chilli claim from the description.

**Affected dishes:** #180 Chinese garlic noodles.

| Current dish                | Current quantities for two                                                                  | Full recipe evidence                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| #180 Chinese garlic noodles | Noodles 200 g; Garlic 15 g; Cabbage 80 g; Capsicum 60 g; Spring Onion 30 g; Soy Sauce 25 ml | [Snapshot #180](#dish-180) and `data/dishes/chinese-garlic-noodles.md` |

### M35: Oven instructions incomplete

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe says bake until bubbling and golden but supplies no oven temperature or approximate bake time.

**Why this is not a confirmed mistake:** An experienced cook may know the intended oven setting, and prepMinutes counts active work only. Confirm temperature/time guidance, not an automatic prep-minute increase.

**Reviewer decision / proposed change:** Add the intended oven setting and time range, retaining the visual doneness cue.

**Affected dishes:** #183 Baked mozzarella pasta.

| Current dish                | Current quantities for two                                                                       | Full recipe evidence                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| #183 Baked mozzarella pasta | Pasta 180 g; Tomato 250 g; Mozzarella 100 g; Onion 60 g; Garlic 10 g; Olive Oil 15 ml; Basil 8 g | [Snapshot #183](#dish-183) and `data/dishes/baked-mozzarella-pasta.md` |

### M36: Rice-variety ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Mushroom risotto specifies only rice, without the grain variety or a rice amount; the household staple rice need not be suitable for the intended creamy texture.

**Why this is not a confirmed mistake:** The household may have a tested ordinary-rice variation. Confirm the intended grain before adding specialty rice to groceries.

**Reviewer decision / proposed change:** Specify the intended risotto rice or document the tested household-rice variation; quantify it in the recipe and settle whether specialty rice needs shopping.

**Affected dishes:** #189 Mushroom risotto.

| Current dish          | Current quantities for two                                                       | Full recipe evidence                                             |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| #189 Mushroom risotto | Mushroom 200 g; Onion 60 g; Garlic 8 g; Cheese 30 g; Olive Oil 15 ml; Milk 50 ml | [Snapshot #189](#dish-189) and `data/dishes/mushroom-risotto.md` |

**High-confidence edits touching these dishes:**

- #189 Mushroom risotto: For two portions, use 140 g dry rice and keep 600 ml hot water ready; add it gradually and stop when the grains are tender with a slight bite..

### M37: Citrus naming ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe/description says lime while the table orders Lemon.

**Why this is not a confirmed mistake:** Lemon may be the household label for nimbu/lime. Check the actual purchase convention before creating two catalog items.

**Reviewer decision / proposed change:** Confirm whether Lemon is the household's shared nimbu label; standardize the wording or distinguish lemon from lime if different products are intended.

**Affected dishes:** #200 Guacamole; #211 Vietnamese noodle salad; #216 Mango sorbet.

| Current dish                 | Current quantities for two                                                                                                                          | Full recipe evidence                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| #200 Guacamole               | Avocado 250 g; Onion 40 g; Tomato 60 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Lemon 1 pcs                                                        | [Snapshot #200](#dish-200) and `data/dishes/guacamole.md`               |
| #211 Vietnamese noodle salad | Rice Vermicelli 180 g; Carrot 80 g; Cucumber 80 g; Bean Sprout 60 g; Peanut 30 g; Mint Leaf 10 g; Coriander Leaf 10 g; Lemon 1 pcs; Soy Sauce 15 ml | [Snapshot #211](#dish-211) and `data/dishes/vietnamese-noodle-salad.md` |
| #216 Mango sorbet            | Mango 300 g; Lemon 1 pcs                                                                                                                            | [Snapshot #216](#dish-216) and `data/dishes/mango-sorbet.md`            |

**High-confidence edits touching these dishes:**

- #211 Vietnamese noodle salad: Soy Sauce: 15 ml.

### M38: Purchase/edible weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Avocado 250 g in guacamole and Mango 300 g in sorbet have no declared whole-fruit versus edible-flesh basis.

**Why this is not a confirmed mistake:** Recipe grams might intentionally refer to edible flesh, with shopping yield handled by the household. Do not apply a generic waste factor without confirming that convention.

**Reviewer decision / proposed change:** Specify edible recipe weight and, where necessary, a separate purchase yield.

**Affected dishes:** #200 Guacamole; #216 Mango sorbet.

| Current dish      | Current quantities for two                                                                   | Full recipe evidence                                         |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| #200 Guacamole    | Avocado 250 g; Onion 40 g; Tomato 60 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Lemon 1 pcs | [Snapshot #200](#dish-200) and `data/dishes/guacamole.md`    |
| #216 Mango sorbet | Mango 300 g; Lemon 1 pcs                                                                     | [Snapshot #216](#dish-216) and `data/dishes/mango-sorbet.md` |

### M39: Oven instructions incomplete

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The method offers frying OR roasting potato without a roasting temperature/time or a chosen default method.

**Why this is not a confirmed mistake:** An experienced cook may know the intended oven setting, and prepMinutes counts active work only. Confirm temperature/time guidance, not an automatic prep-minute increase.

**Reviewer decision / proposed change:** Select the default method and give the relevant temperature and time range.

**Affected dishes:** #202 Patatas bravas.

| Current dish        | Current quantities for two                                          | Full recipe evidence                                           |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| #202 Patatas bravas | Potato 300 g; Tomato 120 g; Onion 40 g; Garlic 8 g; Olive Oil 20 ml | [Snapshot #202](#dish-202) and `data/dishes/patatas-bravas.md` |

### M40: Untracked condiment

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe requires vinegar with no quantity or catalog entry.

**Why this is not a confirmed mistake:** Vinegar may be a stocked pantry item. A missing catalog row alone does not settle its intended shopping treatment.

**Reviewer decision / proposed change:** Specify vinegar type/amount and whether it is a stocked pantry ingredient.

**Affected dishes:** #204 Gazpacho.

| Current dish  | Current quantities for two                                                           | Full recipe evidence                                     |
| ------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| #204 Gazpacho | Tomato 300 g; Cucumber 120 g; Capsicum 80 g; Onion 30 g; Garlic 4 g; Olive Oil 15 ml | [Snapshot #204](#dish-204) and `data/dishes/gazpacho.md` |

### M41: Oven instructions incomplete

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Baking/roasting has neither an oven temperature nor a timed cooking range; ID 213 also leaves chicken cut size to inference.

**Why this is not a confirmed mistake:** An experienced cook may know the intended oven setting, and prepMinutes counts active work only. Confirm temperature/time guidance, not an automatic prep-minute increase.

**Reviewer decision / proposed change:** Add oven setting and approximate time plus doneness cues; specify the chicken cut for ID 213.

**Affected dishes:** #206 Continental baked vegetables; #213 Greek lemon chicken and potatoes.

| Current dish                          | Current quantities for two                                                                             | Full recipe evidence                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| #206 Continental baked vegetables     | Broccoli 100 g; Cauliflower 100 g; Carrot 80 g; French Bean 60 g; Milk 150 ml; Cheese 60 g; Garlic 6 g | [Snapshot #206](#dish-206) and `data/dishes/continental-baked-vegetables.md`     |
| #213 Greek lemon chicken and potatoes | Chicken 300 g; Potato 250 g; Garlic 12 g; Onion 60 g; Olive Oil 25 ml; Lemon 2 pcs                     | [Snapshot #213](#dish-213) and `data/dishes/greek-lemon-chicken-and-potatoes.md` |

**High-confidence edits touching these dishes:**

- #206 Continental baked vegetables: For the white sauce, use 10 g plain flour with the listed 150 ml milk: whisk the flour into 30 ml cold milk first, then add it to the remaining hot milk and simmer, stirring, until thickened..

### M42: Ingredient-form ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe calls for soft tofu; the catalog only exposes generic Tofu, also used in dishes that press and sear firm tofu.

**Why this is not a confirmed mistake:** The household may buy a tofu firm enough for several uses. Confirm the product before splitting its catalog entry.

**Reviewer decision / proposed change:** Specify the intended tofu firmness in shopping metadata or distinct catalog entries if these are different purchased products.

**Affected dishes:** #208 Korean tofu soup (inactive); #210 Japanese miso soup.

| Current dish                     | Current quantities for two                                                                           | Full recipe evidence                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| #208 Korean tofu soup (inactive) | Tofu 200 g; Mushroom 80 g; Spring Onion 30 g; Egg 1 pcs; Gochujang 20 g; Garlic 8 g; Soy Sauce 10 ml | [Snapshot #208](#dish-208) and `data/dishes/korean-tofu-soup.md`   |
| #210 Japanese miso soup          | Tofu 120 g; Miso Paste 40 g; Spring Onion 20 g; Spinach 40 g                                         | [Snapshot #210](#dish-210) and `data/dishes/japanese-miso-soup.md` |

### M43: Advance-preparation timing

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Mango sorbet requires freezing and periodic scraping but has no prePrep instruction or approximate freezing duration. Active prep minutes are not elapsed freezing time.

**Why this is not a confirmed mistake:** The household may keep frozen sorbet ready. Confirm whether it is made for the scheduled meal or stored in advance.

**Reviewer decision / proposed change:** Add the advance-freezing requirement and approximate elapsed duration so the planned serving is feasible.

**Affected dishes:** #216 Mango sorbet.

| Current dish      | Current quantities for two | Full recipe evidence                                         |
| ----------------- | -------------------------- | ------------------------------------------------------------ |
| #216 Mango sorbet | Mango 300 g; Lemon 1 pcs   | [Snapshot #216](#dish-216) and `data/dishes/mango-sorbet.md` |

### M44: Protein-cut mismatch

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The name, recipe and buySpecially require minced mutton, but the grocery row is generic Mutton, also used for curry cuts.

**Why this is not a confirmed mistake:** primaryIngredient is a free grouping label, not a required catalog key. A naming mismatch alone does not prove that the table quantity is wrong.

**Reviewer decision / proposed change:** Represent the mince requirement in the shopping output or a distinct Mutton Keema item; confirm the fat/nutrition basis.

**Affected dishes:** #219 Mutton keema.

| Current dish      | Current quantities for two                                                                                                 | Full recipe evidence                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| #219 Mutton keema | Mutton 300 g; Onion 120 g; Tomato 100 g; Green Pea 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g | [Snapshot #219](#dish-219) and `data/dishes/mutton-keema.md` |

### M45: Cooked-output mismatch

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Toor Dal 40 g is included in grocery/nutrition, but the method only adds the dal cooking water, not the cooked lentils themselves.

**Why this is not a confirmed mistake:** The author may mean to include mashed dal as well as its water. Clarify the method before changing nutrition or purchase weight.

**Reviewer decision / proposed change:** Specify whether the cooked dal is mashed into the rasam. If only strained water is served, avoid counting all the dry dal's nutrition as eaten in this dish.

**Affected dishes:** #238 Rasam.

| Current dish | Current quantities for two                                                    | Full recipe evidence                                  |
| ------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| #238 Rasam   | Toor Dal 40 g; Tomato 150 g; Garlic 10 g; Curry Leaf 5 g; Coriander Leaf 10 g | [Snapshot #238](#dish-238) and `data/dishes/rasam.md` |

### M46: Dish category mismatch

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Category is Gravy dish, while description says semi dry and final method says cook until just coated.

**Why this is not a confirmed mistake:** Semi-dry dishes may deliberately occupy a gravy role in this household. Check the intended plate composition before reclassifying.

**Reviewer decision / proposed change:** Confirm desired wetness and classify as Dry dish if it is the stated dry jalfrezi, or rewrite the intended gravy preparation.

**Affected dishes:** #241 Paneer jalfrezi.

| Current dish         | Current quantities for two                                               | Full recipe evidence                                            |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| #241 Paneer jalfrezi | Paneer 150 g; Capsicum 80 g; Onion 80 g; Tomato 60 g; Green Chilli 2 pcs | [Snapshot #241](#dish-241) and `data/dishes/paneer-jalfrezi.md` |

### M47: Untracked condiment

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The jalfrezi masala requires vinegar, with no quantity or catalog entry.

**Why this is not a confirmed mistake:** Vinegar may be a stocked pantry item. A missing catalog row alone does not settle its intended shopping treatment.

**Reviewer decision / proposed change:** Specify type/amount and pantry treatment.

**Affected dishes:** #241 Paneer jalfrezi.

| Current dish         | Current quantities for two                                               | Full recipe evidence                                            |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| #241 Paneer jalfrezi | Paneer 150 g; Capsicum 80 g; Onion 80 g; Tomato 60 g; Green Chilli 2 pcs | [Snapshot #241](#dish-241) and `data/dishes/paneer-jalfrezi.md` |

### M48: Grain-form ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Vegetable daliya describes dry-roasting and cooking broken wheat but orders Bulgur Wheat, a parboiled product also used in soak-only tabbouleh.

**Why this is not a confirmed mistake:** Bulgur may be an intentional convenient replacement for raw cracked wheat. The title alone does not establish the intended product.

**Reviewer decision / proposed change:** Confirm intended grain; model raw cracked wheat/daliya separately if that is what is cooked, or explicitly label the bulgur substitution and adjust cooking.

**Reference:** [Bob's Red Mill describes bulgur as parboiled, dried and cracked wheat](https://www.bobsredmill.com/product/bulgur).

**Affected dishes:** #250 Vegetable daliya.

| Current dish          | Current quantities for two                                               | Full recipe evidence                                             |
| --------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| #250 Vegetable daliya | Bulgur Wheat 100 g; Carrot 50 g; Green Pea 50 g; Tomato 50 g; Onion 50 g | [Snapshot #250](#dish-250) and `data/dishes/vegetable-daliya.md` |

### M49: Untracked dairy fat

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Roux requires butter with no quantity or catalog entry; flour quantity is also unspecified relative to Milk 150 ml.

**Why this is not a confirmed mistake:** The household may intentionally stock butter or cream. This would justify grocery exclusion, but recipe amounts still need to be explicit.

**Reviewer decision / proposed change:** Specify butter/flour/milk proportions and settle butter's pantry treatment.

**Affected dishes:** #253 Mac and cheese; #254 White sauce pasta.

| Current dish           | Current quantities for two                                            | Full recipe evidence                                              |
| ---------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| #253 Mac and cheese    | Pasta 120 g; Cheese 60 g; Milk 150 ml                                 | [Snapshot #253](#dish-253) and `data/dishes/mac-and-cheese.md`    |
| #254 White sauce pasta | Pasta 120 g; Milk 150 ml; Cheese 40 g; Capsicum 40 g; Sweet Corn 40 g | [Snapshot #254](#dish-254) and `data/dishes/white-sauce-pasta.md` |

**High-confidence edits touching these dishes:**

- #253 Mac and cheese: For the roux, measure 10 g plain flour and 10 g butter with the listed 150 ml milk; cook the flour in the butter for 1 minute before gradually whisking in the milk..
- #254 White sauce pasta: For the roux, measure 10 g plain flour and 10 g butter with the listed 150 ml milk; cook the flour in the butter for 1 minute before gradually whisking in the milk..

### M50: Untracked dairy fat

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe finishes with butter OR cream, neither quantified nor cataloged.

**Why this is not a confirmed mistake:** The household may intentionally stock butter or cream. This would justify grocery exclusion, but recipe amounts still need to be explicit.

**Reviewer decision / proposed change:** Choose a default finishing ingredient and quantity or mark the finish optional; confirm pantry treatment.

**Affected dishes:** #262 Tomato soup.

| Current dish     | Current quantities for two            | Full recipe evidence                                        |
| ---------------- | ------------------------------------- | ----------------------------------------------------------- |
| #262 Tomato soup | Tomato 250 g; Garlic 10 g; Onion 40 g | [Snapshot #262](#dish-262) and `data/dishes/tomato-soup.md` |

### M51: Untracked condiment

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Soup seasoning requires vinegar with no amount or catalog entry.

**Why this is not a confirmed mistake:** Vinegar may be a stocked pantry item. A missing catalog row alone does not settle its intended shopping treatment.

**Reviewer decision / proposed change:** Specify vinegar type/amount and pantry treatment; it is central to the sourness of ID 264.

**Affected dishes:** #263 Sweet corn soup; #264 Hot and sour soup.

| Current dish           | Current quantities for two                                                               | Full recipe evidence                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| #263 Sweet corn soup   | Sweet Corn 150 g; Carrot 40 g; Cornflour 15 g; Spring Onion 20 g                         | [Snapshot #263](#dish-263) and `data/dishes/sweet-corn-soup.md`   |
| #264 Hot and sour soup | Cabbage 60 g; Carrot 40 g; Mushroom 50 g; Capsicum 40 g; Cornflour 15 g; Soy Sauce 15 ml | [Snapshot #264](#dish-264) and `data/dishes/hot-and-sour-soup.md` |

### M52: Unmodeled stock

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Method requires stock, but there is no stock ingredient, quantity or homemade-stock instruction.

**Why this is not a confirmed mistake:** Stock may mean seasoned pantry water. Confirm its definition and quantity before adding a purchased product.

**Reviewer decision / proposed change:** Specify measured water plus pantry seasoning, or define purchased/homemade stock and its required inputs.

**Affected dishes:** #264 Hot and sour soup.

| Current dish           | Current quantities for two                                                               | Full recipe evidence                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| #264 Hot and sour soup | Cabbage 60 g; Carrot 40 g; Mushroom 50 g; Capsicum 40 g; Cornflour 15 g; Soy Sauce 15 ml | [Snapshot #264](#dish-264) and `data/dishes/hot-and-sour-soup.md` |

### M53: Pantry-oil treatment

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The dressing explicitly uses olive oil, but Olive Oil is not in the table. Base oil is deliberately excluded by pantry policy, so the missing grocery row alone is not a proven error.

**Why this is not a confirmed mistake:** The documented pantry policy deliberately omits base oil. Olive-oil exclusion can therefore be intentional; confirm whether dressing oil is treated the same way.

**Reviewer decision / proposed change:** Add a measured Olive Oil input or explicitly document the pantry omission with a recipe quantity.

**Affected dishes:** #266 Fattoush; #267 Lentil salad.

| Current dish      | Current quantities for two                                                         | Full recipe evidence                                         |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| #266 Fattoush     | Lettuce 80 g; Cucumber 60 g; Tomato 60 g; Bread 1 pcs; Mint Leaf 10 g; Lemon 1 pcs | [Snapshot #266](#dish-266) and `data/dishes/fattoush.md`     |
| #267 Lentil salad | Masoor Dal 80 g; Cucumber 60 g; Tomato 60 g; Parsley 10 g; Lemon 1 pcs             | [Snapshot #267](#dish-267) and `data/dishes/lentil-salad.md` |

### M54: Lentil-form ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The salad requires whole lentils kept firm; Masoor Dal 80 g is the same unspecified catalog item used for quick-cooking red masoor in #66 and blended red lentil soup in #185. The catalog does not declare whole versus split, so it cannot reliably specify both products.

**Why this is not a confirmed mistake:** Masoor Dal does not explicitly state split or whole. The catalog may be used broadly; determine the actual purchased form instead of treating either recipe as proof by itself.

**Reviewer decision / proposed change:** Model whole brown/green masoor separately from split red masoor, or explicitly change the salad preparation and name to match split lentils.

**Affected dishes:** #267 Lentil salad.

| Current dish      | Current quantities for two                                             | Full recipe evidence                                         |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| #267 Lentil salad | Masoor Dal 80 g; Cucumber 60 g; Tomato 60 g; Parsley 10 g; Lemon 1 pcs | [Snapshot #267](#dish-267) and `data/dishes/lentil-salad.md` |

### M55: Purchase/edible weight ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Fruit/avocado quantities are in grams but preparation removes skin, stones, seeds or core; raw purchase versus edible-flesh basis is not declared.

**Why this is not a confirmed mistake:** Recipe grams might intentionally refer to edible flesh, with shopping yield handled by the household. Do not apply a generic waste factor without confirming that convention.

**Reviewer decision / proposed change:** Declare edible recipe weight separately from whole-fruit shopping weight/yield. Do not assume every gram bought becomes a gram eaten.

**Affected dishes:** #270 Mango lassi; #273 Avocado toast; #274 Mango bowl; #275 Litchi bowl; #276 Jamun bowl; #277 Plum bowl; #278 Peach bowl; #279 Pineapple bowl; #280 Pomegranate bowl.

| Current dish          | Current quantities for two              | Full recipe evidence                                             |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| #270 Mango lassi      | Mango 150 g; Curd 150 g; Milk 50 ml     | [Snapshot #270](#dish-270) and `data/dishes/mango-lassi.md`      |
| #273 Avocado toast    | Bread 4 pcs; Avocado 150 g; Lemon 1 pcs | [Snapshot #273](#dish-273) and `data/dishes/avocado-toast.md`    |
| #274 Mango bowl       | Mango 200 g                             | [Snapshot #274](#dish-274) and `data/dishes/mango-bowl.md`       |
| #275 Litchi bowl      | Litchi 150 g                            | [Snapshot #275](#dish-275) and `data/dishes/litchi-bowl.md`      |
| #276 Jamun bowl       | Jamun 150 g                             | [Snapshot #276](#dish-276) and `data/dishes/jamun-bowl.md`       |
| #277 Plum bowl        | Plum 200 g                              | [Snapshot #277](#dish-277) and `data/dishes/plum-bowl.md`        |
| #278 Peach bowl       | Peach 200 g                             | [Snapshot #278](#dish-278) and `data/dishes/peach-bowl.md`       |
| #279 Pineapple bowl   | Pineapple 200 g                         | [Snapshot #279](#dish-279) and `data/dishes/pineapple-bowl.md`   |
| #280 Pomegranate bowl | Pomegranate 150 g                       | [Snapshot #280](#dish-280) and `data/dishes/pomegranate-bowl.md` |

### M56: Included-side ambiguity

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Description says dosa is served with sambar, but the dish only contains Urad Dal and the recipe only makes dosa; no sambar ingredients or linked side are included.

**Why this is not a confirmed mistake:** The side may be a serving suggestion supplied by another planned dish. Confirm whether the menu entry promises a combined portion.

**Reviewer decision / proposed change:** State that sambar is a separate optional/planned dish, or explicitly include a measured linked sambar portion if the named menu item promises both.

**Affected dishes:** #285 Dosa.

| Current dish | Current quantities for two | Full recipe evidence                                 |
| ------------ | -------------------------- | ---------------------------------------------------- |
| #285 Dosa    | Urad Dal 60 g              | [Snapshot #285](#dish-285) and `data/dishes/dosa.md` |

**High-confidence edits touching these dishes:**

- #285 Dosa: For two portions (about six small dosas), use 180 g dry rice with the listed 60 g dry urad dal; start grinding with 180 ml fresh water and add up to 120 ml more gradually to reach a pouring batter..

### M57: Missing preparation step

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Recipe starts its filling with boiled potato, but never instructs boiling the listed Potato 200 g.

**Why this is not a confirmed mistake:** Boiled potato may be an assumed advance preparation. It needs a method or pre-prep note, not necessarily a different ingredient weight.

**Reviewer decision / proposed change:** Add the potato cooking step or a clear pre-prep requirement.

**Affected dishes:** #288 Stuffed capsicum.

| Current dish          | Current quantities for two                                                        | Full recipe evidence                                             |
| --------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| #288 Stuffed capsicum | Capsicum 250 g; Potato 200 g; Onion 60 g; Green Chilli 1 pcs; Coriander Leaf 10 g | [Snapshot #288](#dish-288) and `data/dishes/stuffed-capsicum.md` |

### M58: Hp tag versus stored protein

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** Across active and inactive dishes, 41 HP-tagged entries compute below 20 g protein/person, including two empty-data zeroes; two non-HP entries compute above 20 g. The engine threshold is a diagnostic convention and HP remains a manually controlled structural tag. Missing staples, wrong food forms and ambiguous dry/cooked weights prevent treating these computed numbers as ground truth.

**Why this is not a confirmed mistake:** HP is a manual structural tag; the 20 g/person threshold is diagnostic. Current macros remain partial and can undercount pantry protein or misread cooked weights.

**Reviewer decision / proposed change:** First fix the ingredient data and quantity basis, then re-run the comparison and decide portion/tag changes. Do not remove every HP tag or add HP to a dessert automatically. The complete comparison is in the protein table below.

**Affected dishes:** #4 Paneer do pyaza; #11 Mushroom paneer; #12 Egg curry; #13 Paneer bhurji; #30 Boiled eggs; #32 Besan paneer chilla; #33 Bread omelette; #38 Paneer paratha; #42 Sprouts salad; #45 Chole salad (inactive); #50 Chole bhature; #57 Anda bhurji; #58 Egg masala dry; #60 Kadai paneer; #61 Matar paneer; #62 Paneer capsicum; #85 Paneer sandwich; #96 Egg biryani; #104 Chicken breast; #106 Paneer bhurji; #125 Keema paratha (inactive); #126 Keema pulao; #127 Egg salad; #128 Paneer salad; #142 Egg bhurji keto; #146 Moong dal halwa; #158 Egg podimas; #160 Thai red curry tofu (inactive); #174 Hummus; #175 Falafel; #177 Shakshuka; #178 Thai tofu stir fry (inactive); #185 Lebanese lentil soup; #186 Bean burrito bowl; #191 Tofu bibimbap (inactive); #193 Teriyaki tofu rice (inactive); #234 Anda paratha; #241 Paneer jalfrezi; #242 Egg roast; #249 Paneer fried rice; #252 Egg pulao; #257 Paneer bhurji keto; #269 Vegetable omelette.

| Current dish                        | Current quantities for two                                                                                                                                  | Full recipe evidence                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| #4 Paneer do pyaza                  | Paneer 200 g; Onion 200 g; Tomato 100 g; Capsicum 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs                                                        | [Snapshot #4](#dish-4) and `data/dishes/paneer-do-pyaza.md`          |
| #11 Mushroom paneer                 | Mushroom 200 g; Paneer 150 g; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g                                  | [Snapshot #11](#dish-11) and `data/dishes/mushroom-paneer.md`        |
| #12 Egg curry                       | Egg 4 pcs; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g                                                     | [Snapshot #12](#dish-12) and `data/dishes/egg-curry.md`              |
| #13 Paneer bhurji                   | Paneer 200 g; Onion 100 g; Tomato 80 g; Capsicum 50 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g                                                 | [Snapshot #13](#dish-13) and `data/dishes/paneer-bhurji.md`          |
| #30 Boiled eggs                     | Egg 4 pcs                                                                                                                                                   | [Snapshot #30](#dish-30) and `data/dishes/boiled-eggs.md`            |
| #32 Besan paneer chilla             | Paneer 100 g; Onion 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Tomato 50 g                                                                              | [Snapshot #32](#dish-32) and `data/dishes/besan-paneer-chilla.md`    |
| #33 Bread omelette                  | Bread 4 pcs; Egg 4 pcs; Onion 50 g; Green Chilli 1 pcs; Coriander Leaf 10 g                                                                                 | [Snapshot #33](#dish-33) and `data/dishes/bread-omelette.md`         |
| #38 Paneer paratha                  | Paneer 150 g; Onion 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Ginger 10 g                                                                              | [Snapshot #38](#dish-38) and `data/dishes/paneer-paratha.md`         |
| #42 Sprouts salad                   | Sprout 200 g; Onion 50 g; Tomato 50 g; Cucumber 50 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs                                                  | [Snapshot #42](#dish-42) and `data/dishes/sprouts-salad.md`          |
| #45 Chole salad (inactive)          | Chickpea 150 g; Onion 50 g; Tomato 50 g; Cucumber 50 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs                                                | [Snapshot #45](#dish-45) and `data/dishes/chole-salad.md`            |
| #50 Chole bhature                   | Chickpea 150 g; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Curd 50 g                                     | [Snapshot #50](#dish-50) and `data/dishes/chole-bhature.md`          |
| #57 Anda bhurji                     | Egg 4 pcs; Onion 100 g; Tomato 80 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g                                                                   | [Snapshot #57](#dish-57) and `data/dishes/anda-bhurji.md`            |
| #58 Egg masala dry                  | Egg 4 pcs; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g                                                     | [Snapshot #58](#dish-58) and `data/dishes/egg-masala-dry.md`         |
| #60 Kadai paneer                    | Paneer 200 g; Onion 100 g; Tomato 100 g; Capsicum 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g                                   | [Snapshot #60](#dish-60) and `data/dishes/kadai-paneer.md`           |
| #61 Matar paneer                    | Paneer 150 g; Green Pea 100 g; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g                                 | [Snapshot #61](#dish-61) and `data/dishes/matar-paneer.md`           |
| #62 Paneer capsicum                 | Paneer 200 g; Capsicum 150 g; Onion 100 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs                                                        | [Snapshot #62](#dish-62) and `data/dishes/paneer-capsicum.md`        |
| #85 Paneer sandwich                 | Bread 4 pcs; Paneer 100 g; Onion 30 g; Capsicum 30 g; Tomato 30 g; Coriander Leaf 10 g                                                                      | [Snapshot #85](#dish-85) and `data/dishes/paneer-sandwich.md`        |
| #96 Egg biryani                     | Egg 4 pcs; Onion 150 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g                                     | [Snapshot #96](#dish-96) and `data/dishes/egg-biryani.md`            |
| #104 Chicken breast                 | Chicken Breast 300 g; Lemon 0.5 pcs                                                                                                                         | [Snapshot #104](#dish-104) and `data/dishes/chicken-breast.md`       |
| #106 Paneer bhurji                  | Paneer 200 g; Onion 80 g; Ginger 10 g; Green Chilli 1 pcs; Tomato 80 g; Coriander Leaf 10 g                                                                 | [Snapshot #106](#dish-106) and `data/dishes/paneer-bhurji-106.md`    |
| #125 Keema paratha (inactive)       | Chicken Keema 150 g; Onion 50 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g                                                                       | [Snapshot #125](#dish-125) and `data/dishes/keema-paratha.md`        |
| #126 Keema pulao                    | Chicken Keema 200 g; Onion 100 g; Tomato 80 g; Green Pea 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 5 g; Coriander Leaf 10 g             | [Snapshot #126](#dish-126) and `data/dishes/keema-pulao.md`          |
| #127 Egg salad                      | Egg 3 pcs; Lettuce 50 g; Cucumber 50 g; Tomato 50 g; Onion 30 g; Lemon 1 pcs; Coriander Leaf 10 g                                                           | [Snapshot #127](#dish-127) and `data/dishes/egg-salad.md`            |
| #128 Paneer salad                   | Paneer 100 g; Lettuce 50 g; Cucumber 50 g; Tomato 50 g; Onion 30 g; Lemon 1 pcs; Coriander Leaf 10 g                                                        | [Snapshot #128](#dish-128) and `data/dishes/paneer-salad.md`         |
| #142 Egg bhurji keto                | Egg 6 pcs; Onion 80 g; Tomato 80 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g                                                                    | [Snapshot #142](#dish-142) and `data/dishes/egg-bhurji-keto.md`      |
| #146 Moong dal halwa                | Moong Dal 150 g; Milk 250 ml; Cashew 20 g; Raisin 15 g                                                                                                      | [Snapshot #146](#dish-146) and `data/dishes/moong-dal-halwa.md`      |
| #158 Egg podimas                    | Egg 4 pcs; Onion 60 g; Green Chilli 2 pcs; Curry Leaf 5 g; Ginger 10 g; Coriander Leaf 10 g                                                                 | [Snapshot #158](#dish-158) and `data/dishes/egg-podimas.md`          |
| #160 Thai red curry tofu (inactive) | Tofu 250 g; Coconut Milk 200 ml; Capsicum 80 g; French Bean 60 g; Onion 60 g; Garlic 8 g; Ginger 8 g; Basil 8 g; Thai Red Curry Paste 25 g; Soy Sauce 10 ml | [Snapshot #160](#dish-160) and `data/dishes/thai-red-curry-tofu.md`  |
| #174 Hummus                         | Chickpea 200 g; Tahini 40 g; Garlic 6 g; Lemon 1 pcs; Olive Oil 15 ml                                                                                       | [Snapshot #174](#dish-174) and `data/dishes/hummus.md`               |
| #175 Falafel                        | Chickpea 200 g; Onion 50 g; Garlic 10 g; Coriander Leaf 20 g; Mint Leaf 10 g; Green Chilli 2 pcs                                                            | [Snapshot #175](#dish-175) and `data/dishes/falafel.md`              |
| #177 Shakshuka                      | Egg 4 pcs; Tomato 300 g; Onion 80 g; Capsicum 80 g; Garlic 10 g; Coriander Leaf 10 g                                                                        | [Snapshot #177](#dish-177) and `data/dishes/shakshuka.md`            |
| #178 Thai tofu stir fry (inactive)  | Tofu 250 g; French Bean 60 g; Capsicum 70 g; Spring Onion 30 g; Garlic 10 g; Soy Sauce 20 ml; Basil 8 g                                                     | [Snapshot #178](#dish-178) and `data/dishes/thai-tofu-stir-fry.md`   |
| #185 Lebanese lentil soup           | Masoor Dal 150 g; Onion 80 g; Garlic 8 g; Carrot 60 g; Lemon 1 pcs; Olive Oil 15 ml                                                                         | [Snapshot #185](#dish-185) and `data/dishes/lebanese-lentil-soup.md` |
| #186 Bean burrito bowl              | Kidney Bean 150 g; Sweet Corn 80 g; Tomato 100 g; Onion 60 g; Capsicum 60 g; Lemon 1 pcs; Coriander Leaf 10 g; Garlic 8 g                                   | [Snapshot #186](#dish-186) and `data/dishes/bean-burrito-bowl.md`    |
| #191 Tofu bibimbap (inactive)       | Tofu 150 g; Egg 2 pcs; Spinach 80 g; Carrot 60 g; Mushroom 80 g; Gochujang 30 g; Soy Sauce 10 ml                                                            | [Snapshot #191](#dish-191) and `data/dishes/tofu-bibimbap.md`        |
| #193 Teriyaki tofu rice (inactive)  | Tofu 250 g; Broccoli 100 g; Soy Sauce 30 ml; Ginger 8 g; Garlic 8 g; Spring Onion 20 g                                                                      | [Snapshot #193](#dish-193) and `data/dishes/teriyaki-tofu-rice.md`   |
| #234 Anda paratha                   | Egg 2 pcs; Onion 40 g; Green Chilli 2 pcs; Coriander Leaf 10 g                                                                                              | [Snapshot #234](#dish-234) and `data/dishes/anda-paratha.md`         |
| #241 Paneer jalfrezi                | Paneer 150 g; Capsicum 80 g; Onion 80 g; Tomato 60 g; Green Chilli 2 pcs                                                                                    | [Snapshot #241](#dish-241) and `data/dishes/paneer-jalfrezi.md`      |
| #242 Egg roast                      | Egg 4 pcs; Onion 150 g; Tomato 80 g; Green Chilli 2 pcs; Curry Leaf 5 g                                                                                     | [Snapshot #242](#dish-242) and `data/dishes/egg-roast.md`            |
| #249 Paneer fried rice              | Paneer 120 g; Capsicum 60 g; Spring Onion 30 g; Carrot 50 g; Soy Sauce 15 ml                                                                                | [Snapshot #249](#dish-249) and `data/dishes/paneer-fried-rice.md`    |
| #252 Egg pulao                      | Egg 4 pcs; Onion 80 g; Green Pea 50 g; Tomato 50 g                                                                                                          | [Snapshot #252](#dish-252) and `data/dishes/egg-pulao.md`            |
| #257 Paneer bhurji keto             | Paneer 150 g; Onion 50 g; Capsicum 50 g; Tomato 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g                                                               | [Snapshot #257](#dish-257) and `data/dishes/paneer-bhurji-keto.md`   |
| #269 Vegetable omelette             | Egg 3 pcs; Onion 40 g; Tomato 40 g; Capsicum 40 g; Green Chilli 1 pcs                                                                                       | [Snapshot #269](#dish-269) and `data/dishes/vegetable-omelette.md`   |

**High-confidence edits touching these dishes:**

- #11 Mushroom paneer: Coriander Leaf: 10 g.
- #32 Besan paneer chilla: For four small chillas (two portions), use 80 g besan and 120 ml water; add up to 30 ml more to make a spreadable batter..
- #38 Paneer paratha: For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; use the listed paneer filling..
- #50 Chole bhature: Curd: 50 g; For four small bhature (two portions), mix 160 g maida, the listed 50 g curd, 2 g sugar, 1 g baking powder and 5 ml oil; knead with 45 ml water, adding up to 15 ml more only if needed. Cover and rest for 2 hours before rolling..
- #96 Egg biryani: For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed..
- #104 Chicken breast: Chicken Breast: 300 g; Lemon: 0.5 pcs.
- #106 Paneer bhurji: Paneer: 200 g; Onion: 80 g; Ginger: 10 g; Green Chilli: 1 pcs; Tomato: 80 g; Coriander Leaf: 10 g.
- #125 Keema paratha (inactive): For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; cool the cooked keema before filling..
- #126 Keema pulao: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..
- #146 Moong dal halwa: For the listed 150 g dry moong dal, use 90 g ghee, 90 g sugar, 250 ml milk and 150 ml water; reserve 10 g of the ghee for the nuts. This makes two generous dessert portions..
- #160 Thai red curry tofu (inactive): Thai Red Curry Paste: 25 g; Soy Sauce: 10 ml.
- #186 Bean burrito bowl: Garlic: 8 g; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..
- #191 Tofu bibimbap (inactive): For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..
- #193 Teriyaki tofu rice (inactive): For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..
- #234 Anda paratha: For two large egg parathas (two portions), use 120 g whole-wheat atta and 75 ml water, adding up to 10 ml more for a soft dough..
- #249 Paneer fried rice: Soy Sauce: 15 ml; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..
- #252 Egg pulao: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..
- #257 Paneer bhurji keto: Coriander Leaf: 10 g.
- #269 Vegetable omelette: Green Chilli: 1 pcs.

**Refresh:** The original comparison flagged 43 entries (including inactive and two empty-data zeroes). The post-fix all-dish comparison flags 40 entries; 34 are active. The table below lists the union so resolved comparisons do not silently disappear.

### M59: Catalog nutrition provenance

**Confidence: Medium. Status: Needs review before change.**

**Original observation and reason for suspicion:** The 98-entry catalog has no source, reference date, product/brand or explicit raw/cooked/edible state per entry. Plausible numerical values are not independently verified values. This audit checks their structure, relative consistency and recipe compatibility; it cannot certify all composition numbers without the actual product/food basis.

**Why this is not a confirmed mistake:** Lack of provenance prevents independent validation; it does not prove that every uncited numerical value is wrong.

**Reviewer decision / proposed change:** Add or maintain source provenance for food-composition values and establish a common raw-edible input convention, with explicit cooked/drained exceptions. Confirm the higher-impact meat, pulse, tofu and liquid cases first.

**Scope:** All 103 current catalog rows. Full current catalog follows in the appendix. The original audit contained 98 rows; five products are added by the high-confidence fixes.

**Overlap:** Some affected dishes now have additional ingredients or recipe quantities. Use current snapshots and recalculated values; the original numerical values are historical.

## Refreshed HP comparison (partial inputs)

These values are computed using the existing engine on the post-fix rows. They are not complete recipe nutrition. A comparison marked consistent is not an instruction to accept the portion, and a mismatch is not an instruction to retag.

| Dish                                | HP tag | Current tracked protein/person | Current comparison                       |
| ----------------------------------- | ------ | -----------------------------: | ---------------------------------------- |
| #4 Paneer do pyaza                  | HP     |                        19.27 g | Mismatch                                 |
| #11 Mushroom paneer                 | HP     |                        17.28 g | Mismatch                                 |
| #12 Egg curry                       | HP     |                        13.85 g | Mismatch                                 |
| #13 Paneer bhurji                   | HP     |                        18.86 g | Mismatch                                 |
| #30 Boiled eggs                     | HP     |                        13.00 g | Mismatch                                 |
| #32 Besan paneer chilla             | HP     |                         9.34 g | Mismatch                                 |
| #33 Bread omelette                  | HP     |                        18.57 g | Mismatch                                 |
| #38 Paneer paratha                  | HP     |                        13.67 g | Mismatch                                 |
| #42 Sprouts salad                   | HP     |                         9.52 g | Mismatch                                 |
| #45 Chole salad (inactive)          | HP     |                        14.77 g | Mismatch                                 |
| #50 Chole bhature                   | HP     |                        15.97 g | Mismatch                                 |
| #57 Anda bhurji                     | HP     |                        13.61 g | Mismatch                                 |
| #58 Egg masala dry                  | HP     |                        13.68 g | Mismatch                                 |
| #60 Kadai paneer                    | HP     |                        19.08 g | Mismatch                                 |
| #61 Matar paneer                    | HP     |                        16.68 g | Mismatch                                 |
| #62 Paneer capsicum                 | HP     |                        19.36 g | Mismatch                                 |
| #85 Paneer sandwich                 | HP     |                        14.75 g | Mismatch                                 |
| #96 Egg biryani                     | HP     |                        13.85 g | Mismatch                                 |
| #104 Chicken breast                 | HP     |                        46.50 g | Now consistent with diagnostic threshold |
| #106 Paneer bhurji                  | HP     |                        18.54 g | Mismatch                                 |
| #125 Keema paratha (inactive)       | HP     |                        12.92 g | Mismatch                                 |
| #126 Keema pulao                    | HP     |                        18.86 g | Mismatch                                 |
| #127 Egg salad                      | HP     |                        10.55 g | Mismatch                                 |
| #128 Paneer salad                   | HP     |                         9.80 g | Mismatch                                 |
| #142 Egg bhurji keto                | HP     |                        20.04 g | Now consistent with diagnostic threshold |
| #146 Moong dal halwa                | No HP  |                        24.28 g | Mismatch                                 |
| #158 Egg podimas                    | HP     |                        13.20 g | Mismatch                                 |
| #160 Thai red curry tofu (inactive) | HP     |                        19.16 g | Mismatch                                 |
| #174 Hummus                         | No HP  |                        22.40 g | Mismatch                                 |
| #175 Falafel                        | HP     |                        19.17 g | Mismatch                                 |
| #177 Shakshuka                      | HP     |                        14.69 g | Mismatch                                 |
| #178 Thai tofu stir fry (inactive)  | HP     |                        16.96 g | Mismatch                                 |
| #185 Lebanese lentil soup           | HP     |                        19.29 g | Mismatch                                 |
| #186 Bean burrito bowl              | HP     |                        20.20 g | Now consistent with diagnostic threshold |
| #191 Tofu bibimbap (inactive)       | HP     |                        19.47 g | Mismatch                                 |
| #193 Teriyaki tofu rice (inactive)  | HP     |                        17.78 g | Mismatch                                 |
| #234 Anda paratha                   | HP     |                         6.64 g | Mismatch                                 |
| #241 Paneer jalfrezi                | HP     |                        14.38 g | Mismatch                                 |
| #242 Egg roast                      | HP     |                        13.78 g | Mismatch                                 |
| #249 Paneer fried rice              | HP     |                        12.20 g | Mismatch                                 |
| #252 Egg pulao                      | HP     |                        14.69 g | Mismatch                                 |
| #257 Paneer bhurji keto             | HP     |                        14.09 g | Mismatch                                 |
| #269 Vegetable omelette             | HP     |                        10.22 g | Mismatch                                 |

## Current dish evidence

Each snapshot preserves the current recipe, all stored ingredient quantities and units, menu metadata, purchase/pre-prep notes and a SHA-256 of the source file. Macro values are intentionally not repeated as whole-recipe nutrition.

<a id="dish-1"></a>

### #1 Chicken masala gravy

**File:** `data/dishes/chicken-masala-gravy.md`. **SHA-256:** `909e80b17378b04b461b9caa21e785262a3bdee81aac81b75d495e7fec928791`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred Yes; satiety High; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** Everyday chicken curry built on slow-browned onions and a tomato-curd masala.

**Ingredients for two:** Chicken 300 g; Onion 150 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Curd 50 g.

**Pre-prep:** None recorded. **Purchase note:** Curry cut chicken, 300g.

**Recipe:**

1. Brown the onions slowly in oil, then add ginger garlic paste.
2. Add tomato, green chilli and ground spices, cook till the oil separates.
3. Whisk in curd, then add the chicken and sear for a few minutes.
4. Pour in water, cover and simmer 25 minutes until tender.
5. Finish with coriander and a sprinkle of garam masala.

<a id="dish-2"></a>

### #2 Palak chicken gravy

**File:** `data/dishes/palak-chicken-gravy.md`. **SHA-256:** `1c08c93a0a016cef9fa95158420d1dd9f31fcbf687154fa999a851758e666e67`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** Chicken simmered in a spiced spinach gravy.

**Ingredients for two:** Chicken 300 g; Spinach 200 g; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** Curry cut chicken, 300g.

**Recipe:**

1. Blanch the spinach briefly, then blend to a coarse puree.
2. Brown onion, ginger, garlic and green chilli, add tomato and ground spices.
3. Sear the chicken in the masala, add water, cover and simmer till tender.
4. Stir in the spinach puree and simmer 5 minutes.
5. Finish with garam masala.

<a id="dish-3"></a>

### #3 Palak paneer

**File:** `data/dishes/palak-paneer.md`. **SHA-256:** `e4e0cceb28ecfea799feb123b1b2b4878e19011bc5eb9259d1de49674079ba0a`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Paneer cubes folded into a smooth, lightly spiced spinach gravy.

**Ingredients for two:** Paneer 200 g; Spinach 250 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Blanch the spinach briefly, then blend to a smooth puree.
2. Saute onion, ginger, garlic and green chilli, add tomato and cook down.
3. Stir in the spinach puree with salt and a little water, simmer 5 minutes.
4. Fold in the paneer cubes and warm through.
5. Finish with a swirl of cream and garam masala.

<a id="dish-4"></a>

### #4 Paneer do pyaza

**File:** `data/dishes/paneer-do-pyaza.md`. **SHA-256:** `a9c37702e97b6d888e0c1540eb807132e30d4d501aa42dd666c784af40040afc`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Paneer cooked with a double measure of onion in two textures.

**Ingredients for two:** Paneer 200 g; Onion 200 g; Tomato 100 g; Capsicum 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Set aside half the onion in diced petals; finely chop the rest.
2. Saute the chopped onion, ginger, garlic and green chilli, add tomato and spices.
3. Cook the masala till the oil separates.
4. Add the onion petals and capsicum, toss till softened but still crisp.
5. Fold in the paneer cubes, warm through and finish with garam masala.

<a id="dish-5"></a>

### #5 Shahi paneer

**File:** `data/dishes/shahi-paneer.md`. **SHA-256:** `76b7077092dddf28a3f7ff0100003b910faf89a88da1bcbf12cdb7ec902e24c7`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Paneer in a regal, creamy cashew gravy, mildly spiced and lightly sweet.

**Ingredients for two:** Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Simmer onion, cashew, ginger, garlic and green chilli till soft, then blend smooth.
2. Blend the tomato separately and cook it down before adding the white paste.
3. Cook the gravy gently with mild ground spices, never letting it brown.
4. Add a little cream and water, then fold in the paneer cubes.
5. Finish with cardamom and a pinch of sugar.

<a id="dish-6"></a>

### #6 Chole

**File:** `data/dishes/chole.md`. **SHA-256:** `d2ec13e4afada58317701648aa35f2d32de0c865425a43c3250cfcb36ed23bfc`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Chickpea; active Yes; preferred Yes; satiety High; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Spiced chickpea curry in a dark onion-tomato masala, a Punjabi staple.

**Ingredients for two:** Chickpea 150 g; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** Soak the chickpeas overnight. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook the soaked chickpeas with salt until soft.
2. Brown onion, then add ginger garlic paste and tomato.
3. Cook with chole masala and chilli powder till the oil separates.
4. Add the chickpeas with their water and simmer 15 minutes.
5. Mash a few chickpeas to thicken, finish with coriander.

<a id="dish-8"></a>

### #8 Kadhi

**File:** `data/dishes/kadhi.md`. **SHA-256:** `3430217f060217bfda9cefabd4fb18fff1271eca5d81360ef69f525767fc2c02`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Curd; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** A tangy besan and curd kadhi finished with a curry-leaf tempering.

**Ingredients for two:** Curd 300 g; Onion 50 g; Green Chilli 2 pcs; Curry Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Whisk 30 g besan with the listed 300 g curd and 500 ml water for two portions of kadhi.
2. Whisk the curd with besan, turmeric, salt and water until smooth and lump-free.
3. Bring to a gentle simmer, stirring constantly so it does not split.
4. Add onion and green chilli and simmer until thickened and no longer raw.
5. Temper cumin, curry leaves and dried red chilli in ghee and pour over.
6. Finish with coriander.

<a id="dish-9"></a>

### #9 Mushroom matar

**File:** `data/dishes/mushroom-matar.md`. **SHA-256:** `a0a4cd4c14dfcc1b73bd6444a6dc5b8e63ad71782b645c60286f083461efebde`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Mushroom; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Mushrooms and green peas simmered in a homely onion-tomato gravy.

**Ingredients for two:** Mushroom 200 g; Green Pea 100 g; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger, garlic and green chilli, then add tomato and spices.
2. Cook the masala down till the oil separates.
3. Add the sliced mushrooms and peas, then a little water for gravy.
4. Cover and simmer till the peas are soft and the gravy thickens.
5. Finish with garam masala.

<a id="dish-10"></a>

### #10 Mushroom corn

**File:** `data/dishes/mushroom-corn.md`. **SHA-256:** `504893d82375339d811c3e661ebf4029f7643b8d2f93016a1551fca734ee2ca7`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Mushroom; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Mushrooms and sweet corn tossed in a quick onion-tomato masala.

**Ingredients for two:** Mushroom 200 g; Sweet Corn 100 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger, garlic and green chilli till soft.
2. Add tomato and ground spices, cook till the oil separates.
3. Add the sliced mushrooms and cook till they release and reabsorb their water.
4. Stir in the sweet corn and warm through.
5. Season and serve dry.

<a id="dish-11"></a>

### #11 Mushroom paneer

**File:** `data/dishes/mushroom-paneer.md`. **SHA-256:** `1af9a362ca478d7356b89707382f01afaf5d6bf40d518a095f6dc9051d6cf663`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Paneer and mushrooms in a spiced onion-tomato gravy.

**Ingredients for two:** Mushroom 200 g; Paneer 150 g; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger, garlic and green chilli, add tomato and ground spices.
2. Cook the masala till the oil separates, then add a little water for gravy.
3. Add the sliced mushrooms and simmer till tender.
4. Fold in the paneer cubes and warm through.
5. Finish with garam masala and coriander.

<a id="dish-12"></a>

### #12 Egg curry

**File:** `data/dishes/egg-curry.md`. **SHA-256:** `1f23880913d6e1c430211f6537945bdf836dcc91601299af309e0e5354665d43`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Egg; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Boiled eggs simmered in a spiced onion-tomato gravy.

**Ingredients for two:** Egg 4 pcs; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil and peel the eggs, then lightly fry them with turmeric and salt.
2. Brown onion, add ginger garlic paste and green chilli.
3. Add tomato and spices, cook till the oil separates.
4. Pour in water for a gravy and simmer, then add the eggs.
5. Simmer 5 minutes and finish with coriander.

<a id="dish-13"></a>

### #13 Paneer bhurji

**File:** `data/dishes/paneer-bhurji.md`. **SHA-256:** `f73b35c720d2990ee7d275752becb48e5db1122d7ade4830f278f65dfd810c72`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Crumbled paneer tossed with onion, tomato and capsicum in a quick masala.

**Ingredients for two:** Paneer 200 g; Onion 100 g; Tomato 80 g; Capsicum 50 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger, green chilli and capsicum until soft.
2. Add tomato with turmeric, chilli powder and salt, cook till pulpy.
3. Stir in crumbled paneer and toss on high heat for two minutes.
4. Finish with coriander and a pinch of garam masala.

<a id="dish-14"></a>

### #14 Chicken keema

**File:** `data/dishes/chicken-keema.md`. **SHA-256:** `9a26bd33202cfe7e0e8b190dd4fad8809838fe0012cae5354bf4600a0e73f136`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken Keema; active Yes; preferred Yes; satiety High; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Minced chicken cooked dry with peas in an onion-tomato masala.

**Ingredients for two:** Chicken Keema 300 g; Onion 150 g; Tomato 100 g; Green Pea 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Chicken keema (minced chicken), 300g.

**Recipe:**

1. Brown the onions, then add ginger garlic paste and green chilli.
2. Add tomato and ground spices, cook till the oil separates.
3. Add the keema and peas, breaking up lumps, and sear.
4. Cover and cook on low till the mince is done and dry.
5. Finish with garam masala and coriander.

<a id="dish-15"></a>

### #15 Khichdi

**File:** `data/dishes/khichdi.md`. **SHA-256:** `7359853f9cd5d46b98312dbca6ee9ca9533c04b39a4a9d3093271de4506f5069`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Moong Dal; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Soft one-pot rice and moong dal cooked with ginger, a light comfort meal.

**Ingredients for two:** Moong Dal 100 g; Tomato 50 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse 100 g dry rice with the listed dry moong dal; use 650 ml water for a soft khichdi, adding hot water at the end only to loosen it.
2. Rinse rice and moong dal together and drain.
3. Temper cumin, ginger and green chilli in ghee, add tomato.
4. Add the rice and dal with turmeric, salt and plenty of water.
5. Pressure cook until soft and porridge-like.
6. Finish with coriander and a squeeze of lemon.

<a id="dish-16"></a>

### #16 Curd rice

**File:** `data/dishes/curd-rice.md`. **SHA-256:** `9ca7171a32d87ce859f8f1f81810f12e4dbd4b9245fd7687f6cbb8bfd4a98298`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Curd; active Yes; preferred Yes; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Cooling South Indian curd rice with a mustard and curry-leaf tempering.

**Ingredients for two:** Curd 250 g; Curry Leaf 5 g; Ginger 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Mash cooked rice while warm and let it cool slightly.
3. Mix in the curd, grated ginger and salt to a soft consistency.
4. Temper mustard seeds, curry leaves and green chilli in oil.
5. Pour the tempering over and stir through.

<a id="dish-17"></a>

### #17 Lemon rice

**File:** `data/dishes/lemon-rice.md`. **SHA-256:** `250216dd030c318f23e9e005de27100cf571f758052074bdadcad2491d5e55d3`.

**Menu:** Rice; Lunch; tags none; primaryIngredient Lemon; active Yes; preferred Yes; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Cooked rice tossed in a tangy lemon, turmeric and peanut tempering.

**Ingredients for two:** Lemon 2 pcs; Green Chilli 2 pcs; Curry Leaf 5 g; Peanut 20 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Cook and cool the rice so the grains stay separate.
3. Temper mustard seeds, peanuts, curry leaves and green chilli in oil.
4. Add turmeric, then fold in the rice with salt.
5. Turn off the heat and stir in the lemon juice.

<a id="dish-18"></a>

### #18 Tomato rice

**File:** `data/dishes/tomato-rice.md`. **SHA-256:** `c98106d349eef93f92f7bd8bfb314a6535082393c38bcb86df61b5762a344b74`.

**Menu:** Rice; Lunch; tags none; primaryIngredient Tomato; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Rice tossed in a tangy tomato masala with a curry-leaf and peanut tempering.

**Ingredients for two:** Tomato 200 g; Green Chilli 2 pcs; Curry Leaf 5 g; Peanut 20 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Cook and cool the rice so the grains stay separate.
3. Temper mustard seeds, peanuts, curry leaves and green chilli in oil.
4. Add pureed tomato with turmeric, chilli and salt, cook till thick.
5. Fold in the rice and warm through.

<a id="dish-19"></a>

### #19 Fish curry

**File:** `data/dishes/fish-curry.md`. **SHA-256:** `2c8b1743fcb0f4045a8c225d9b41c0657523ca4f6a3f1ac63ba448480ce75f20`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Fish; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Coastal-style fish simmered in a coconut and tomato gravy with curry leaves.

**Ingredients for two:** Fish 300 g; Onion 100 g; Tomato 100 g; Coconut Milk 100 ml; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Curry Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Fresh fish steaks, 300g.

**Recipe:**

1. Saute onion, ginger, garlic, green chilli and curry leaves.
2. Add tomato and spices, cook till pulpy and the oil separates.
3. Pour in coconut milk and a little water, bring to a gentle simmer.
4. Slide in the fish and cook 8 minutes without stirring much.
5. Finish with coriander.

<a id="dish-20"></a>

### #20 Prawn curry

**File:** `data/dishes/prawn-curry.md`. **SHA-256:** `f0b1016d3d6cba9629fcc424d475ad3cd1d5ec4821eb196d4ca615a907644a2c`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Prawn; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Prawns simmered in a coconut and tomato gravy with curry leaves.

**Ingredients for two:** Prawn 300 g; Onion 100 g; Tomato 100 g; Coconut Milk 100 ml; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Curry Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Cleaned, deveined prawns, 300g.

**Recipe:**

1. Saute onion, ginger, garlic, green chilli and curry leaves.
2. Add tomato and spices, cook till pulpy and the oil separates.
3. Pour in coconut milk and a splash of water, bring to a simmer.
4. Add the prawns and cook just until they turn pink and curl.
5. Finish with coriander.

<a id="dish-21"></a>

### #21 Bhindi

**File:** `data/dishes/bhindi.md`. **SHA-256:** `c94b5ff57f0b679b786918b1eb8fcd537c8347aa2b86e7d14be654245007e8a3`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Bhindi; active Yes; preferred Yes; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Stir-fried okra with onion, tomato and a light dusting of spices.

**Ingredients for two:** Bhindi 250 g; Onion 80 g; Tomato 50 g; Green Chilli 1 pcs; Ginger 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Wash and fully dry the okra, then cut into rounds.
2. Saute on high heat in oil until the stickiness goes, set aside.
3. Saute onion, ginger, green chilli and tomato into a quick masala.
4. Return the okra, add turmeric, chilli and salt, toss and cook through.

<a id="dish-22"></a>

### #22 Gobi aloo

**File:** `data/dishes/gobi-aloo.md`. **SHA-256:** `a6656c49940e481a56d0d0252b8143837876a2b67f43993083376029b979f690`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Cauliflower; active Yes; preferred Yes; satiety Medium; active prep 25 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Cauliflower and potato stir-fried with onion, tomato and warming spices.

**Ingredients for two:** Cauliflower 200 g; Potato 150 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the cauliflower into florets and the potato into cubes.
2. Saute onion, ginger and green chilli, then add tomato and cook down.
3. Add the cauliflower and potato with turmeric, chilli and salt.
4. Cover and cook on low till tender, tossing now and then.
5. Finish with garam masala and coriander.

<a id="dish-23"></a>

### #23 Cabbage peas aloo

**File:** `data/dishes/cabbage-peas-aloo.md`. **SHA-256:** `85fc575a84ec4a40ed802d254410f607664249c288b3727023e94b4d35593f08`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Cabbage; active Yes; preferred No; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Shredded cabbage cooked down with peas and potato.

**Ingredients for two:** Cabbage 200 g; Green Pea 80 g; Potato 100 g; Onion 80 g; Ginger 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Temper cumin, ginger and green chilli, then soften the onion.
2. Add diced potato with turmeric and salt, cook a few minutes.
3. Add the shredded cabbage and peas.
4. Cover and cook on low until the cabbage wilts and the potato is tender.

<a id="dish-24"></a>

### #24 Carrot aloo

**File:** `data/dishes/carrot-aloo.md`. **SHA-256:** `dd651a13e7643b1e8de5d743a8cbeb174adabb8869ae8707938020914f710960`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Carrot; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Diced carrot and potato cooked dry with a light tempering.

**Ingredients for two:** Carrot 200 g; Potato 150 g; Onion 80 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Temper cumin, ginger and green chilli, then soften the onion.
2. Add diced carrot and potato with turmeric and salt.
3. Cover and cook on low until both are tender, stirring now and then.
4. Finish with coriander.

<a id="dish-25"></a>

### #25 Capsicum aloo

**File:** `data/dishes/capsicum-aloo.md`. **SHA-256:** `cbee41db614c1e75ff8fe59aeb82fd3025c25f400f36fd34338ee1ff9d075fdb`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Capsicum; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Capsicum and potato stir-fried with a simple cumin tempering.

**Ingredients for two:** Capsicum 200 g; Potato 150 g; Onion 80 g; Ginger 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Temper cumin, ginger and green chilli in oil.
2. Add diced potato with turmeric and salt, cook covered until nearly done.
3. Add the onion and capsicum.
4. Stir-fry uncovered on high heat until the capsicum is just tender.

<a id="dish-26"></a>

### #26 Broccoli corn

**File:** `data/dishes/broccoli-corn.md`. **SHA-256:** `8e4ddcb0d2d130ab510a37007ccfea491e0f16405cb83567627e3952acb8add8`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Broccoli; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Crisp broccoli florets and sweet corn tossed with garlic.

**Ingredients for two:** Broccoli 200 g; Sweet Corn 100 g; Onion 80 g; Garlic 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Blanch the broccoli florets briefly so they stay bright and crisp.
2. Saute garlic and green chilli, then the onion until soft.
3. Add the broccoli, corn, salt and pepper.
4. Toss on high heat for a few minutes, keeping the broccoli with bite.

<a id="dish-27"></a>

### #27 Beans onion

**File:** `data/dishes/beans-onion.md`. **SHA-256:** `b02878108beed16d88b262c359ab89479a508a1703217e679e7ade79b951414c`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient French Bean; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Finely chopped French beans stir-fried with onion and a light tempering.

**Ingredients for two:** French Bean 250 g; Onion 100 g; Tomato 50 g; Ginger 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Chop the beans fine so they cook quickly and evenly.
2. Temper cumin, ginger and green chilli, then soften the onion.
3. Add tomato and the beans with turmeric and salt.
4. Cover and cook on low until the beans are just tender.

<a id="dish-28"></a>

### #28 Jeera aloo

**File:** `data/dishes/jeera-aloo.md`. **SHA-256:** `5fc0cb3b3daae19d633f6a56a40e51a5b2ff15f56e2f8d9c4a29e34755251f55`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Potato; active Yes; preferred Yes; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Boiled potato cubes tossed in a cumin tempering with green chilli.

**Ingredients for two:** Potato 300 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the potatoes, peel and cut into cubes.
2. Temper cumin seeds and slit green chilli in oil until fragrant.
3. Add the potato with turmeric, chilli powder and salt, toss to coat.
4. Saute a few minutes till lightly crisp, finish with coriander.

<a id="dish-29"></a>

### #29 Poha

**File:** `data/dishes/poha.md`. **SHA-256:** `e483c4fb1467edac041bf2ffd1fbaa5c6ab7cf2d291a2a5f6b96a05de23144a7`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Flattened Rice; active Yes; preferred Yes; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Light flattened rice tossed with potato, peanuts and a curry-leaf tempering.

**Ingredients for two:** Flattened Rice 200 g; Potato 100 g; Onion 80 g; Green Chilli 2 pcs; Peanut 30 g; Curry Leaf 5 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Rinse flattened rice in a sieve until just soft, drain and set aside.
2. Temper mustard seeds, curry leaves, green chilli and peanuts in oil.
3. Add onion and diced potato, cook covered till the potato is tender.
4. Fold in the drained poha, turmeric and salt, warm through.
5. Finish with lemon juice and coriander.

<a id="dish-30"></a>

### #30 Boiled eggs

**File:** `data/dishes/boiled-eggs.md`. **SHA-256:** `492018f74c2c7fe7fe4bb100df458308fa78e4190feda72200150686533b099b`.

**Menu:** Keto; Breakfast; tags HP, cuisine_neutral; primaryIngredient Egg; active Yes; preferred Yes; satiety High; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** Simple hard-boiled eggs, a clean high-protein keto side.

**Ingredients for two:** Egg 4 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Lower the eggs into boiling water and cook 9 minutes.
2. Drain and plunge into cold water, then peel.
3. Halve, season with salt and pepper, and serve.

<a id="dish-31"></a>

### #31 Vegetable sevai

**File:** `data/dishes/vegetable-sevai.md`. **SHA-256:** `a8bfeff72023f9572a16f169f9acd4ff6495c478f8705526d6bbf09cec23fc50`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Rice Vermicelli; active Yes; preferred Yes; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Rice vermicelli tossed with vegetables and a curry-leaf tempering.

**Ingredients for two:** Rice Vermicelli 200 g; Carrot 50 g; French Bean 50 g; Capsicum 50 g; Onion 80 g; Green Chilli 2 pcs; Curry Leaf 5 g; Coriander Leaf 10 g; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dry-roast the rice vermicelli lightly, then soak or steam till just soft and drain.
2. Temper mustard seeds, curry leaves and green chilli in oil.
3. Saute the onion and diced vegetables till tender-crisp.
4. Fold in the vermicelli and toss gently to combine.
5. Finish with lemon and coriander.

<a id="dish-32"></a>

### #32 Besan paneer chilla

**File:** `data/dishes/besan-paneer-chilla.md`. **SHA-256:** `db6ebef2a3d6d0166fcad177cbfdf79069bda102d8b0f3158c73d548cade49f1`.

**Menu:** Chilla; Breakfast; tags HP, complete_carb; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Savoury gram-flour pancakes studded with crumbled paneer and onion.

**Ingredients for two:** Paneer 100 g; Onion 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Tomato 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four small chillas (two portions), use 80 g besan and 120 ml water; add up to 30 ml more to make a spreadable batter.
2. Whisk besan with water, salt and turmeric into a smooth pouring batter.
3. Stir in crumbled paneer, chopped onion, tomato, green chilli and coriander.
4. Ladle onto a hot greased tawa and spread into a thin round.
5. Cook both sides on medium heat until set and lightly browned.

<a id="dish-33"></a>

### #33 Bread omelette

**File:** `data/dishes/bread-omelette.md`. **SHA-256:** `0d2894d3815809489489c5009554b93d8658497933d1ad555528f1af1a7dd7f7`.

**Menu:** Complete meal; Breakfast; tags HP, complete_meal; primaryIngredient Egg; active Yes; preferred Yes; satiety High; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** A quick masala omelette folded around toasted bread.

**Ingredients for two:** Bread 4 pcs; Egg 4 pcs; Onion 50 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Beat the eggs with chopped onion, green chilli, coriander and salt.
2. Pour into a hot oiled pan and let the base set.
3. Lay the bread slices on top, flip once, and toast both sides.
4. Fold the omelette around the bread and serve hot.

<a id="dish-34"></a>

### #34 Sabudana khichdi

**File:** `data/dishes/sabudana-khichdi.md`. **SHA-256:** `812da97ebcd3e9474e4c7910eb3659393efaf935e00ac589b794541b357632cc`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Sabudana; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Soaked tapioca pearls tossed with potato, peanuts and green chilli.

**Ingredients for two:** Sabudana 150 g; Potato 100 g; Peanut 30 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Lemon 1 pcs; Curry Leaf 5 g.

**Pre-prep:** Soak the sabudana overnight till the pearls swell and separate. **Purchase note:** None recorded.

**Recipe:**

1. Drain the soaked sabudana and toss with crushed roasted peanuts and salt.
2. Temper cumin, green chilli and curry leaves in oil or ghee.
3. Add diced potato and cook covered till tender.
4. Fold in the sabudana and cook gently till the pearls turn translucent.
5. Finish with lemon juice and coriander.

<a id="dish-35"></a>

### #35 Hung curd sandwiches (inactive)

**File:** `data/dishes/hung-curd-sandwiches.md`. **SHA-256:** `bafe9935088d0b2d3e71d4551955a979cd93ba7da5043fc32607fe5dc2cb28f8`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Curd; active No; preferred No; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Sandwiches filled with thick hung curd and crunchy vegetables.

**Ingredients for two:** Curd 300 g; Bread 4 pcs; Cucumber 80 g; Capsicum 50 g; Onion 50 g; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** Hang the curd overnight to drain. **Purchase note:** None recorded.

**Recipe:**

1. Beat the drained hung curd with salt, pepper and chopped green chilli.
2. Fold in finely diced cucumber, capsicum, onion and coriander.
3. Spread thickly between the bread slices.
4. Press, trim the crusts and cut into triangles.

<a id="dish-36"></a>

### #36 Aloo paratha

**File:** `data/dishes/aloo-paratha.md`. **SHA-256:** `f8c472b96908807d95a558aea6e79d01291fbe6f986eff11a39dd056d4a588f5`.

**Menu:** Paratha; Breakfast; tags complete_carb; primaryIngredient Potato; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Wheat parathas stuffed with spiced mashed potato, griddled till golden.

**Ingredients for two:** Potato 200 g; Onion 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Ginger 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; use the listed potato filling.
2. Boil and mash the potato, mix in onion, ginger, green chilli, coriander and salt.
3. Knead a soft wheat dough and rest it 10 minutes.
4. Stuff each dough ball with the potato mix and roll out gently.
5. Griddle on a hot tawa with ghee until both sides are golden.

<a id="dish-37"></a>

### #37 Gobi paratha

**File:** `data/dishes/gobi-paratha.md`. **SHA-256:** `f996c1907735368cad180cd994c343f04a7ea2a85e4f61b7e1442fd0347012f5`.

**Menu:** Paratha; Breakfast; tags complete_carb; primaryIngredient Cauliflower; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Whole-wheat parathas stuffed with spiced grated cauliflower.

**Ingredients for two:** Cauliflower 200 g; Onion 50 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; use the listed cauliflower filling.
2. Grate the cauliflower, squeeze out moisture, and mix with onion, ginger, chilli, coriander and spices.
3. Roll a ball of atta dough, place the filling, seal and roll out gently.
4. Cook on a hot tawa with ghee until golden brown spots appear on both sides.
5. Serve hot with curd or pickle.

<a id="dish-38"></a>

### #38 Paneer paratha

**File:** `data/dishes/paneer-paratha.md`. **SHA-256:** `9e9a9ebf6058bbbdc11c39c016f60cf72e1a4216cfce40e0611343276bf2bb5d`.

**Menu:** Paratha; Breakfast; tags HP, complete_carb; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Whole-wheat paratha stuffed with spiced grated paneer.

**Ingredients for two:** Paneer 150 g; Onion 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Ginger 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; use the listed paneer filling.
2. Grate the paneer and mix with finely chopped onion, chilli, ginger, coriander and salt.
3. Roll out a wheat-dough disc, place the filling and seal into a ball.
4. Dust and roll out gently into a paratha without tearing.
5. Cook on a hot tawa with ghee, turning, till golden on both sides.
6. Serve hot with curd or pickle.

<a id="dish-39"></a>

### #39 Masala oats

**File:** `data/dishes/masala-oats.md`. **SHA-256:** `0cc59ca5854dd42f6d4f4094c39503169825af699ef71118fc40842463a0ee5c`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Oats; active Yes; preferred No; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Quick savoury oats simmered with vegetables and a light Indian masala.

**Ingredients for two:** Oats 100 g; Onion 50 g; Tomato 80 g; Green Pea 30 g; Carrot 30 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Ginger 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger and green chilli in a little oil.
2. Add tomato, peas and carrot, cook until softened.
3. Stir in oats with turmeric and salt, then add hot water.
4. Simmer until thick and creamy, finish with coriander.

<a id="dish-40"></a>

### #40 Chicken sandwich

**File:** `data/dishes/chicken-sandwich.md`. **SHA-256:** `40da1ca2f945260ec893ac3744f3f958690db4ca7c013bc5ba5ab524f290db42`.

**Menu:** Complete meal; Breakfast; tags HP, complete_meal; primaryIngredient Chicken Breast; active Yes; preferred Yes; satiety High; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** A filling sandwich of seared chicken with lettuce and tomato.

**Ingredients for two:** Bread 4 pcs; Chicken 150 g; Lettuce 30 g; Tomato 50 g; Onion 30 g; Cucumber 30 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Season the chicken with salt and pepper and sear until cooked, then slice thin.
2. Toast the bread lightly.
3. Layer chicken, lettuce, tomato, onion and cucumber between the slices.
4. Season, press and cut into halves.

<a id="dish-42"></a>

### #42 Sprouts salad

**File:** `data/dishes/sprouts-salad.md`. **SHA-256:** `9c30fc8846bc940d442eef45a1c0b268c1cf5f6c175abc086d59df5c45132a3b`.

**Menu:** Complete meal; Breakfast; tags HP, complete_meal; primaryIngredient Sprout; active Yes; preferred Yes; satiety Medium; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** A protein-packed raw salad of moong sprouts with onion, tomato and lemon.

**Ingredients for two:** Sprout 200 g; Onion 50 g; Tomato 50 g; Cucumber 50 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** Sprout the moong over a day or two if not buying it ready-sprouted. **Purchase note:** None recorded.

**Recipe:**

1. Steam the sprouts briefly for a softer bite, or use them raw.
2. Dice the onion, tomato and cucumber fine, chop the green chilli.
3. Toss everything together in a bowl.
4. Dress with lemon juice, salt and a pinch of chaat masala.
5. Finish with coriander.

<a id="dish-43"></a>

### #43 Chicken salad

**File:** `data/dishes/chicken-salad.md`. **SHA-256:** `0c1a0803491764a9aa4455acb2b50429f60dc2a94ba96ce36c44134fd3f889b6`.

**Menu:** Accompaniment; Lunch; tags HP; primaryIngredient Chicken Breast; active Yes; preferred Yes; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Seared chicken tossed with lettuce, cucumber and a lemon dressing.

**Ingredients for two:** Chicken 200 g; Lettuce 50 g; Cucumber 80 g; Tomato 80 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Season the chicken with salt and pepper and sear until cooked, then dice.
2. Chop the lettuce, cucumber, tomato and onion.
3. Toss everything with lemon juice, coriander, salt and pepper.

<a id="dish-44"></a>

### #44 Prawn salad

**File:** `data/dishes/prawn-salad.md`. **SHA-256:** `a18c6f63b876b95ec974ff520bee89f1907c06589827152520a6b952677cc57c`.

**Menu:** Accompaniment; Lunch; tags HP, cuisine_neutral; primaryIngredient Prawn; active Yes; preferred No; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Poached prawns over crisp salad leaves with a lemon dressing.

**Ingredients for two:** Prawn 200 g; Lettuce 50 g; Cucumber 80 g; Tomato 80 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Cleaned prawns, 200g.

**Recipe:**

1. Poach the cleaned prawns in salted water till just pink, then drain and cool.
2. Tear the lettuce and dice the cucumber, tomato and onion.
3. Toss the prawns with the vegetables.
4. Dress with lemon juice, olive oil, salt and pepper.
5. Finish with coriander.

<a id="dish-45"></a>

### #45 Chole salad (inactive)

**File:** `data/dishes/chole-salad.md`. **SHA-256:** `61ede90c6160782050eaf03e435db0a14574b8187b221c007a091610ca0cca94`.

**Menu:** Accompaniment; Lunch; tags HP; primaryIngredient Chickpea; active No; preferred Yes; satiety Medium; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** A protein-rich salad of boiled chickpeas with onion, tomato and lemon.

**Ingredients for two:** Chickpea 150 g; Onion 50 g; Tomato 50 g; Cucumber 50 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Use boiled chickpeas, drained and cooled.
2. Finely dice the onion, tomato and cucumber.
3. Toss with chopped green chilli, coriander, salt and a pinch of chaat masala.
4. Squeeze over the lemon just before serving.

<a id="dish-46"></a>

### #46 Cucumber salad

**File:** `data/dishes/cucumber-salad.md`. **SHA-256:** `98130b363e21526acb4ca22c01c2ea88f320cd4b4df061872a225847d2683202`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Cucumber; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Crunchy cucumber tossed with onion, lemon and coriander, a cooling lunch side.

**Ingredients for two:** Cucumber 250 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dice the cucumber and onion fine, slit the green chilli.
2. Toss with lemon juice, salt and a pinch of roasted cumin powder.
3. Fold in coriander and serve chilled.

<a id="dish-47"></a>

### #47 Onion tomato salad

**File:** `data/dishes/onion-tomato-salad.md`. **SHA-256:** `3c472fde237d7d12601bad1ffa68e2a55d1873fb16fa1e25680ddda704e7b25b`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Tomato; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Sliced onion and tomato dressed with lemon, a simple everyday lunch side.

**Ingredients for two:** Onion 150 g; Tomato 150 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Slice the onion and tomato into thin rounds, slit the green chilli.
2. Squeeze over lemon juice and season with salt.
3. Scatter coriander on top and serve fresh.

<a id="dish-48"></a>

### #48 Mixed veg salad

**File:** `data/dishes/mixed-veg-salad.md`. **SHA-256:** `4c20d0a616d0f23bb059a63cd9d7b710bb6ca2fe6e302bcee5cdde058b60de7e`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Mixed Veg; active Yes; preferred Yes; satiety Low; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** A crisp raw salad of cucumber, carrot and cabbage dressed with lemon.

**Ingredients for two:** Cucumber 80 g; Carrot 80 g; Cabbage 80 g; Tomato 80 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Shred the cabbage and carrot, dice the cucumber, tomato and onion.
2. Toss everything together in a bowl.
3. Dress with lemon juice, salt and a pinch of black pepper.
4. Scatter coriander over and serve cold.

<a id="dish-49"></a>

### #49 Carrot cucumber salad

**File:** `data/dishes/carrot-cucumber-salad.md`. **SHA-256:** `ff8497b37f1d84f95aa0fb45cab0c26c429f43be34190188afd2889973f2e74a`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Carrot; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** A fresh grated carrot and cucumber salad sharpened with lemon.

**Ingredients for two:** Carrot 150 g; Cucumber 150 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Grate the carrot and finely dice the cucumber.
2. Toss with chopped green chilli, coriander and salt.
3. Squeeze over the lemon just before serving.

<a id="dish-50"></a>

### #50 Chole bhature

**File:** `data/dishes/chole-bhature.md`. **SHA-256:** `5b1d72926eb2ffbdb6e7775c9e1fbd4692b9e089fffd203ed6e5fb9b3b5e6bfb`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Chickpea; active Yes; preferred Yes; satiety High; active prep 50 minutes; seasons All; cuisine Indian.

**Description:** Spiced chickpea chole served with soft, puffy deep-fried bhature.

**Ingredients for two:** Chickpea 150 g; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Curd 50 g.

**Pre-prep:** Soak the chickpeas overnight and rest the bhatura dough for two hours ahead. **Purchase note:** None recorded.

**Recipe:**

1. For four small bhature (two portions), mix 160 g maida, the listed 50 g curd, 2 g sugar, 1 g baking powder and 5 ml oil; knead with 45 ml water, adding up to 15 ml more only if needed. Cover and rest for 2 hours before rolling.
2. Pressure cook the soaked chickpeas with salt until soft.
3. Brown onion, ginger and garlic, add tomato and chole masala, cook till oil separates.
4. Add the chickpeas with some cooking water and simmer until thick.
5. Roll the proved maida-curd dough and deep-fry into puffed bhature.
6. Serve the chole hot with the bhature and coriander.

<a id="dish-51"></a>

### #51 Aloo puri

**File:** `data/dishes/aloo-puri.md`. **SHA-256:** `c529ca0917cde7993babaff71b3c433ad36c9dbf7748f220d0e994957eebfae9`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Potato; active Yes; preferred Yes; satiety High; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** A spiced potato masala served with puffy deep-fried puris.

**Ingredients for two:** Potato 250 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Ginger 10 g.

**Pre-prep:** Boil the potatoes the night before for a quicker morning. **Purchase note:** None recorded.

**Recipe:**

1. For eight small puris (two portions), knead 160 g whole-wheat atta with 80 ml water and 5 ml oil into a firm dough; rest 15 minutes.
2. Boil and roughly mash the potatoes, keeping some texture.
3. Temper cumin, ginger and green chilli, add the potato with turmeric and salt.
4. Loosen with a splash of water into a soft masala and finish with coriander.
5. Knead a stiff atta dough, roll into small discs and deep-fry until they puff.
6. Serve the hot puris with the potato masala.

<a id="dish-52"></a>

### #52 Raita

**File:** `data/dishes/raita.md`. **SHA-256:** `7af20404581eb664d05c7f35f50d2d54fb7e346c1803aa4c2945bc927205190c`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Curd; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Whisked curd with cucumber, onion and tomato, a cooling side for any meal.

**Ingredients for two:** Curd 300 g; Cucumber 50 g; Onion 30 g; Tomato 30 g; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Whisk the curd smooth with salt and roasted cumin powder.
2. Stir in finely chopped cucumber, onion, tomato and green chilli.
3. Fold in coriander and chill until serving.

<a id="dish-53"></a>

### #53 Kheer

**File:** `data/dishes/kheer.md`. **SHA-256:** `acf0a360b36c3892f7aa1878f1e559ab6753ae66002f940b8f524231fa3c4ae7`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Milk; active Yes; preferred Yes; satiety Medium; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Rice slow-cooked in reduced milk with cardamom, cashews and raisins.

**Ingredients for two:** Milk 500 ml; Cashew 20 g; Raisin 15 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two dessert portions, use 40 g dry short-grain rice with the listed 500 ml milk and 30 g sugar.
2. Bring the milk to a boil and add washed rice.
3. Simmer on low, stirring often, until the rice is soft and the milk thickens.
4. Add sugar and cardamom, cook a few more minutes.
5. Fold in cashews and raisins, serve warm or chilled.

<a id="dish-54"></a>

### #54 Butter chicken

**File:** `data/dishes/butter-chicken.md`. **SHA-256:** `1f041211796addd1ca856107106d7750d3e5a7e3bf60fa0814f685595b3a5fa3`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred Yes; satiety High; active prep 45 minutes; seasons All; cuisine Indian.

**Description:** Tandoori-style chicken simmered in a silky tomato, butter and cashew gravy.

**Ingredients for two:** Chicken 300 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Curd 60 g.

**Pre-prep:** Marinate the chicken for at least 30 minutes. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. Marinate the chicken in curd, ginger garlic paste and spices, then sear and set aside.
2. Cook onion, tomato, cashew and ginger garlic till soft, then blend smooth.
3. Strain the puree back into the pan with butter and simmer.
4. Add the chicken with a little cream and kasuri methi, simmer till cooked.
5. Finish with a swirl of cream and coriander.

<a id="dish-55"></a>

### #55 Chicken curry

**File:** `data/dishes/chicken-curry.md`. **SHA-256:** `9a125948e74c1f97ccff40f9fed4142d4ac283554a32cbac8e8fbe3a7d3d095b`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred Yes; satiety High; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** Home-style chicken curry in a spiced onion-tomato gravy.

**Ingredients for two:** Chicken 300 g; Onion 150 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Curry cut chicken, 300g.

**Recipe:**

1. Brown the onions slowly in oil, then add ginger garlic paste.
2. Add tomato, green chilli and ground spices, cook till the oil separates.
3. Add the chicken and sear for a few minutes.
4. Pour in water, cover and simmer 25 minutes until tender.
5. Finish with coriander and a sprinkle of garam masala.

<a id="dish-56"></a>

### #56 Chicken stew

**File:** `data/dishes/chicken-stew.md`. **SHA-256:** `6384fa142688ce2eaa9d5d418436810da78fc8f6c68f2e398da017ffdd5ce210`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** A gentle Kerala-style chicken stew in a coconut-milk broth.

**Ingredients for two:** Chicken 300 g; Potato 150 g; Carrot 80 g; Onion 100 g; Coconut Milk 150 ml; Ginger 10 g; Garlic 10 g; Curry Leaf 5 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** Curry cut chicken, 300g.

**Recipe:**

1. Saute ginger, garlic, green chilli, curry leaves and sliced onion without browning.
2. Add the chicken and sear lightly, then add diced potato and carrot.
3. Pour in water, cover and simmer until the chicken and vegetables are tender.
4. Stir in the coconut milk and warm through without boiling.
5. Season and finish with a little pepper.

<a id="dish-57"></a>

### #57 Anda bhurji

**File:** `data/dishes/anda-bhurji.md`. **SHA-256:** `743757ddc35b898a51c404b4b41ea373b8edcc5ad92c05d142ac777193eb3de2`.

**Menu:** Dry dish; Breakfast; tags HP; primaryIngredient Egg; active Yes; preferred Yes; satiety High; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** Indian scrambled eggs cooked down with onion, tomato and green chilli.

**Ingredients for two:** Egg 4 pcs; Onion 100 g; Tomato 80 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger and green chilli until soft.
2. Add tomato with turmeric, chilli powder and salt, cook till pulpy.
3. Pour in beaten eggs and scramble on medium heat until just set.
4. Finish with coriander and serve with toast or pav.

<a id="dish-58"></a>

### #58 Egg masala dry

**File:** `data/dishes/egg-masala-dry.md`. **SHA-256:** `80e56588ce1e3afb01b7f54d9d1d54ff48f1b7cf2f8d37b43bda178cbcc31665`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Egg; active Yes; preferred Yes; satiety High; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Boiled eggs tossed in a dry onion-tomato masala.

**Ingredients for two:** Egg 4 pcs; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil and halve the eggs, then fry lightly with turmeric and chilli.
2. Saute onion, ginger and garlic until soft, add tomato and ground spices.
3. Cook the masala down dry until the oil separates.
4. Fold in the eggs to coat and finish with coriander.

<a id="dish-59"></a>

### #59 Paneer butter masala

**File:** `data/dishes/paneer-butter-masala.md`. **SHA-256:** `1c8deae585749bf71afc93d569b3683523e416bf90ef0c58767e0de9489911fa`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Paneer in a rich, mildly sweet tomato and cashew gravy.

**Ingredients for two:** Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Simmer onion, tomato, cashew, ginger and garlic till soft, then blend smooth.
2. Strain the puree back into the pan and cook with butter and ground spices.
3. Add a splash of water and simmer to a glossy gravy.
4. Fold in the paneer cubes and warm through.
5. Finish with a swirl of cream, crushed kasuri methi and coriander.

<a id="dish-60"></a>

### #60 Kadai paneer

**File:** `data/dishes/kadai-paneer.md`. **SHA-256:** `01efaed387c438b55938368712b8702303af6868e00e38202bc5dc0651256947`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Paneer and capsicum in a robust tomato gravy with freshly crushed kadai masala.

**Ingredients for two:** Paneer 200 g; Onion 100 g; Tomato 100 g; Capsicum 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dry roast coriander seeds and dried chilli, then coarsely crush.
2. Saute onion, ginger, garlic and capsicum in the kadhai.
3. Add tomato and the crushed masala, cook till the oil separates.
4. Fold in the paneer cubes and toss for a few minutes.
5. Finish with coriander and a pinch of kasuri methi.

<a id="dish-61"></a>

### #61 Matar paneer

**File:** `data/dishes/matar-paneer.md`. **SHA-256:** `46899cd58de1e05c53ae5e7e46e8a142709b467a25878c902b81ae4991062c56`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Paneer cubes and green peas in a smooth onion-tomato gravy.

**Ingredients for two:** Paneer 150 g; Green Pea 100 g; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger, garlic and green chilli, then add tomato and cook down.
2. Add ground spices and cook till the oil separates, then blend smooth if you like.
3. Add the peas with a little water and simmer till tender.
4. Fold in the paneer cubes and warm through.
5. Finish with garam masala and coriander.

<a id="dish-62"></a>

### #62 Paneer capsicum

**File:** `data/dishes/paneer-capsicum.md`. **SHA-256:** `23a51c51cca25d77b3f39ad8a4eb7b4dda8cdfa314112b81608803f24da708e4`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Paneer and capsicum tossed dry in a quick onion-tomato masala.

**Ingredients for two:** Paneer 200 g; Capsicum 150 g; Onion 100 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the paneer, capsicum and onion into squares.
2. Saute onion, ginger, garlic and green chilli, then add tomato and spices.
3. Cook the masala till the oil separates.
4. Toss in the capsicum and paneer on high heat till the capsicum is just tender.
5. Season and serve dry.

<a id="dish-63"></a>

### #63 Dal tadka

**File:** `data/dishes/dal-tadka.md`. **SHA-256:** `e5040749b31f604315207d35196c312c5f3d892961d0b391c5b092cca435eaf7`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Toor Dal; active Yes; preferred Yes; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Soft toor dal finished with a sizzling garlic and curry-leaf tempering.

**Ingredients for two:** Toor Dal 100 g; Onion 80 g; Tomato 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Curry Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook toor dal with turmeric and salt until soft.
2. Saute onion, ginger, green chilli and tomato into a quick masala.
3. Stir the masala into the dal and simmer to the consistency you like.
4. Temper garlic, cumin and curry leaves in ghee and pour over.
5. Finish with coriander.

<a id="dish-64"></a>

### #64 Dal fry

**File:** `data/dishes/dal-fry.md`. **SHA-256:** `a4b74d3de46c59928b17b3f9f0a9fc99181293e9d68e8618044a9797de0f6f45`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Toor Dal; active Yes; preferred Yes; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Toor dal cooked into a soft onion-tomato masala, richer than a plain tadka.

**Ingredients for two:** Toor Dal 100 g; Onion 80 g; Tomato 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook toor dal with turmeric and salt until soft.
2. Saute onion, ginger, garlic and green chilli till golden.
3. Add tomato and ground spices, cook till the oil separates.
4. Stir in the dal and simmer to the consistency you like.
5. Finish with coriander.

<a id="dish-65"></a>

### #65 Moong dal

**File:** `data/dishes/moong-dal.md`. **SHA-256:** `f9f53e9d257546bf1edcd620fe13fbb603a36379930d525aea44c00221b28fe2`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Moong Dal; active Yes; preferred Yes; satiety Low; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Light yellow moong dal finished with a simple cumin and garlic tempering.

**Ingredients for two:** Moong Dal 100 g; Onion 50 g; Tomato 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook moong dal with turmeric and salt until soft.
2. Saute onion, ginger, green chilli and tomato into a quick masala.
3. Stir the masala into the dal and simmer to a pourable consistency.
4. Temper cumin and garlic in ghee and pour over.
5. Finish with coriander.

<a id="dish-66"></a>

### #66 Masoor dal

**File:** `data/dishes/masoor-dal.md`. **SHA-256:** `d80a8ffd02ffe92c35ac49501fede2f0bac3b0ac793ef57b81a4b5507a09ce81`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Masoor Dal; active Yes; preferred Yes; satiety Low; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Quick-cooking red masoor dal in a simple onion-tomato base.

**Ingredients for two:** Masoor Dal 100 g; Onion 80 g; Tomato 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cook the masoor dal with turmeric and salt until soft.
2. Saute onion, ginger, green chilli and tomato into a quick masala.
3. Stir the masala into the dal and simmer to the consistency you like.
4. Temper garlic and cumin in ghee, pour over, and finish with coriander.

<a id="dish-67"></a>

### #67 Toor dal

**File:** `data/dishes/toor-dal.md`. **SHA-256:** `d8cac0af0d1fdc2b91c7b4f3c6439aa27280cfc500776bf239738c316e9eeb6d`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Toor Dal; active Yes; preferred Yes; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Everyday toor dal simmered soft and finished with a simple tempering.

**Ingredients for two:** Toor Dal 100 g; Onion 50 g; Tomato 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook the toor dal with turmeric and salt till soft.
2. Saute onion, ginger, garlic, green chilli and tomato into a quick masala.
3. Stir the masala into the dal and simmer to the consistency you like.
4. Temper cumin and garlic in ghee and pour over.
5. Finish with coriander.

<a id="dish-68"></a>

### #68 Chana dal

**File:** `data/dishes/chana-dal.md`. **SHA-256:** `a4ecdd8a2ddedc5eb5dbcb570245a4d3ac9b58d272529f8a65bea76844836043`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Chana Dal; active Yes; preferred Yes; satiety Medium; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Nutty chana dal cooked soft and finished with a garlic tempering.

**Ingredients for two:** Chana Dal 100 g; Onion 80 g; Tomato 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soak the chana dal 30 minutes, then pressure cook with turmeric and salt until soft.
2. Saute onion, ginger, green chilli and tomato into a quick masala.
3. Stir the masala into the dal and simmer to the consistency you like.
4. Temper garlic and cumin in ghee and pour over, finish with coriander.

<a id="dish-69"></a>

### #69 Aloo matar

**File:** `data/dishes/aloo-matar.md`. **SHA-256:** `7c041e69e026bf7138838913dc661836666eaf30e0ad40c148b0845dc6318a58`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Potato; active Yes; preferred Yes; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Potato and green peas simmered in a light onion-tomato gravy.

**Ingredients for two:** Potato 200 g; Green Pea 100 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger and green chilli, then add tomato and cook down.
2. Add turmeric, chilli and salt, cook till the oil separates.
3. Add cubed potato and peas with a little water.
4. Cover and simmer till the potato is tender and the gravy thickens.
5. Finish with coriander.

<a id="dish-70"></a>

### #70 Aloo beans

**File:** `data/dishes/aloo-beans.md`. **SHA-256:** `37769a572a23bd461852d6799d10fe79291f54032df262e9b3538338765a7b8c`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Potato; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** French beans and potato stir-fried with onion and a light spicing.

**Ingredients for two:** Potato 150 g; French Bean 200 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Chop the beans fine and dice the potato small for even cooking.
2. Saute onion, ginger and green chilli, then add tomato.
3. Add the beans and potato with turmeric, chilli and salt.
4. Cover and cook on low till tender, stirring occasionally.

<a id="dish-72"></a>

### #72 Lauki chana dal

**File:** `data/dishes/lauki-chana-dal.md`. **SHA-256:** `35d1ae69cf0ffd9899928b11ba5e0adeaf7d775bb3e027ddad5a99152255747f`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Bottle Gourd; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons ['Summer', 'Monsoon']; cuisine Indian.

**Description:** Bottle gourd simmered with chana dal in a light onion-tomato gravy.

**Ingredients for two:** Bottle Gourd 200 g; Chana Dal 50 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soak the chana dal 30 minutes.
2. Saute onion, ginger, garlic and green chilli, then add tomato and spices.
3. Add diced bottle gourd and the drained dal with turmeric and salt.
4. Add water, pressure cook until the dal is soft and the gourd is tender.
5. Finish with coriander.

<a id="dish-73"></a>

### #73 Tinda masala

**File:** `data/dishes/tinda-masala.md`. **SHA-256:** `349df60650e3dcae854ac40e1323e5e024a47979da4be7c0eef6c2fb5b1530ed`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Tinda; active Yes; preferred No; satiety Low; active prep 25 minutes; seasons ['Summer', 'Monsoon']; cuisine Indian.

**Description:** Apple gourd cooked down in a homely onion-tomato masala.

**Ingredients for two:** Tinda 250 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel and dice the tinda into small cubes.
2. Saute onion, ginger, garlic and green chilli, add tomato and ground spices.
3. Cook the masala till the oil separates.
4. Add the tinda with a splash of water, cover and cook till soft.
5. Finish with garam masala and coriander.

<a id="dish-74"></a>

### #74 Turai sabzi

**File:** `data/dishes/turai-sabzi.md`. **SHA-256:** `c7b78cb7596f2f2504ebe86cacc1b7223dbe6487e8bbdbd0227d1d150c340d64`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Ridge Gourd; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons ['Summer', 'Monsoon']; cuisine Indian.

**Description:** Ridge gourd cooked down soft in a light onion-tomato masala.

**Ingredients for two:** Ridge Gourd 250 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel and dice the ridge gourd.
2. Saute onion, ginger, garlic and green chilli, then add tomato and spices.
3. Add the ridge gourd, which releases its own water as it cooks.
4. Cover and cook till soft, then uncover to dry off excess moisture.
5. Season and serve.

<a id="dish-75"></a>

### #75 Soyabean curry (inactive)

**File:** `data/dishes/soyabean-curry.md`. **SHA-256:** `9cedddb39e86e546de23310b57b36337872a34db17bae4a73b7383327718d19a`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Soyabean Chunk; active No; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Protein-rich soya chunks simmered in a spiced onion-tomato gravy.

**Ingredients for two:** Soyabean Chunk 100 g; Onion 100 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** Soak the soya chunks in hot water till they swell, then squeeze dry. **Purchase note:** None recorded.

**Recipe:**

1. Soak the soya chunks in hot water, then squeeze out the water.
2. Saute onion, ginger, garlic and green chilli, add tomato and ground spices.
3. Cook the masala till the oil separates, then add a little water for gravy.
4. Add the soya chunks, cover and simmer till they soak up the masala.
5. Finish with garam masala and coriander.

<a id="dish-76"></a>

### #76 Soya chunks masala

**File:** `data/dishes/soya-chunks-masala.md`. **SHA-256:** `320e057226236bb6e6df899c81f0dca182b31f0a37eb571ba988547fc2689d79`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Soyabean Chunk; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Protein-rich soya chunks simmered with capsicum in an onion-tomato masala.

**Ingredients for two:** Soyabean Chunk 100 g; Onion 100 g; Tomato 100 g; Capsicum 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** Soak the soya chunks in hot water, then squeeze dry. **Purchase note:** None recorded.

**Recipe:**

1. Soak the soya chunks in hot salted water, then squeeze out the water.
2. Saute onion, ginger, garlic and green chilli, add tomato and spices.
3. Cook the masala till the oil separates, then add capsicum.
4. Add the soya chunks with a little water and simmer till they soak up the gravy.
5. Finish with garam masala and coriander.

<a id="dish-77"></a>

### #77 Fish fry

**File:** `data/dishes/fish-fry.md`. **SHA-256:** `a1c4f7a8b4ccf0a481186a618dd012cfd714eeac6bfacad31f6bde3526919bfd`.

**Menu:** Dry dish; Lunch; tags HP, cuisine_neutral; primaryIngredient Fish; active Yes; preferred Yes; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Spice-marinated fish shallow fried till crisp at the edges.

**Ingredients for two:** Fish 300 g; Onion 50 g; Ginger 10 g; Garlic 10 g; Lemon 1 pcs.

**Pre-prep:** Marinate the fish for at least 20 minutes. **Purchase note:** Fish fillets or steaks, 300g.

**Recipe:**

1. Marinate the fish in ginger garlic paste, turmeric, chilli, salt and lemon.
2. Dust lightly with rice flour or semolina for crispness.
3. Shallow fry on medium heat until golden on both sides.
4. Serve hot with sliced onion and lemon wedges.

<a id="dish-78"></a>

### #78 Prawn stir fry

**File:** `data/dishes/prawn-stir-fry.md`. **SHA-256:** `5b1f436b0259b88df96747bae93b1d955a4791c966f54be04d29b37d912b13c1`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Prawn; active Yes; preferred No; satiety High; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Prawns tossed fast with capsicum and onion in a garlicky masala.

**Ingredients for two:** Prawn 300 g; Capsicum 50 g; Onion 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** Cleaned prawns, 300g.

**Recipe:**

1. Saute garlic, ginger and green chilli in hot oil.
2. Add the onion and capsicum, toss till they start to soften.
3. Add the cleaned prawns and stir-fry on high heat.
4. Cook just till the prawns turn pink and curl; do not overcook.
5. Season and serve immediately.

<a id="dish-79"></a>

### #79 Jeera rice

**File:** `data/dishes/jeera-rice.md`. **SHA-256:** `ce68830f7601c9d0e60f5745dae066b1f69dd0c9a5cd16f02e17df427e349969`.

**Menu:** Rice; Lunch; tags none; primaryIngredient Rice; active Yes; preferred Yes; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Fluffy basmati rice tempered with cumin and a slit green chilli.

**Ingredients for two:** Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Rinse and soak basmati rice for 15 minutes, then drain.
3. Temper cumin seeds and a slit green chilli in ghee until fragrant.
4. Add the rice with measured water and salt, bring to a boil.
5. Cover and cook on low until the water is absorbed, then fluff.

<a id="dish-80"></a>

### #80 Peas pulao

**File:** `data/dishes/peas-pulao.md`. **SHA-256:** `81be42d9b0380e8f6115a5d169903731ad06ddff4cc66b799329e308e26edf77`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Green Pea; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Fragrant basmati rice cooked with green peas and whole spices.

**Ingredients for two:** Green Pea 80 g; Onion 50 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Mint Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Rinse and soak basmati rice for 15 minutes, then drain.
3. Saute whole spices, onion, ginger and green chilli in ghee.
4. Add the peas and rice, toss to coat.
5. Pour in measured water with salt, bring to a boil, then cover and cook on low.
6. Fluff and finish with mint and coriander.

<a id="dish-81"></a>

### #81 Veg pulao

**File:** `data/dishes/veg-pulao.md`. **SHA-256:** `15ed9751bda5d5181d31e65f09b3145af6f64ed6b162eccd2eaf2d79de94a6e4`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Mixed Veg; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Fragrant basmati rice cooked with mixed vegetables and whole spices.

**Ingredients for two:** Carrot 50 g; Green Pea 50 g; French Bean 50 g; Capsicum 30 g; Onion 80 g; Ginger 10 g; Green Chilli 1 pcs; Mint Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Temper whole spices in ghee, then saute onion, ginger and green chilli.
3. Add the diced vegetables and toss for a couple of minutes.
4. Add soaked, drained basmati rice and stir gently to coat.
5. Pour in measured water with salt, cover and cook till the rice is done.
6. Rest, then fluff with mint and coriander.

<a id="dish-82"></a>

### #82 Vegetable upma

**File:** `data/dishes/vegetable-upma.md`. **SHA-256:** `76b44e97bc26613f943f13015c9ad3483ef49bc1f33514a3b7b10f5f9eda6f35`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Semolina; active Yes; preferred No; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Roasted semolina cooked with vegetables and a curry-leaf tempering.

**Ingredients for two:** Semolina 150 g; Onion 80 g; Tomato 50 g; Carrot 30 g; Green Pea 30 g; Green Chilli 2 pcs; Curry Leaf 5 g; Coriander Leaf 10 g; Ginger 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dry roast the semolina until fragrant, then set aside.
2. Temper mustard seeds, curry leaves, green chilli and ginger in oil.
3. Add onion, carrot, peas and tomato, saute till softened.
4. Pour in hot water with salt, then rain in the semolina, stirring to avoid lumps.
5. Cover and cook till fluffy, finish with coriander.

<a id="dish-85"></a>

### #85 Paneer sandwich

**File:** `data/dishes/paneer-sandwich.md`. **SHA-256:** `b877caba1412bfcccb491e56e564b977b1ffb3ff140ccc025c933d181f6856c3`.

**Menu:** Complete meal; Breakfast; tags HP, complete_meal; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Toasted sandwiches filled with spiced paneer, onion and capsicum.

**Ingredients for two:** Bread 4 pcs; Paneer 100 g; Onion 30 g; Capsicum 30 g; Tomato 30 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Crumble paneer and mix with chopped onion, capsicum, tomato, coriander, salt and chaat masala.
2. Spread the filling over two bread slices and top with the others.
3. Toast in a sandwich press or on a buttered tawa until golden.
4. Cut and serve hot with chutney.

<a id="dish-86"></a>

### #86 Veg sandwich

**File:** `data/dishes/veg-sandwich.md`. **SHA-256:** `ca6c840394aa5434981fa566e9ec69ac31c9117dc7a66a361f5abbad2575568c`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Mixed Veg; active Yes; preferred No; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Layered vegetable sandwich with cucumber, tomato and a green chutney spread.

**Ingredients for two:** Bread 4 pcs; Cucumber 40 g; Tomato 40 g; Onion 30 g; Lettuce 20 g; Coriander Leaf 10 g; Green Chilli 1 pcs; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Blend coriander with green chilli and lemon into a quick chutney.
2. Spread the chutney on the bread slices.
3. Layer cucumber, tomato, onion and lettuce, season with salt and pepper.
4. Close, press, and grill or toast until crisp, then halve.

<a id="dish-87"></a>

### #87 Grilled cheese sandwich

**File:** `data/dishes/grilled-cheese-sandwich.md`. **SHA-256:** `a539821432a2b5c0bf947efb648ae7bd7bf11c771759517a5184b23dd235e9cf`.

**Menu:** Complete meal; Breakfast; tags complete_meal; primaryIngredient Cheese; active Yes; preferred Yes; satiety Medium; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** Bread and cheese griddled until golden and molten.

**Ingredients for two:** Bread 4 pcs; Cheese 80 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Butter the outer faces of the bread.
2. Layer cheese between two slices, buttered sides out.
3. Griddle on low heat, pressing, until golden and the cheese melts.
4. Cut on the diagonal and serve hot.

<a id="dish-90"></a>

### #90 Thepla

**File:** `data/dishes/thepla.md`. **SHA-256:** `1f357bd37be7540a241c630d499796aed860e97e391aa101fd1f96470c106708`.

**Menu:** Paratha; Breakfast; tags none; primaryIngredient Fenugreek Leaf; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Soft Gujarati flatbreads kneaded with fenugreek, curd and spices.

**Ingredients for two:** Fenugreek Leaf 100 g; Curd 50 g; Ginger 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For six small theplas (two portions), use 160 g whole-wheat atta with the listed curd and fenugreek; add 40 ml water first and up to 30 ml more as the greens release moisture.
2. Mix wheat flour with chopped fenugreek, ginger, green chilli, turmeric and salt.
3. Knead a soft dough with curd and a little oil, rest 10 minutes.
4. Roll out thin rounds and cook on a hot tawa with oil.
5. Press lightly so each thepla cooks through and lightly browns.

<a id="dish-91"></a>

### #91 Methi paratha

**File:** `data/dishes/methi-paratha.md`. **SHA-256:** `7d3496c4319f3ff28a49b298fc6e0b70382c2be7f1c2b414fdbe793fb1b5f6dc`.

**Menu:** Paratha; Breakfast; tags complete_carb; primaryIngredient Fenugreek Leaf; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Wheat parathas kneaded with chopped fenugreek leaves and spices, griddled till golden.

**Ingredients for two:** Fenugreek Leaf 100 g; Potato 100 g; Onion 50 g; Ginger 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four parathas (two portions), use 160 g whole-wheat atta with the listed potato and fenugreek; add 60 ml water first and up to 30 ml more as needed.
2. Wash and finely chop the methi, then squeeze out excess water.
3. Knead a wheat dough with the methi, mashed potato, ginger, green chilli, spices and salt.
4. Rest the dough 10 minutes, then roll out into parathas.
5. Griddle on a hot tawa with ghee until golden on both sides.

<a id="dish-94"></a>

### #94 Veg biryani

**File:** `data/dishes/veg-biryani.md`. **SHA-256:** `ee1769d7368fa62a98b7d2f564b0dd7b7ab1dd58b8f2a9f4797198439ec56170`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Mixed Veg; active Yes; preferred Yes; satiety High; active prep 50 minutes; seasons All; cuisine Indian.

**Description:** Layered basmati rice and spiced mixed vegetables slow-cooked on dum.

**Ingredients for two:** Carrot 50 g; Green Pea 50 g; Potato 80 g; French Bean 30 g; Onion 150 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed.
2. Fry sliced onion till golden and set aside.
3. Cook the vegetables with ginger, garlic, tomato and biryani spices till just tender.
4. Parboil soaked basmati rice with whole spices and salt, drain at 70 percent done.
5. Layer rice over the vegetables with mint, coriander and fried onions.
6. Cover tight and cook on dum on low heat 20 minutes, then rest before fluffing.

<a id="dish-95"></a>

### #95 Chicken biryani

**File:** `data/dishes/chicken-biryani.md`. **SHA-256:** `cfc23782ea0bad07d2f9a0cc0c6a0527330e8d007cc6afaa713b2cb164c2ab28`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Chicken; active Yes; preferred Yes; satiety High; active prep 60 minutes; seasons All; cuisine Indian.

**Description:** Layered basmati rice and marinated chicken slow-cooked on dum with fried onions.

**Ingredients for two:** Chicken 300 g; Onion 150 g; Tomato 100 g; Curd 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g.

**Pre-prep:** Marinate the chicken in curd and spices for at least an hour. **Purchase note:** Curry cut chicken, 300g.

**Recipe:**

1. For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed.
2. Marinate the chicken in curd, ginger garlic paste, chilli and biryani spices.
3. Fry sliced onion till golden, then cook the marinated chicken with tomato till tender.
4. Parboil soaked basmati rice with whole spices and salt, drain at 70 percent done.
5. Layer rice over the chicken with mint, coriander and fried onions.
6. Cover tight and cook on dum on low heat 20 minutes, then rest before fluffing.

<a id="dish-96"></a>

### #96 Egg biryani

**File:** `data/dishes/egg-biryani.md`. **SHA-256:** `e9a6f7e38fd4e4e5b3e0ae48cd137cdb26a4a9d05f2f27b468198423056e30aa`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Egg; active Yes; preferred Yes; satiety High; active prep 45 minutes; seasons All; cuisine Indian.

**Description:** A fragrant layered rice biryani with masala-coated boiled eggs.

**Ingredients for two:** Egg 4 pcs; Onion 150 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed.
2. Boil the eggs, halve them and fry lightly with turmeric and chilli.
3. Parboil basmati rice with whole spices and drain at three-quarters done.
4. Brown the onions, add ginger garlic, tomato, mint and biryani masala.
5. Layer the masala, eggs and rice, scatter mint and coriander, and cook on dum.
6. Rest covered, then fold gently before serving.

<a id="dish-98"></a>

### #98 Pav bhaji

**File:** `data/dishes/pav-bhaji.md`. **SHA-256:** `68f917c3976bfcc0bca750a2b36d4c0773b66b4409a4c246dfc173a6df34bd7a`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Mixed Veg; active Yes; preferred Yes; satiety High; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** Spiced mashed vegetables served with butter-toasted pav.

**Ingredients for two:** Potato 200 g; Cauliflower 100 g; Capsicum 80 g; Green Pea 50 g; Onion 150 g; Tomato 200 g; Ginger 10 g; Garlic 10 g; Coriander Leaf 10 g; Pav Bread 4 pcs; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** Pav bread, one packet.

**Recipe:**

1. Boil and mash the potato, cauliflower and peas together.
2. Saute onion, ginger and garlic, add tomato and pav bhaji masala, cook down.
3. Add the diced capsicum, then the mashed vegetables and a little water.
4. Simmer, mashing further, till thick; finish with butter.
5. Toast the pav in butter and serve hot with chopped onion and lemon.

<a id="dish-99"></a>

### #99 Rajma chawal

**File:** `data/dishes/rajma-chawal.md`. **SHA-256:** `6c0c7a111ffdf973079124ecb661ce3a1f1a4ebf5aea1e4f8ca2e45ad4bc121a`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Kidney Bean; active Yes; preferred Yes; satiety High; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** Comforting kidney bean curry in an onion-tomato gravy, served over rice.

**Ingredients for two:** Kidney Bean 150 g; Onion 100 g; Tomato 150 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** Soak the kidney beans overnight. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Pressure cook the soaked kidney beans with salt until soft.
3. Brown onion, then add ginger garlic paste and tomato puree.
4. Cook the masala with spices till the oil separates.
5. Add the beans with their water and simmer 15 minutes.
6. Finish with coriander and serve over steamed rice.

<a id="dish-100"></a>

### #100 Dal makhani

**File:** `data/dishes/dal-makhani.md`. **SHA-256:** `29eb934fc393902f82ae0d45c4300ed300aca60c11281d07f62b354ebe5cf939`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Black Urad; active Yes; preferred Yes; satiety High; active prep 50 minutes; seasons All; cuisine Indian.

**Description:** Black urad and kidney beans slow-simmered with butter and cream into a rich dal.

**Ingredients for two:** Black Urad Dal 100 g; Kidney Bean 30 g; Onion 80 g; Tomato 100 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** Soak the urad dal and kidney beans overnight. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook the soaked urad and kidney beans with salt until very soft.
2. Saute onion, ginger, garlic and green chilli, add tomato and spices.
3. Add the cooked dal with its water and simmer long on low heat.
4. Stir in butter and a little cream, mashing some beans to thicken.
5. Finish with kasuri methi and coriander.

<a id="dish-101"></a>

### #101 Malai kofta

**File:** `data/dishes/malai-kofta.md`. **SHA-256:** `cf6c8045aa7417476d9ea2c9196a41f9df294b4d21650acd9fa7139a0d3fd689`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 45 minutes; seasons All; cuisine Indian.

**Description:** Soft paneer and potato koftas in a rich cashew-tomato gravy.

**Ingredients for two:** Paneer 150 g; Potato 100 g; Onion 100 g; Tomato 100 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Cornflour 15 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Mash paneer and boiled potato, bind with a little cornflour, shape into koftas.
2. Deep-fry the koftas until golden and set aside.
3. Saute onion, ginger, garlic and soaked cashews, add tomato and cook down, then blend smooth.
4. Simmer the puree with spices and a little cream into a glossy gravy.
5. Add the koftas just before serving and finish with coriander.

<a id="dish-102"></a>

### #102 Paneer lababdar

**File:** `data/dishes/paneer-lababdar.md`. **SHA-256:** `cd76b7edfd93edfb69ee50feb8c2fe05472c83b75b1ca34a151bc9710b974019`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Paneer in a creamy tomato-cashew gravy with a tangy, spiced edge.

**Ingredients for two:** Paneer 200 g; Onion 100 g; Tomato 150 g; Cashew 30 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Simmer onion, tomato, cashew, ginger and garlic till soft, then blend smooth.
2. Cook the puree with ground spices till thick and glossy.
3. Add a splash of water and simmer to a rich gravy.
4. Fold in the paneer cubes, some grated paneer and a little cream.
5. Finish with crushed kasuri methi and coriander.

<a id="dish-103"></a>

### #103 Roti

**File:** `data/dishes/roti.md`. **SHA-256:** `5af59f844b3fe5701b3db6ecb686282204df6478b6ed23caf6241832af7e9867`.

**Menu:** Chapati; Lunch; tags none; primaryIngredient Wheat Flour; active Yes; preferred Yes; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Soft everyday wheat flatbreads, the default lunch carb.

**Ingredients for two:** Empty table (pantry-only dish).

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For six small rotis (two portions), use 180 g whole-wheat atta and 110 ml water, adding up to 15 ml more for a soft dough.
2. Knead wheat flour with water and a little oil into a soft dough, rest 15 minutes.
3. Divide, roll each ball into a thin round.
4. Cook on a hot tawa, flipping once bubbles appear.
5. Puff on an open flame and brush with ghee.

<a id="dish-104"></a>

### #104 Chicken breast

**File:** `data/dishes/chicken-breast.md`. **SHA-256:** `ba98425d9f2f9c8c9d83f31443f888d366597f81aa9f46205f3f3d6439ee71fb`.

**Menu:** Keto; Lunch; tags HP, cuisine_neutral; primaryIngredient Chicken Breast; active Yes; preferred Yes; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** A simple pan-seared chicken breast seasoned with pepper and lemon.

**Ingredients for two:** Chicken Breast 300 g; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken breast, 300g.

**Recipe:**

1. Flatten the breast slightly and pat dry, then season with salt and pepper.
2. Sear in a hot oiled pan until golden on both sides.
3. Lower the heat and cook through, then rest a couple of minutes off the heat.
4. Finish with a squeeze of lemon and slice to serve.

<a id="dish-106"></a>

### #106 Paneer bhurji

**File:** `data/dishes/paneer-bhurji-106.md`. **SHA-256:** `5423b9d914861d70076b86d6f42a4ee9d30b47bb866edec5a3cac2b65755be43`.

**Menu:** Dry dish; Breakfast; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Crumbled paneer scrambled with onion, tomato and spices, a quick breakfast.

**Ingredients for two:** Paneer 200 g; Onion 80 g; Ginger 10 g; Green Chilli 1 pcs; Tomato 80 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger and green chilli in oil until soft.
2. Add tomato with turmeric, chilli and salt, cook till pulpy.
3. Crumble in the paneer and toss to coat in the masala.
4. Warm through, finish with garam masala and coriander.

<a id="dish-108"></a>

### #108 Plain paratha

**File:** `data/dishes/plain-paratha.md`. **SHA-256:** `826a955c5f3f860c30d40db9e34ff1fbf870e023ff289d0687f51a3308f10c8b`.

**Menu:** Paratha; Breakfast; tags none; primaryIngredient Wheat Flour; active Yes; preferred Yes; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Flaky layered wheat paratha griddled with ghee.

**Ingredients for two:** Empty table (pantry-only dish).

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four parathas (two portions), use 160 g whole-wheat atta and 95 ml water, adding up to 15 ml more for a soft dough.
2. Knead a soft wheat dough with a little oil and salt, rest 10 minutes.
3. Roll out a ball, smear with ghee, fold into layers and roll again.
4. Griddle on a hot tawa, brushing ghee, until golden and flaky on both sides.

<a id="dish-109"></a>

### #109 Toast

**File:** `data/dishes/toast.md`. **SHA-256:** `71292a4b05c97c078aae184e4cb3b54eb1865d0aa3bac6904254c0ba839c833a`.

**Menu:** Bread; Breakfast; tags none; primaryIngredient Bread; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Plain buttered toast, the simplest side for eggs or chai.

**Ingredients for two:** Bread 4 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Toast the bread slices until golden on both sides.
2. Spread with butter while still warm and serve at once.

<a id="dish-110"></a>

### #110 Mint chutney

**File:** `data/dishes/mint-chutney.md`. **SHA-256:** `4a91b484ac72ee70413575719d9d50802dc931ccea7db720b38ca1a60ee92ec6`.

**Menu:** Accompaniment; Breakfast; tags none; primaryIngredient Mint Leaf; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Bright green mint and coriander chutney for parathas and snacks.

**Ingredients for two:** Mint Leaf 20 g; Coriander Leaf 30 g; Green Chilli 1 pcs; Ginger 5 g; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two dipping portions, use the listed herbs and 20 ml water to start; add up to another 20 ml only if needed.
2. Blend mint, coriander, green chilli, ginger and a little water to a paste.
3. Add lemon juice, salt and a pinch of sugar, blend again.
4. Loosen with water to a dipping consistency and chill until serving.

<a id="dish-111"></a>

### #111 Garlic chutney

**File:** `data/dishes/garlic-chutney.md`. **SHA-256:** `40f7af7c14eff58b35f33344612c3fefac48381d10915fbdbabe6e3949965f06`.

**Menu:** Accompaniment; Breakfast; tags none; primaryIngredient Garlic; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** A fiery dry garlic and red chilli chutney for dosa and idli.

**Ingredients for two:** Garlic 30 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two small condiment portions, use 30 g peeled garlic, 2 g dried red chillies and 5 ml oil; add only a pinch of salt.
2. Dry-roast garlic cloves and red chillies until fragrant.
3. Grind with salt and a little oil to a coarse, dry chutney.
4. Loosen with a few drops of water only if needed.

<a id="dish-112"></a>

### #112 Peanut chutney

**File:** `data/dishes/peanut-chutney.md`. **SHA-256:** `b84a7294baddf9365b346408de74dfc14a4fb0f3895af16de406eec6502ddf58`.

**Menu:** Accompaniment; Breakfast; tags none; primaryIngredient Peanut; active Yes; preferred Yes; satiety Low; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** A roasted peanut chutney with a curry-leaf tempering, for breakfast.

**Ingredients for two:** Peanut 40 g; Green Chilli 1 pcs; Garlic 5 g; Curry Leaf 3 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. This batch makes two condiment portions; start blending with 30 ml water and add up to 20 ml more if needed.
2. Dry-roast the peanuts till fragrant, then rub off the skins.
3. Blend with green chilli, garlic, 5 g seedless dried tamarind soaked in 20 ml hot water, with any fibres removed and salt to a coarse paste.
4. Loosen with water to a dipping consistency.
5. Temper mustard seeds and curry leaves in oil and pour over.

<a id="dish-113"></a>

### #113 Grilled chicken breast

**File:** `data/dishes/grilled-chicken-breast.md`. **SHA-256:** `59871c9e9935831f8b2314c4c767c7dd7de5062b934be6eaf0652c6cf92d2708`.

**Menu:** Keto; Lunch; tags HP, cuisine_neutral; primaryIngredient Chicken Breast; active Yes; preferred Yes; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Lemon and garlic marinated chicken breast, grilled till juicy.

**Ingredients for two:** Chicken Breast 300 g; Lemon 1 pcs; Garlic 10 g; Ginger 10 g.

**Pre-prep:** Marinate the chicken for at least 30 minutes. **Purchase note:** Boneless chicken breast, 300g.

**Recipe:**

1. Flatten the chicken breast slightly for even cooking.
2. Marinate with lemon juice, ginger garlic paste, salt, pepper and oil.
3. Grill on a hot pan 5 to 6 minutes a side until cooked through.
4. Rest a few minutes, then slice and serve.

<a id="dish-117"></a>

### #117 Chicken tikka

**File:** `data/dishes/chicken-tikka.md`. **SHA-256:** `d97db62de78b7fee1370661ce26a1d7c176d2f7a72bfb0806de2e3bc75d0b886`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Curd and spice marinated chicken grilled with onion and capsicum.

**Ingredients for two:** Chicken 300 g; Curd 80 g; Capsicum 50 g; Onion 50 g; Ginger 10 g; Garlic 10 g; Lemon 1 pcs.

**Pre-prep:** Marinate the chicken in spiced curd for at least an hour. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. Cut the chicken into chunks and the onion and capsicum into squares.
2. Marinate the chicken in curd, ginger garlic paste, tikka spices, lemon and salt.
3. Thread or scatter on a hot grill pan with the onion and capsicum.
4. Grill, turning, until charred at the edges and cooked through.
5. Finish with a squeeze of lemon and chaat masala.

<a id="dish-118"></a>

### #118 Fish tikka

**File:** `data/dishes/fish-tikka.md`. **SHA-256:** `e8c2712bde9ae22e73a67fde27403cef454b9d51d141a0109dab3cd6977880d5`.

**Menu:** Keto; Lunch; tags HP, cuisine_neutral; primaryIngredient Fish; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Curd-marinated fish cubes grilled until charred at the edges.

**Ingredients for two:** Fish 300 g; Curd 50 g; Ginger 10 g; Garlic 10 g; Lemon 1 pcs.

**Pre-prep:** Marinate the fish for at least an hour ahead. **Purchase note:** Firm boneless fish fillets, 300g.

**Recipe:**

1. Cube the fish and marinate in curd, ginger garlic, lemon, salt and tikka spices.
2. Thread onto skewers or spread on a lined tray.
3. Grill or pan-sear on high heat, turning, until charred and just cooked.
4. Finish with a squeeze of lemon.

<a id="dish-120"></a>

### #120 Pepper chicken dry

**File:** `data/dishes/pepper-chicken-dry.md`. **SHA-256:** `6a916393cac0b86d38f82b81cb88f511565427e6b40bf447807b83e2470492d8`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Boneless chicken tossed dry with a heavy hit of crushed black pepper.

**Ingredients for two:** Chicken 300 g; Onion 80 g; Capsicum 50 g; Ginger 10 g; Garlic 10 g; Curry Leaf 5 g; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. Cut the chicken into bite-size pieces.
2. Saute ginger, garlic and onion, then add the chicken and sear.
3. Add the capsicum and plenty of coarsely crushed black pepper.
4. Toss on high heat till the chicken is cooked through and dry-coated.
5. Finish with curry leaves and a squeeze of lemon.

<a id="dish-121"></a>

### #121 Chilli paneer dry

**File:** `data/dishes/chilli-paneer-dry.md`. **SHA-256:** `83b1185cfd16c6d5f99eec4c19ad8fbe05ca884dc96f2d03b2848f2868081224`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Indo-Chinese paneer tossed dry with capsicum, onion and a garlicky chilli sauce.

**Ingredients for two:** Paneer 250 g; Capsicum 100 g; Onion 80 g; Garlic 10 g; Green Chilli 3 pcs; Cornflour 20 g; Soy Sauce 15 ml; Chilli Sauce 15 g; White Vinegar 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.
2. Cube the paneer and toss in cornflour, then shallow fry till golden, set aside.
3. On high heat, saute garlic, green chilli, onion and capsicum squares.
4. Add soy sauce, chilli sauce and a little white vinegar.
5. Return the paneer and toss to coat in the dry sauce.
6. Serve hot, scattered with spring onion if you have it.

<a id="dish-123"></a>

### #123 Seasonal fruit (inactive)

**File:** `data/dishes/seasonal-fruit.md`. **SHA-256:** `64c1bfa5b2101289791aa3291a33b24f29c60acb61c7b3a85bb9ef45a8e6e28e`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Fruit; active No; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Whatever fruit is in season that week, washed and cut to eat alongside breakfast.

**Ingredients for two:** Fruit 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pick the freshest fruit in season and rinse well.
2. Peel if needed and cut into bite-size pieces to serve.

<a id="dish-124"></a>

### #124 Chicken breast salad

**File:** `data/dishes/chicken-breast-salad.md`. **SHA-256:** `1b82947036aa7146929191ee60487bd80d3bf11023949c6cbcac723933c58070`.

**Menu:** Accompaniment; Lunch; tags HP; primaryIngredient Chicken Breast; active Yes; preferred Yes; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Grilled chicken breast sliced over crisp salad leaves with a lemon dressing.

**Ingredients for two:** Chicken Breast 200 g; Lettuce 50 g; Cucumber 80 g; Tomato 80 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken breast, 200g.

**Recipe:**

1. Season the chicken breast and grill until cooked through, then rest.
2. Toss lettuce, cucumber, tomato and onion in a bowl.
3. Slice the chicken and lay it over the salad.
4. Dress with lemon juice, olive oil, salt, pepper and coriander.

<a id="dish-125"></a>

### #125 Keema paratha (inactive)

**File:** `data/dishes/keema-paratha.md`. **SHA-256:** `195e8d7a5bf8d07dd9c53b746a1c4055def2b2a286438c07094e7ca23de03e8c`.

**Menu:** Paratha; Breakfast; tags HP, complete_carb; primaryIngredient Chicken Keema; active No; preferred Yes; satiety High; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Whole-wheat parathas stuffed with spiced chicken keema.

**Ingredients for two:** Chicken Keema 150 g; Onion 50 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; cool the cooked keema before filling.
2. Cook the keema with onion, ginger, green chilli and spices until dry, then cool.
3. Roll a ball of atta dough, place the filling, seal and roll out gently.
4. Cook on a hot tawa with ghee until golden on both sides.
5. Serve hot with curd.

<a id="dish-126"></a>

### #126 Keema pulao

**File:** `data/dishes/keema-pulao.md`. **SHA-256:** `a9fadefe2fc90592bedc44ab1161898f0e57a987a97aec1e9624dc68d5765549`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Chicken Keema; active Yes; preferred Yes; satiety High; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** A one-pot rice pulao cooked with spiced chicken keema and peas.

**Ingredients for two:** Chicken Keema 200 g; Onion 100 g; Tomato 80 g; Green Pea 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Brown the onions with whole spices, then add ginger garlic and green chilli.
3. Add the keema and sear, then tomato, mint and ground spices, cook till dry.
4. Stir in soaked rice and peas, then add measured hot water and salt.
5. Cover and cook on low until the rice is done and the water is absorbed.
6. Rest, then fold through with coriander before serving.

<a id="dish-127"></a>

### #127 Egg salad

**File:** `data/dishes/egg-salad.md`. **SHA-256:** `a233e0ad1985562ff52fce5bfd9f7a3ae570851edd438d01d336fcbd204d8bf6`.

**Menu:** Accompaniment; Lunch; tags HP, cuisine_neutral; primaryIngredient Egg; active Yes; preferred Yes; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Boiled eggs tossed with crisp salad leaves and a lemon dressing.

**Ingredients for two:** Egg 3 pcs; Lettuce 50 g; Cucumber 50 g; Tomato 50 g; Onion 30 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the eggs, cool, and cut into quarters.
2. Chop the lettuce, cucumber, tomato and onion.
3. Toss the vegetables with lemon juice, coriander, salt and pepper.
4. Top with the eggs and serve.

<a id="dish-128"></a>

### #128 Paneer salad

**File:** `data/dishes/paneer-salad.md`. **SHA-256:** `49e80f5f3d5719e544a86665982372a395d7b5ac60ef8012f6772e6621028055`.

**Menu:** Accompaniment; Lunch; tags HP, cuisine_neutral; primaryIngredient Paneer; active Yes; preferred Yes; satiety Medium; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** A fresh salad of paneer cubes with lettuce, cucumber and tomato.

**Ingredients for two:** Paneer 100 g; Lettuce 50 g; Cucumber 50 g; Tomato 50 g; Onion 30 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Lightly pan-sear the paneer cubes till golden, or use them raw.
2. Tear the lettuce and dice the cucumber, tomato and onion.
3. Toss everything together in a bowl.
4. Dress with lemon juice, salt and pepper, finish with coriander.

<a id="dish-130"></a>

### #130 Suji halwa

**File:** `data/dishes/suji-halwa.md`. **SHA-256:** `88f5ca491041a800f498d73046134785117e9394fbe6f2166f3b6b8797357dbc`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Semolina; active Yes; preferred Yes; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Ghee-roasted semolina cooked into a soft sweet halwa with cashews and raisins.

**Ingredients for two:** Cashew 20 g; Raisin 15 g; Semolina 60 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two dessert portions, use 60 g semolina, 30 g ghee, 45 g sugar and 180 ml hot water with the listed nuts and raisins.
2. Roast the semolina in ghee on low heat until golden and fragrant.
3. Fry the cashews and raisins, set a few aside for garnish.
4. Pour in hot water carefully, stirring to avoid lumps.
5. Add sugar and cardamom, cook until thick and glossy.
6. Garnish with the reserved nuts and serve warm.

<a id="dish-131"></a>

### #131 Fruit custard

**File:** `data/dishes/fruit-custard.md`. **SHA-256:** `c7b7edc7c07d8ba0fdf0828e1d069e838db866f0cc70414f43c9ba7bd34786cf`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Milk; active Yes; preferred Yes; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Chilled vanilla custard folded with chopped seasonal fruit.

**Ingredients for two:** Milk 500 ml; Cornflour 25 g; Banana 1 pcs; Papaya 150 g.

**Pre-prep:** Make and chill the custard at least two hours before serving. **Purchase note:** None recorded.

**Recipe:**

1. Reserve 50 ml of the 500 ml milk and whisk it cold with 25 g cornflour until smooth.
2. Heat the remaining 450 ml milk with 30 g sugar, then whisk in the slurry and simmer, stirring, for 2 to 3 minutes until the starch cooks and the custard thickens.
3. Remove from the heat and stir in 2.5 ml vanilla extract from the pantry. Cool, then refrigerate for at least 2 hours.
4. Peel and dice the banana and cut 150 g peeled, deseeded papaya into small pieces.
5. Fold the fruit into the cold custard just before serving; divide into two bowls.

<a id="dish-132"></a>

### #132 Sewaiyan kheer

**File:** `data/dishes/sewaiyan-kheer.md`. **SHA-256:** `4b04bc314bae77100c69b562ea636d95c799bebeca109ec41b22dfd2444475bb`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Milk; active Yes; preferred Yes; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Thin rice vermicelli simmered in milk with cardamom, cashews and raisins.

**Ingredients for two:** Milk 500 ml; Cashew 20 g; Raisin 15 g; Rice Vermicelli 60 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two dessert portions, use the listed 60 g thin rice vermicelli and 500 ml milk with 30 g sugar and 10 g ghee.
2. Roast the thin rice vermicelli in a little ghee till golden, then fry the cashews and raisins.
3. Bring the milk to a boil and add the roasted thin rice vermicelli.
4. Simmer, stirring, till the thin rice vermicelli softens and the milk thickens.
5. Sweeten with sugar and flavour with cardamom.
6. Stir in the cashews and raisins and serve warm or chilled.

<a id="dish-133"></a>

### #133 Coriander chutney

**File:** `data/dishes/coriander-chutney.md`. **SHA-256:** `2bd173e39ced0da278dc046e730d3aa263b83cdd5df377dbbfff38643e3f445b`.

**Menu:** Accompaniment; Breakfast; tags none; primaryIngredient Coriander Leaf; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Fresh coriander and green chilli ground with lemon into a quick breakfast chutney.

**Ingredients for two:** Coriander Leaf 20 g; Green Chilli 2 pcs; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Blend coriander, green chilli and a little water to a coarse paste.
2. Add lemon juice, salt and a pinch of sugar, blend smooth.
3. Loosen with water to a dipping consistency and chill until serving.

<a id="dish-134"></a>

### #134 Vegetable korma

**File:** `data/dishes/vegetable-korma.md`. **SHA-256:** `5d52b01142e0a558208721775b81431ada3c0b6c73de12e69573973a328dd84a`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Mixed Veg; active Yes; preferred Yes; satiety Medium; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Mixed vegetables in a mild, creamy cashew and curd gravy.

**Ingredients for two:** Carrot 50 g; French Bean 50 g; Green Pea 50 g; Capsicum 30 g; Onion 100 g; Tomato 80 g; Cashew 30 g; Curd 50 g; Ginger 10 g; Garlic 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Mint Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Parboil the diced vegetables till just tender.
2. Blend onion, cashew, ginger, garlic and green chilli to a smooth paste.
3. Cook the paste in oil without browning, add tomato and mild spices.
4. Whisk in the curd off the heat, then add the vegetables and a little water.
5. Simmer gently to a creamy gravy and finish with mint and coriander.

<a id="dish-135"></a>

### #135 Mix veg sabzi

**File:** `data/dishes/mix-veg-sabzi.md`. **SHA-256:** `bd077bd1161ac11ba43a1ae0eb9902305b1e6d0c190b80961674c85fea75131c`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Mixed Veg; active Yes; preferred Yes; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** A dry stir-fry of mixed vegetables in a light onion-tomato masala.

**Ingredients for two:** Carrot 80 g; French Bean 80 g; Capsicum 50 g; Green Pea 50 g; Potato 80 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dice all the vegetables small so they cook evenly.
2. Saute onion, ginger and green chilli, then add tomato and ground spices.
3. Add the vegetables, the harder ones first, and cook covered till just tender.
4. Uncover and toss on high heat to dry off any moisture.
5. Finish with coriander.

<a id="dish-136"></a>

### #136 Lauki sabzi

**File:** `data/dishes/lauki-sabzi.md`. **SHA-256:** `72d2dfe99f1bf0619acdebe2cb8f6ca298711b820412fdd730c7e7e639119a72`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Bottle Gourd; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons ['Summer', 'Monsoon']; cuisine Indian.

**Description:** Diced bottle gourd cooked soft in a light onion-tomato masala.

**Ingredients for two:** Bottle Gourd 300 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Temper cumin, ginger and green chilli, then soften the onion.
2. Add tomato with turmeric and salt and cook into a quick masala.
3. Add the diced bottle gourd and a splash of water.
4. Cover and cook on low until soft, then finish with coriander.

<a id="dish-137"></a>

### #137 Tomato curry

**File:** `data/dishes/tomato-curry.md`. **SHA-256:** `1995a7d6039adddbce89942c8cab39c0fe16e754b63198797f404fe474e5fb31`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Tomato; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** A tangy, light tomato curry with a curry-leaf tempering, South Indian style.

**Ingredients for two:** Tomato 300 g; Onion 80 g; Garlic 10 g; Ginger 10 g; Green Chilli 2 pcs; Curry Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Temper mustard seeds, curry leaves and green chilli in oil.
2. Saute onion, ginger and garlic till soft.
3. Add the chopped tomato and ground spices, cook down till pulpy.
4. Add water and simmer to a light, tangy curry.
5. Finish with coriander.

<a id="dish-138"></a>

### #138 Karela fry

**File:** `data/dishes/karela-fry.md`. **SHA-256:** `b2dbacce44fd9e2d18be03299e474eb2b6d638201a883c22799911cac7929622`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Bitter Gourd; active Yes; preferred No; satiety Low; active prep 25 minutes; seasons ['Summer']; cuisine Indian.

**Description:** Thinly sliced bitter gourd fried crisp with onion.

**Ingredients for two:** Bitter Gourd 300 g; Onion 80 g; Green Chilli 1 pcs.

**Pre-prep:** Salt the sliced karela and rest to draw out bitterness. **Purchase note:** None recorded.

**Recipe:**

1. Slice the karela thin, rub with salt and turmeric, rest, then squeeze out the liquid.
2. Shallow-fry the slices until crisp and set aside.
3. Saute onion and green chilli, add spices.
4. Return the karela, toss to coat, and cook until dry and crisp.

<a id="dish-139"></a>

### #139 Carrot halwa

**File:** `data/dishes/carrot-halwa.md`. **SHA-256:** `5760c89a84a0114262fca08ed2bca0de5ad4e9a7781af36cce9c3911c8989bb1`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Carrot; active Yes; preferred Yes; satiety Medium; active prep 45 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Slow-cooked grated carrots reduced in milk with ghee, cashews and raisins.

**Ingredients for two:** Carrot 500 g; Milk 250 ml; Cashew 20 g; Raisin 15 g.

**Pre-prep:** None recorded. **Purchase note:** Red winter carrots, 500g.

**Recipe:**

1. For two dessert portions, use 40 g sugar and 25 g ghee with the listed 500 g carrot and 250 ml milk; reserve 5 g of the ghee for frying the nuts.
2. Grate the carrots and saute in ghee until the raw smell goes.
3. Add the milk and cook on medium, stirring, until it reduces.
4. Stir in sugar and cardamom, cook till thick and glossy.
5. Fold in cashews and raisins fried in ghee, and serve warm.

<a id="dish-140"></a>

### #140 Paneer tikka

**File:** `data/dishes/paneer-tikka.md`. **SHA-256:** `1efe91e4207ec3a4ce139c7e4f622dc43b7afb59ecf95fbfd557ca9abb6bb936`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Curd and spice marinated paneer grilled with onion and capsicum.

**Ingredients for two:** Paneer 250 g; Curd 80 g; Capsicum 80 g; Onion 60 g; Ginger 10 g; Garlic 10 g; Lemon 1 pcs.

**Pre-prep:** Marinate the paneer in spiced curd for at least an hour. **Purchase note:** Firm paneer block, 250g.

**Recipe:**

1. Cube the paneer and cut the onion and capsicum into squares.
2. Marinate the paneer in curd, ginger garlic paste, tikka spices, lemon and salt.
3. Thread or scatter on a hot grill pan with the onion and capsicum.
4. Grill, turning, until charred at the edges and the paneer is golden.
5. Finish with a squeeze of lemon and a pinch of chaat masala.

<a id="dish-141"></a>

### #141 Prawn pepper fry

**File:** `data/dishes/prawn-pepper-fry.md`. **SHA-256:** `5cb562b14b09950e4e7fcd53d33416efc19e9e70589c9e3d8c26f3e4b101c845`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Prawn; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** South Indian style prawns tossed dry with onion, curry leaf and crushed black pepper.

**Ingredients for two:** Prawn 300 g; Onion 80 g; Ginger 10 g; Garlic 10 g; Curry Leaf 5 g; Green Chilli 2 pcs; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** Cleaned medium prawns, 300g.

**Recipe:**

1. Marinate the prawns in turmeric, salt and a little lemon for ten minutes.
2. Saute ginger, garlic, green chilli and curry leaf in oil.
3. Add sliced onion and cook till soft, then add the prawns.
4. Toss on high heat with plenty of crushed black pepper till the prawns curl and cook through.
5. Finish with a squeeze of lemon and serve hot.

<a id="dish-142"></a>

### #142 Egg bhurji keto

**File:** `data/dishes/egg-bhurji-keto.md`. **SHA-256:** `14c4d98f9f74103e52b7af3317c86103eb30d798939f45908fe6ed6bbb1c493f`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Egg; active Yes; preferred No; satiety High; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Spiced scrambled eggs cooked dry with onion, tomato and green chilli, no carb on the side.

**Ingredients for two:** Egg 6 pcs; Onion 80 g; Tomato 80 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute onion, ginger and green chilli till the onion softens.
2. Add tomato with turmeric, chilli powder and salt, cook till pulpy.
3. Pour in the beaten eggs and scramble on medium heat.
4. Cook till just set and dry, then finish with coriander.

<a id="dish-143"></a>

### #143 Tandoori soya chunks (inactive)

**File:** `data/dishes/tandoori-soya-chunks.md`. **SHA-256:** `01ea59094945ae5ad228e90cfdffe187958c7395b7febd6f0206850d7d003932`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Soyabean Chunk; active No; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Protein-rich soya chunks marinated in spiced curd and grilled with onion and capsicum.

**Ingredients for two:** Soyabean Chunk 120 g; Curd 80 g; Capsicum 80 g; Onion 60 g; Ginger 10 g; Garlic 10 g; Lemon 1 pcs.

**Pre-prep:** Soak and squeeze the soya chunks, then marinate in spiced curd for half an hour. **Purchase note:** None recorded.

**Recipe:**

1. Boil the soya chunks, then squeeze out the water completely.
2. Marinate them in curd, ginger garlic paste, tandoori spices, lemon and salt.
3. Thread on a grill pan with onion and capsicum squares.
4. Grill, turning, until charred at the edges and heated through.
5. Finish with chaat masala and a squeeze of lemon.

<a id="dish-144"></a>

### #144 Shrikhand

**File:** `data/dishes/shrikhand.md`. **SHA-256:** `dda0cb4284d8c3ec3cbd0007a7509402c26584fa1cdabf0347f4e71d78b6abef`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Curd; active Yes; preferred Yes; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Thick hung-curd dessert sweetened and flavoured with cardamom and saffron.

**Ingredients for two:** Curd 500 g; Cashew 15 g; Milk 15 ml.

**Pre-prep:** Hang the curd in a muslin cloth for a few hours to drain. **Purchase note:** None recorded.

**Recipe:**

1. For this two-person batch, measure 50 g powdered sugar; use the listed 15 ml milk to soak the saffron before adding it to the curd.
2. Hang the curd in muslin until it firms into thick chakka.
3. Whisk the hung curd smooth with powdered sugar.
4. Stir in cardamom and saffron soaked in a little warm milk.
5. Chill and serve topped with slivered cashews.

<a id="dish-145"></a>

### #145 Aamras

**File:** `data/dishes/aamras.md`. **SHA-256:** `4136bfbe7bb4c38902f3ebd38e79763a8ce6a3a23b1a930fb0ca77222ddaaa47`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Mango; active Yes; preferred Yes; satiety Low; active prep 10 minutes; seasons ['Summer']; cuisine Indian.

**Description:** Smooth sweet mango pulp lightly spiced with cardamom, the summer dessert.

**Ingredients for two:** Mango 500 g; Milk 50 ml.

**Pre-prep:** None recorded. **Purchase note:** Ripe Alphonso or Banganapalli mangoes, 500g.

**Recipe:**

1. Peel the ripe mangoes and scoop out all the pulp.
2. Blend or mash the pulp smooth with a splash of milk.
3. Sweeten lightly only if the mangoes need it, and add a pinch of cardamom.
4. Chill and serve as is or with puri.

<a id="dish-146"></a>

### #146 Moong dal halwa

**File:** `data/dishes/moong-dal-halwa.md`. **SHA-256:** `7ed9e9a5ce4679b51cb542f2b35982ad9d47ba69ecdef7cf60791a41951fb036`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Moong Dal; active Yes; preferred No; satiety Medium; active prep 50 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Rich winter halwa of slow-roasted moong dal cooked in ghee with milk, cashews and raisins.

**Ingredients for two:** Moong Dal 150 g; Milk 250 ml; Cashew 20 g; Raisin 15 g.

**Pre-prep:** Soak the moong dal for a few hours, then grind to a coarse paste. **Purchase note:** None recorded.

**Recipe:**

1. For the listed 150 g dry moong dal, use 90 g ghee, 90 g sugar, 250 ml milk and 150 ml water; reserve 10 g of the ghee for the nuts. This makes two generous dessert portions.
2. Grind the soaked moong dal to a coarse paste.
3. Roast the paste in ghee on low heat, stirring constantly, until golden and nutty.
4. Add the warm milk and measured water carefully and cook till absorbed.
5. Stir in sugar and cardamom, cook till the ghee separates.
6. Fold in fried cashews and raisins and serve warm.

<a id="dish-147"></a>

### #147 Coconut rice

**File:** `data/dishes/coconut-rice.md`. **SHA-256:** `7a1517b1d9f2cf673843addf5f0ea5eafc26676784fbed8b2caee314216f1741`.

**Menu:** Rice; Lunch; tags none; primaryIngredient Coconut Milk; active Yes; preferred No; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** South Indian rice tossed in a coconut, cashew and curry-leaf tempering.

**Ingredients for two:** Coconut Milk 100 ml; Cashew 20 g; Curry Leaf 5 g; Green Chilli 2 pcs; Ginger 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Cook and cool the rice so the grains stay separate.
3. Temper mustard seeds, cashews, curry leaves, green chilli and ginger in oil.
4. Stir in the coconut milk with salt and let it warm through.
5. Fold in the rice gently and toss till coated, then serve.

<a id="dish-148"></a>

### #148 Ghee rice

**File:** `data/dishes/ghee-rice.md`. **SHA-256:** `06d32fc518cd640f4490f2bf4e14167462022d9759ac2154275cc24be3fabc9e`.

**Menu:** Rice; Lunch; tags none; primaryIngredient Onion; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Fragrant rice cooked in ghee with whole spices, fried onion and cashews.

**Ingredients for two:** Onion 100 g; Cashew 20 g; Ginger 10 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Heat ghee and crackle whole spices, then fry sliced onion till golden.
3. Add ginger garlic paste and the cashews, saute a minute.
4. Add washed soaked rice and salt, toss to coat.
5. Pour in measured hot water and cook covered till fluffy.
6. Rest, then fluff with a fork before serving.

<a id="dish-149"></a>

### #149 Mint rice

**File:** `data/dishes/mint-rice.md`. **SHA-256:** `16f51f35303a9e97074a62caff2c31d663dd820b9831f2a946b5e8016a9a18d6`.

**Menu:** Rice; Lunch; tags none; primaryIngredient Mint Leaf; active Yes; preferred No; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Cooked rice tossed in a fresh mint and coriander paste with a light tempering.

**Ingredients for two:** Mint Leaf 30 g; Coriander Leaf 20 g; Green Chilli 2 pcs; Onion 60 g; Ginger 10 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Grind mint, coriander, green chilli, ginger and garlic to a smooth paste.
3. Saute sliced onion in oil till soft.
4. Add the green paste and cook till the raw smell goes.
5. Fold in cooked cooled rice with salt and toss gently to coat.

<a id="dish-150"></a>

### #150 Bajra roti

**File:** `data/dishes/bajra-roti.md`. **SHA-256:** `aa7815687792fffe25e0ae559cca3088de1a2257d848317d42418fc6c552b600`.

**Menu:** Chapati; Lunch; tags none; primaryIngredient Pearl Millet Flour; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Rustic winter flatbreads of pearl millet, warming and earthy.

**Ingredients for two:** Empty table (pantry-only dish).

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four small bajra rotis (two portions), mix 160 g pearl-millet flour with 120 ml warm water, adding up to 20 ml more to make a pliable dough.
2. Knead pearl millet flour with warm water into a firm but pliable dough.
3. Pat each ball thin between your palms or on a sheet, dusting with flour.
4. Cook on a hot tawa, flipping once the base sets.
5. Finish on a low flame and brush with ghee while warm.

<a id="dish-151"></a>

### #151 Missi roti

**File:** `data/dishes/missi-roti.md`. **SHA-256:** `bf39af13e5a450d0f470cc9fffb59f7d89e734c8e9af55f8cb5fd170797b5fb3`.

**Menu:** Chapati; Lunch; tags none; primaryIngredient Chickpea; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Spiced flatbreads of wheat and gram flour kneaded with onion, chilli and ajwain.

**Ingredients for two:** Onion 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For six small missi rotis (two portions), use 120 g whole-wheat atta and 80 g besan (gram flour), with 110 ml water initially and up to 20 ml more as needed. Whole chickpeas are not used.
2. Mix wheat flour and gram flour with chopped onion, green chilli, ajwain, coriander and salt.
3. Knead a firm dough with water and a little oil, rest 15 minutes.
4. Roll each ball into a thickish round.
5. Cook on a hot tawa with a little oil, flipping till both sides brown.

<a id="dish-152"></a>

### #152 Moong dal chilla

**File:** `data/dishes/moong-dal-chilla.md`. **SHA-256:** `3ecba7810d3c9f4ff786fc1ff717c9a1b1447214895f29f4e3fbe5b643cb5dd2`.

**Menu:** Chilla; Breakfast; tags none; primaryIngredient Moong Dal; active Yes; preferred Yes; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Savoury yellow moong lentil pancakes with onion, ginger and green chilli.

**Ingredients for two:** Moong Dal 120 g; Onion 50 g; Green Chilli 2 pcs; Ginger 10 g; Coriander Leaf 10 g.

**Pre-prep:** Soak the moong dal for a few hours, then grind to a batter. **Purchase note:** None recorded.

**Recipe:**

1. Grind the soaked moong dal with ginger and green chilli to a smooth pouring batter.
2. Stir in chopped onion, coriander and salt.
3. Ladle onto a hot greased tawa and spread into a thin round.
4. Cook both sides on medium heat until set and lightly browned.

<a id="dish-153"></a>

### #153 Oats chilla

**File:** `data/dishes/oats-chilla.md`. **SHA-256:** `a9187ad3032881469d68abb0d65d333045207f752e5bc8228a29e7c702e42e4d`.

**Menu:** Chilla; Breakfast; tags none; primaryIngredient Oats; active Yes; preferred No; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Quick savoury oats and gram flour pancakes studded with onion, tomato and carrot.

**Ingredients for two:** Oats 80 g; Onion 50 g; Tomato 50 g; Carrot 30 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four small chillas (two portions), combine the listed 80 g oats with 30 g besan and 150 ml water; rest 10 minutes and add up to 30 ml more if the batter thickens.
2. Blend the oats coarse, then whisk with a little gram flour, salt and water into a batter.
3. Stir in finely chopped onion, tomato, carrot, green chilli and coriander.
4. Ladle onto a hot greased tawa and spread into a round.
5. Cook both sides on medium heat until set and golden.

<a id="dish-154"></a>

### #154 Banana bowl

**File:** `data/dishes/banana-bowl.md`. **SHA-256:** `d98acad8bf78e5f199ce9fbaec34e4edfbe9df2a79442aa526a6f527806786fe`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Banana; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Sliced ripe bananas to eat alongside breakfast, simple and filling.

**Ingredients for two:** Banana 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel the bananas and slice into a bowl.
2. Serve fresh alongside the breakfast main.

<a id="dish-155"></a>

### #155 Papaya bowl

**File:** `data/dishes/papaya-bowl.md`. **SHA-256:** `6719cb0547a59700282f10fc57383e7b2fc3422cecfd0c76fcd9d3bc1b2e76ac`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Papaya; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Cubed ripe papaya with a squeeze of lemon to eat alongside breakfast.

**Ingredients for two:** Papaya 300 g; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel the papaya, scoop out the seeds and cut into cubes.
2. Squeeze a little lemon over and serve fresh.

<a id="dish-156"></a>

### #156 Masala toast

**File:** `data/dishes/masala-toast.md`. **SHA-256:** `cfbcaca39191501bf15591c76e67964d217aa600663a121ae7f4f64ea28d9cd1`.

**Menu:** Bread; Breakfast; tags none; primaryIngredient Bread; active Yes; preferred Yes; satiety Low; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** Bread slices toasted with a spiced onion and tomato topping, a quick savoury side.

**Ingredients for two:** Bread 4 pcs; Onion 50 g; Tomato 50 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Mix finely chopped onion, tomato, green chilli, coriander, salt and chilli powder.
2. Spread the mix over the bread slices.
3. Toast topping-side up on a greased tawa, pressing lightly.
4. Cook till the base is crisp and the topping warms through.

<a id="dish-157"></a>

### #157 Bread upma

**File:** `data/dishes/bread-upma.md`. **SHA-256:** `c0ac1f567934ef7bc3b6ef47d23061b745a8c38d419b5ddeeae436c9efdc77d0`.

**Menu:** Bread; Breakfast; tags none; primaryIngredient Bread; active Yes; preferred No; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Cubed bread tossed in a South Indian onion, tomato and curry-leaf tempering.

**Ingredients for two:** Bread 6 pcs; Onion 60 g; Tomato 60 g; Green Chilli 2 pcs; Curry Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the bread into cubes and lightly toast them dry.
2. Temper mustard seeds, curry leaves and green chilli in oil.
3. Add onion, then tomato with turmeric and salt, cook till soft.
4. Fold in the bread cubes, toss to coat, and finish with coriander.

<a id="dish-158"></a>

### #158 Egg podimas

**File:** `data/dishes/egg-podimas.md`. **SHA-256:** `e7c5a3f8cec25a746a30db1cd3a6ee23bbafc22c30878210833551f7eabe0b04`.

**Menu:** Dry dish; Breakfast; tags HP; primaryIngredient Egg; active Yes; preferred Yes; satiety Medium; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** South Indian scrambled eggs with onion, curry leaf and a mustard tempering, a protein-rich breakfast main.

**Ingredients for two:** Egg 4 pcs; Onion 60 g; Green Chilli 2 pcs; Curry Leaf 5 g; Ginger 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Temper mustard seeds, curry leaves, green chilli and ginger in oil.
2. Add onion and cook till soft, then add turmeric and salt.
3. Pour in the beaten eggs and scramble fine on medium heat.
4. Cook till dry and just set, finish with coriander.

<a id="dish-159"></a>

### #159 Prawn pulao

**File:** `data/dishes/prawn-pulao.md`. **SHA-256:** `0ff7a68fa6e993afa377bd23edcd711de0e744b6070488237ddfbbd7a0fd3096`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Prawn; active Yes; preferred Yes; satiety High; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** One-pot basmati pulao cooked with spiced prawns, onion and whole spices.

**Ingredients for two:** Prawn 300 g; Onion 100 g; Tomato 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Cleaned medium prawns, 300g.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Marinate the prawns in turmeric, chilli and salt for ten minutes.
3. Crackle whole spices in ghee, then fry sliced onion till golden.
4. Add ginger garlic paste, green chilli and tomato, cook to a masala.
5. Toss in the prawns briefly, then add washed soaked rice with mint and coriander.
6. Pour in measured hot water, cook covered till fluffy, and rest before serving.

<a id="dish-160"></a>

### #160 Thai red curry tofu (inactive)

**File:** `data/dishes/thai-red-curry-tofu.md`. **SHA-256:** `04fac86d82a0acaf43aa2e244c663f09590fdf64278fd5a19da020fc7d65b641`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Tofu; active No; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Thai.

**Description:** Firm tofu and vegetables simmered in a Thai red coconut curry.

**Ingredients for two:** Tofu 250 g; Coconut Milk 200 ml; Capsicum 80 g; French Bean 60 g; Onion 60 g; Garlic 8 g; Ginger 8 g; Basil 8 g; Thai Red Curry Paste 25 g; Soy Sauce 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pat the tofu dry, cube it and sear lightly till the edges firm up, then set aside.
2. Fry red curry paste with garlic, ginger and onion in a little coconut milk till fragrant.
3. Pour in the rest of the coconut milk and bring to a gentle simmer.
4. Add the capsicum, beans and tofu and simmer till the vegetables are just tender.
5. Stir in torn basil and a splash of soy sauce, and serve with rice.

<a id="dish-161"></a>

### #161 Thai green curry chicken

**File:** `data/dishes/thai-green-curry-chicken.md`. **SHA-256:** `a0ac0fad354f31e558a16f4da4a9308fa9b8bab2421047ef0125f71b6d7fe2d1`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred Yes; satiety High; active prep 30 minutes; seasons All; cuisine Thai.

**Description:** Boneless chicken and vegetables in a fragrant Thai green coconut curry.

**Ingredients for two:** Chicken 300 g; Coconut Milk 200 ml; French Bean 60 g; Capsicum 70 g; Onion 60 g; Garlic 8 g; Ginger 8 g; Basil 8 g; Thai Green Curry Paste 25 g; Soy Sauce 10 ml.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. Fry green curry paste with garlic, ginger and onion in a little coconut milk till fragrant.
2. Add the chicken and seal it on all sides.
3. Pour in the rest of the coconut milk and simmer till the chicken is cooked through.
4. Add the beans and capsicum and cook till just tender.
5. Finish with torn basil and a splash of soy sauce, and serve with rice.

<a id="dish-162"></a>

### #162 Pad thai prawn

**File:** `data/dishes/pad-thai-prawn.md`. **SHA-256:** `b7b7a4eb1622897c0e2c33e2b008d0c753db7c45938eea08c7278dbc437b132c`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Prawn; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Thai.

**Description:** Stir-fried rice noodles with prawns, egg and bean sprouts in a tangy tamarind sauce.

**Ingredients for two:** Rice Vermicelli 150 g; Prawn 200 g; Egg 2 pcs; Bean Sprout 80 g; Spring Onion 40 g; Peanut 30 g; Garlic 8 g; Lemon 1 pcs; Soy Sauce 15 ml; Chilli Sauce 10 g.

**Pre-prep:** None recorded. **Purchase note:** Cleaned prawns, 200g.

**Recipe:**

1. For the sauce, soak 5 g seedless dried tamarind from the pantry in 30 ml hot water for 10 minutes, mash and strain; mix the extract with the listed soy sauce and chilli sauce.
2. Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.
3. Soak the rice noodles in warm water till pliable, then drain.
4. Stir-fry garlic and prawns on high heat till the prawns turn pink, then push aside.
5. Scramble the eggs in the same pan, then add the drained noodles.
6. Toss with a tamarind, soy and chilli sauce till the noodles are coated and tender.
7. Stir through bean sprouts and spring onion, finish with crushed peanuts and a squeeze of lemon.

<a id="dish-163"></a>

### #163 Thai basil chicken

**File:** `data/dishes/thai-basil-chicken.md`. **SHA-256:** `9c436e27b5fe3e7efcf7dc60ce3aedd69f400b074895b54984018adc904daf35`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Thai.

**Description:** Minced chicken stir-fried hard with garlic, chilli and a fistful of basil.

**Ingredients for two:** Chicken Keema 300 g; Onion 60 g; Capsicum 60 g; Garlic 12 g; Green Chilli 3 pcs; Basil 12 g; Soy Sauce 15 ml.

**Pre-prep:** None recorded. **Purchase note:** Chicken keema or minced chicken, 300g.

**Recipe:**

1. Heat oil and fry chopped garlic and green chilli till fragrant.
2. Add the minced chicken and stir-fry hard till browned and dry.
3. Add the onion and capsicum and toss for a minute.
4. Season with soy sauce and a pinch of sugar.
5. Kill the heat, fold in a generous handful of basil, and serve over rice.

<a id="dish-164"></a>

### #164 Singapore noodles

**File:** `data/dishes/singapore-noodles.md`. **SHA-256:** `ffd154f5600b0527ca3c4f5a59ee8487ce7b1dfb7999e588063d7dfabaab37a7`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Rice Vermicelli; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Chinese.

**Description:** Thin rice noodles tossed with egg, vegetables and a warm curry-powder seasoning.

**Ingredients for two:** Rice Vermicelli 150 g; Egg 2 pcs; Capsicum 70 g; Carrot 60 g; Cabbage 60 g; Spring Onion 40 g; Garlic 8 g; Soy Sauce 20 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soak the rice noodles in warm water till soft, then drain.
2. Scramble the eggs in hot oil and set aside.
3. Stir-fry garlic with shredded carrot, cabbage and capsicum on high heat.
4. Add the noodles, soy sauce and a spoon of curry powder and toss till evenly coloured.
5. Fold the egg and spring onion back through and serve hot.

<a id="dish-165"></a>

### #165 Veg hakka noodles

**File:** `data/dishes/veg-hakka-noodles.md`. **SHA-256:** `d405a16edca550ab0ae346fc6c1648310b857afa4cd5d06eca2aa194dbd36a9b`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Noodles; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Chinese.

**Description:** Boiled wheat noodles tossed Indo-Chinese style with shredded vegetables.

**Ingredients for two:** Noodles 180 g; Cabbage 80 g; Carrot 70 g; Capsicum 70 g; Spring Onion 40 g; Garlic 10 g; Soy Sauce 20 ml; Chilli Sauce 15 g; White Vinegar 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.
2. Boil the noodles till just done, drain, rinse and toss with a little oil.
3. Stir-fry garlic with the shredded cabbage, carrot and capsicum on high heat.
4. Keep the vegetables crunchy; do not let them soften fully.
5. Add the noodles with soy sauce, white vinegar and a little chilli sauce.
6. Toss hard till coated, finish with spring onion and serve.

<a id="dish-166"></a>

### #166 Chicken fried rice

**File:** `data/dishes/chicken-fried-rice.md`. **SHA-256:** `bf2c0e7db0dc000bfe2620a3610e97c05e5358eaad46bbfee8a46803be9c2c8e`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Chinese.

**Description:** Cold rice stir-fried with chicken, egg and vegetables Indo-Chinese style.

**Ingredients for two:** Chicken 250 g; Egg 2 pcs; Carrot 60 g; French Bean 50 g; Capsicum 60 g; Spring Onion 40 g; Garlic 10 g; Soy Sauce 20 ml.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken, 250g.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Dice the chicken small and stir-fry till cooked through, then set aside.
3. Scramble the eggs in the same wok and push to the side.
4. Stir-fry garlic with diced carrot, beans and capsicum on high heat.
5. Add cold cooked rice, soy sauce and pepper and toss till hot.
6. Return the chicken and egg, fold through spring onion and serve.

<a id="dish-167"></a>

### #167 Veg manchurian gravy

**File:** `data/dishes/veg-manchurian-gravy.md`. **SHA-256:** `37fa0dcc08e1864b51e82f97d2938c1798a531c5227b06a8dcc5dc692c50c6c2`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Cabbage; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons All; cuisine Chinese.

**Description:** Fried vegetable balls simmered in a garlicky Indo-Chinese brown sauce.

**Ingredients for two:** Cabbage 150 g; Carrot 80 g; Capsicum 60 g; Spring Onion 40 g; Garlic 12 g; Ginger 10 g; Cornflour 40 g; Soy Sauce 15 ml; Chilli Sauce 15 g; White Vinegar 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.
2. Mix finely grated cabbage and carrot with cornflour and seasoning, shape into small balls.
3. Deep fry the balls till golden and firm, then drain.
4. Stir-fry garlic, ginger and capsicum, then add soy sauce, white vinegar and chilli sauce.
5. Thicken with a cornflour slurry into a glossy brown gravy.
6. Add the fried balls just before serving, scatter spring onion, and serve with rice.

<a id="dish-168"></a>

### #168 Chilli chicken dry

**File:** `data/dishes/chilli-chicken-dry.md`. **SHA-256:** `7fc2376774fd6649e7f14a2cf04ad65de4b211ea3bd595677395b37d42b958a0`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Chinese.

**Description:** Indo-Chinese chicken tossed dry with capsicum, onion and a garlicky chilli sauce.

**Ingredients for two:** Chicken 300 g; Capsicum 100 g; Onion 80 g; Spring Onion 30 g; Garlic 12 g; Green Chilli 3 pcs; Cornflour 30 g; Soy Sauce 15 ml; Chilli Sauce 15 g; White Vinegar 10 ml.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.
2. Toss bite-size chicken in cornflour and seasoning, then fry till golden, set aside.
3. On high heat, saute garlic, green chilli, onion and capsicum squares.
4. Add soy sauce, chilli sauce and a little white vinegar.
5. Return the chicken and toss to coat in the dry sauce.
6. Scatter spring onion and serve hot.

<a id="dish-169"></a>

### #169 Penne arrabbiata

**File:** `data/dishes/penne-arrabbiata.md`. **SHA-256:** `3bd043b816eadd49e422b3446d5afd589bcdcaf2c9fe19448d06a73c3d85e139`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Pasta; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Italian.

**Description:** Penne in a fiery tomato, garlic and chilli sauce.

**Ingredients for two:** Pasta 180 g; Tomato 250 g; Garlic 12 g; Onion 60 g; Olive Oil 20 ml; Basil 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the penne in salted water till just firm, reserving a little pasta water.
2. Gently fry garlic and chopped onion in olive oil with a pinch of red chilli flakes.
3. Add chopped tomato and simmer into a thick sauce, seasoning well.
4. Toss the drained pasta through the sauce with a splash of pasta water.
5. Finish with torn basil and serve.

<a id="dish-170"></a>

### #170 Pasta pomodoro

**File:** `data/dishes/pasta-pomodoro.md`. **SHA-256:** `6faa6b80c21cd8664b11063b1285b537b2a2d6844909179155ca6ea07f163bb6`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Pasta; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Italian.

**Description:** Pasta in a simple slow-cooked tomato and basil sauce.

**Ingredients for two:** Pasta 180 g; Tomato 300 g; Garlic 10 g; Onion 70 g; Olive Oil 20 ml; Basil 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the pasta in salted water till just firm and drain.
2. Soften garlic and onion gently in olive oil without browning.
3. Add chopped tomato and simmer slowly into a smooth, sweet sauce.
4. Toss the pasta through the sauce till coated.
5. Finish with torn basil and a drizzle of olive oil.

<a id="dish-171"></a>

### #171 Spaghetti aglio e olio

**File:** `data/dishes/spaghetti-aglio-e-olio.md`. **SHA-256:** `21bcadfbceb2d217f1ac7cee45f8500b7a319b92d839c97cb09644318d5c0d30`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Spaghetti; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Italian.

**Description:** Spaghetti tossed with slow-warmed garlic, olive oil and chilli flakes.

**Ingredients for two:** Spaghetti 180 g; Garlic 15 g; Olive Oil 30 ml; Coriander Leaf 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the spaghetti in well-salted water till just firm, reserving some pasta water.
2. Warm thinly sliced garlic in olive oil over low heat with a pinch of chilli flakes.
3. Add a splash of pasta water and let it emulsify into a light sauce.
4. Toss the drained spaghetti through till glossy and coated.
5. Finish with chopped herbs and a grind of black pepper.

<a id="dish-172"></a>

### #172 Pesto pasta

**File:** `data/dishes/pesto-pasta.md`. **SHA-256:** `cf084ae742ef763e46677f61f044d5154c23640df9d8d9d0b98d725386c7be45`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Pasta; active Yes; preferred Yes; satiety High; active prep 20 minutes; seasons All; cuisine Italian.

**Description:** Pasta tossed in a fresh basil, garlic and peanut pesto.

**Ingredients for two:** Pasta 180 g; Basil 40 g; Garlic 10 g; Peanut 30 g; Olive Oil 30 ml; Cheese 20 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the pasta in salted water till just firm, reserving a little pasta water.
2. Blend basil, garlic, peanuts, cheese and olive oil into a coarse pesto.
3. Loosen the pesto with a spoon of pasta water.
4. Toss the drained pasta through the pesto off the heat.
5. Adjust seasoning and serve with extra cheese.

<a id="dish-173"></a>

### #173 Caprese salad

**File:** `data/dishes/caprese-salad.md`. **SHA-256:** `812a6f07bfab8c9a1a4e037e15ddd1c166fddd0ae271f2bad4dfb6203daf8310`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Tomato; active Yes; preferred No; satiety Low; active prep 10 minutes; seasons All; cuisine Italian.

**Description:** Sliced tomato and mozzarella layered with basil and olive oil.

**Ingredients for two:** Tomato 200 g; Mozzarella 150 g; Basil 10 g; Olive Oil 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Slice the tomato and mozzarella into even rounds.
2. Layer them alternately on a plate.
3. Tuck basil leaves between the slices.
4. Drizzle with olive oil and season with salt and pepper.
5. Serve at room temperature.

<a id="dish-174"></a>

### #174 Hummus

**File:** `data/dishes/hummus.md`. **SHA-256:** `27a77c52ee7cc1320212f5444e9088913b02130ebfb0c944225ca2fb37a9f6e0`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Chickpea; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Lebanese.

**Description:** Smooth blended chickpeas with tahini, garlic and lemon.

**Ingredients for two:** Chickpea 200 g; Tahini 40 g; Garlic 6 g; Lemon 1 pcs; Olive Oil 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Use well-cooked, soft chickpeas, drained.
2. Blend them with tahini, garlic, lemon juice and salt.
3. Add iced water a little at a time and blend long till pale and silky.
4. Taste and adjust lemon and salt.
5. Spread into a bowl, drizzle with olive oil and serve with pita.

<a id="dish-175"></a>

### #175 Falafel

**File:** `data/dishes/falafel.md`. **SHA-256:** `774e6a49860539a5045c1cf92c7c925f1f8206e4370661db0e9f1f41504add0d`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chickpea; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Lebanese.

**Description:** Crisp fried patties of ground chickpeas, herbs and garlic.

**Ingredients for two:** Chickpea 200 g; Onion 50 g; Garlic 10 g; Coriander Leaf 20 g; Mint Leaf 10 g; Green Chilli 2 pcs.

**Pre-prep:** Soak the chickpeas overnight. **Purchase note:** None recorded.

**Recipe:**

1. Grind soaked raw chickpeas with onion, garlic, herbs, chilli and spices into a coarse paste.
2. Rest the mix briefly so it firms up, then shape into small patties.
3. Heat oil and fry the patties till deep golden and crisp.
4. Drain on paper.
5. Serve hot with hummus, pita and salad.

<a id="dish-176"></a>

### #176 Tabbouleh

**File:** `data/dishes/tabbouleh.md`. **SHA-256:** `42c05ce4582989690c4452225459ea6d79f4c674f62a75caec3325a3ea563c0b`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Bulgur Wheat; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Lebanese.

**Description:** A bright herb salad of parsley, tomato and bulgur dressed with lemon and olive oil.

**Ingredients for two:** Bulgur Wheat 60 g; Parsley 60 g; Mint Leaf 20 g; Tomato 120 g; Onion 40 g; Lemon 1 pcs; Olive Oil 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soak the bulgur in warm water till just tender, then drain well.
2. Chop the herbs, tomato and onion very fine.
3. Toss everything with the soaked bulgur.
4. Dress with lemon juice, olive oil and salt.
5. Rest briefly and serve cool.

<a id="dish-177"></a>

### #177 Shakshuka

**File:** `data/dishes/shakshuka.md`. **SHA-256:** `701bbcc764416e88b7e27a1d005cffeeb08f1ead05f86ef5f9ab1415d0f96409`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Egg; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Lebanese.

**Description:** Eggs poached in a spiced tomato, onion and capsicum sauce.

**Ingredients for two:** Egg 4 pcs; Tomato 300 g; Onion 80 g; Capsicum 80 g; Garlic 10 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soften garlic, onion and capsicum in oil with cumin and paprika.
2. Add chopped tomato and simmer into a thick sauce.
3. Make wells in the sauce and crack an egg into each.
4. Cover and cook on low till the whites set and the yolks stay soft.
5. Scatter coriander and serve with bread or pita.

<a id="dish-178"></a>

### #178 Thai tofu stir fry (inactive)

**File:** `data/dishes/thai-tofu-stir-fry.md`. **SHA-256:** `bcc40c8c09d6e332dacc8bc59f106c9df8b42ffda68f35a9999b5362f0fcaac6`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Tofu; active No; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Thai.

**Description:** Tofu and crunchy vegetables tossed in a sweet, garlicky Thai stir-fry sauce.

**Ingredients for two:** Tofu 250 g; French Bean 60 g; Capsicum 70 g; Spring Onion 30 g; Garlic 10 g; Soy Sauce 20 ml; Basil 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Press the tofu dry, cube it and sear hard in hot oil till golden on all sides.
2. Lift the tofu out, then fry garlic and chopped beans and capsicum on high heat.
3. Return the tofu, add soy sauce and a pinch of sugar, and toss to coat.
4. Stir through the spring onion and torn basil off the heat.
5. Serve hot with steamed rice.

<a id="dish-179"></a>

### #179 Thai pineapple fried rice

**File:** `data/dishes/thai-pineapple-fried-rice.md`. **SHA-256:** `b9bf0c71518720c9e07707121772c7a1c5e486c535a761e68c4af7d11eef4557`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Rice; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Thai.

**Description:** Cold rice tossed with egg, cashews and sweet pineapple in a light curry-spiced fry.

**Ingredients for two:** Egg 2 pcs; Pineapple 120 g; Cashew 30 g; Spring Onion 30 g; Capsicum 60 g; Soy Sauce 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Scramble the egg in hot oil and set aside.
3. Fry the capsicum and cashews briefly, then add cold rice and toss on high heat.
4. Season with soy sauce and a pinch of curry powder.
5. Fold through the pineapple, egg and spring onion.
6. Serve hot.

<a id="dish-180"></a>

### #180 Chinese garlic noodles

**File:** `data/dishes/chinese-garlic-noodles.md`. **SHA-256:** `94a774d71d329f01410affc8a41bd6eeb29642a4395760d387129ee6c43d36d9`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Noodles; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Chinese.

**Description:** Noodles tossed in a glossy garlic, soy and chilli sauce with crisp greens.

**Ingredients for two:** Noodles 200 g; Garlic 15 g; Cabbage 80 g; Capsicum 60 g; Spring Onion 30 g; Soy Sauce 25 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the noodles just under done, drain and toss with a little oil.
2. Fry the chopped garlic in hot oil till fragrant but not brown.
3. Add the cabbage and capsicum and stir-fry on high heat till just crisp-tender.
4. Add the noodles and soy sauce with a pinch of sugar and toss to coat.
5. Finish with spring onion and serve hot.

<a id="dish-181"></a>

### #181 Chinese chilli garlic prawns

**File:** `data/dishes/chinese-chilli-garlic-prawns.md`. **SHA-256:** `d5a5a5724a91fc7484bd893ea532d4843e88a9ec4ea87955f249dc82a4792a68`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Prawn; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Chinese.

**Description:** Prawns tossed fast in a sticky chilli, garlic and soy sauce.

**Ingredients for two:** Prawn 300 g; Garlic 15 g; Ginger 10 g; Capsicum 60 g; Spring Onion 30 g; Soy Sauce 20 ml; Cornflour 10 g.

**Pre-prep:** None recorded. **Purchase note:** Cleaned prawns, 300g.

**Recipe:**

1. Toss the prawns in a little cornflour and salt.
2. Sear them fast in hot oil till pink, then lift out.
3. Fry garlic, ginger and capsicum on high heat.
4. Return the prawns with soy sauce, a pinch of chilli and sugar, and a splash of water slaked with the rest of the cornflour.
5. Toss till glossy, finish with spring onion and serve.

<a id="dish-182"></a>

### #182 Pasta primavera

**File:** `data/dishes/pasta-primavera.md`. **SHA-256:** `86c17c4902d886f58df38450a08b378ec850b01abbe99613315f13ca5e9e034b`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Pasta; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Italian.

**Description:** Pasta tossed with spring vegetables in a light garlic and olive oil sauce.

**Ingredients for two:** Pasta 180 g; Broccoli 80 g; Capsicum 70 g; Green Pea 50 g; Garlic 10 g; Olive Oil 20 ml; Cheese 20 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the pasta to just firm, reserving a little pasta water.
2. Saute garlic in olive oil, then add broccoli, capsicum and peas and cook till crisp-tender.
3. Toss the pasta through the vegetables with a splash of pasta water.
4. Season well and finish with grated cheese.
5. Serve warm.

<a id="dish-183"></a>

### #183 Baked mozzarella pasta

**File:** `data/dishes/baked-mozzarella-pasta.md`. **SHA-256:** `77455cbcbb6223091aa8b3e78a4455d4f2dc74178ab1e57bfa40201f2d235bd3`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Pasta; active Yes; preferred No; satiety High; active prep 35 minutes; seasons All; cuisine Italian.

**Description:** Pasta in a tomato sauce baked under a blanket of melted mozzarella.

**Ingredients for two:** Pasta 180 g; Tomato 250 g; Mozzarella 100 g; Onion 60 g; Garlic 10 g; Olive Oil 15 ml; Basil 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the pasta a couple of minutes under done and drain.
2. Make a quick tomato sauce with garlic, onion and olive oil and simmer till thick.
3. Toss the pasta through the sauce with torn basil and tip into a baking dish.
4. Cover with sliced mozzarella and bake till bubbling and golden.
5. Rest a few minutes and serve.

<a id="dish-184"></a>

### #184 Muhammara

**File:** `data/dishes/muhammara.md`. **SHA-256:** `aa8b2aabea23759b8674ae33b82f56f86b6e7405346a88c295e6fc35132d7a26`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Capsicum; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Lebanese.

**Description:** A smoky roasted red pepper and walnut dip from the Levant.

**Ingredients for two:** Capsicum 200 g; Walnut 60 g; Garlic 6 g; Olive Oil 20 ml; Lemon 1 pcs; Pomegranate Molasses 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Char the capsicum over a flame till blackened, then peel and deseed.
2. Blend the roasted pepper with walnuts, garlic and a pinch of chilli.
3. Loosen with olive oil and pomegranate molasses and sharpen with lemon.
4. Blend to a coarse paste and season.
5. Spread on a plate, drizzle with oil and serve with bread.

<a id="dish-185"></a>

### #185 Lebanese lentil soup

**File:** `data/dishes/lebanese-lentil-soup.md`. **SHA-256:** `1eaa3d1094badb3328b5f98727e7007b54c3079a2412886d7c55c40e158fc296`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Masoor Dal; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Lebanese.

**Description:** A smooth, lemony red lentil soup with cumin and a hint of garlic.

**Ingredients for two:** Masoor Dal 150 g; Onion 80 g; Garlic 8 g; Carrot 60 g; Lemon 1 pcs; Olive Oil 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soften onion, garlic and carrot in olive oil with cumin.
2. Add the rinsed lentils and plenty of water and simmer till very soft.
3. Blend smooth and loosen to a soup consistency.
4. Season well and sharpen with lemon juice.
5. Serve hot with bread.

<a id="dish-186"></a>

### #186 Bean burrito bowl

**File:** `data/dishes/bean-burrito-bowl.md`. **SHA-256:** `7149cb6205d6154985ec1005d80db93a30d5eaa788c66f906ff839f963092915`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Kidney Bean; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Mexican.

**Description:** A loaded bowl of spiced beans, rice, corn and fresh salsa.

**Ingredients for two:** Kidney Bean 150 g; Sweet Corn 80 g; Tomato 100 g; Onion 60 g; Capsicum 60 g; Lemon 1 pcs; Coriander Leaf 10 g; Garlic 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Warm the cooked beans with cumin, garlic and a pinch of chilli till saucy.
3. Make a quick salsa with chopped tomato, onion, coriander and lemon.
4. Saute the capsicum and corn till lightly charred.
5. Build bowls with rice, beans, corn and salsa.
6. Squeeze over lemon and serve.

<a id="dish-187"></a>

### #187 Chicken fajita bowl

**File:** `data/dishes/chicken-fajita-bowl.md`. **SHA-256:** `72f0da7dcdba914ad37b863021a1c090b88b90e9c42da2ba33f9d3a89ee7ef6c`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Mexican.

**Description:** Smoky spiced chicken with charred peppers and onions over rice.

**Ingredients for two:** Chicken 300 g; Capsicum 100 g; Onion 80 g; Garlic 8 g; Lemon 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Toss the chicken in cumin, paprika, garlic and a pinch of chilli.
3. Sear it hard in a hot pan till charred and cooked through, then rest.
4. Char the sliced peppers and onion in the same pan.
5. Slice the chicken and pile it with the peppers over rice.
6. Finish with coriander and a squeeze of lemon.

<a id="dish-188"></a>

### #188 Kidney bean quesadilla

**File:** `data/dishes/kidney-bean-quesadilla.md`. **SHA-256:** `daf9d8dcb7bc4bb5d9d0c2c097a782629c051cf77ff6bfa689d31a50d8464d21`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Tortilla; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Mexican.

**Description:** Tortillas filled with spiced beans and melted cheese, toasted till crisp.

**Ingredients for two:** Tortilla 4 pcs; Kidney Bean 120 g; Cheese 80 g; Onion 50 g; Capsicum 50 g; Coriander Leaf 8 g; Garlic 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Mash the beans roughly with cumin, garlic and a pinch of chilli.
2. Saute the onion and capsicum till soft and stir into the beans.
3. Spread the mix and grated cheese over half a tortilla and fold.
4. Toast slowly in a dry pan on both sides till crisp and the cheese melts.
5. Cut into wedges and serve with salsa.

<a id="dish-189"></a>

### #189 Mushroom risotto

**File:** `data/dishes/mushroom-risotto.md`. **SHA-256:** `ce4dfd9532626eeb85ff5e683038bb679e57579c33953d84a8cb55b464dd2877`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Rice; active Yes; preferred No; satiety High; active prep 35 minutes; seasons All; cuisine Continental.

**Description:** Creamy slow-stirred rice with mushrooms, garlic and a little cheese.

**Ingredients for two:** Mushroom 200 g; Onion 60 g; Garlic 8 g; Cheese 30 g; Olive Oil 15 ml; Milk 50 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 140 g dry rice and keep 600 ml hot water ready; add it gradually and stop when the grains are tender with a slight bite.
2. Saute the mushrooms till browned and set aside.
3. Soften onion and garlic in olive oil, then stir in the rice for a minute.
4. Add warm water a ladle at a time, stirring till each is absorbed and the rice is creamy.
5. Fold in the mushrooms, cheese and a splash of milk.
6. Season well and serve.

<a id="dish-190"></a>

### #190 Continental grilled chicken

**File:** `data/dishes/continental-grilled-chicken.md`. **SHA-256:** `3ff22a36b24296f9c2850a256a143ffa621bd2fe21b8aca60ffc234604ae5f83`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken Breast; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Continental.

**Description:** Herb-marinated grilled chicken breast with sauteed vegetables.

**Ingredients for two:** Chicken Breast 250 g; Broccoli 100 g; Carrot 80 g; French Bean 60 g; Garlic 8 g; Olive Oil 15 ml; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** Chicken breast, 250g.

**Recipe:**

1. Marinate the chicken in garlic, olive oil, herbs, lemon and pepper.
2. Grill or pan-sear till cooked through with a golden crust, then rest.
3. Saute the broccoli, carrot and beans till crisp-tender.
4. Slice the chicken and plate with the vegetables.
5. Finish with a squeeze of lemon.

<a id="dish-191"></a>

### #191 Tofu bibimbap (inactive)

**File:** `data/dishes/tofu-bibimbap.md`. **SHA-256:** `2cc7696b0e508b1d765484792a0b93055b3c45d7f5a95dd1af0244884aae674b`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Rice; active No; preferred No; satiety High; active prep 35 minutes; seasons All; cuisine Korean.

**Description:** A Korean rice bowl topped with tofu, vegetables, a fried egg and gochujang.

**Ingredients for two:** Tofu 150 g; Egg 2 pcs; Spinach 80 g; Carrot 60 g; Mushroom 80 g; Gochujang 30 g; Soy Sauce 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Sear the cubed tofu till golden and toss with a little soy sauce.
3. Saute the carrot, mushroom and wilted spinach separately, seasoning each.
4. Fry the eggs sunny side up.
5. Arrange rice in bowls and top with the tofu, vegetables and egg in sections.
6. Add a spoon of gochujang and toss together at the table.

<a id="dish-192"></a>

### #192 Korean chicken stir fry

**File:** `data/dishes/korean-chicken-stir-fry.md`. **SHA-256:** `fadd054069cff5b3e010480b4a15d907dfcf273524a54eb75f2d6f08c64ceb63`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Korean.

**Description:** Chicken stir-fried in a sweet and spicy gochujang glaze with vegetables.

**Ingredients for two:** Chicken 300 g; Cabbage 80 g; Carrot 60 g; Onion 60 g; Spring Onion 30 g; Gochujang 30 g; Soy Sauce 15 ml; Garlic 8 g.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. Mix gochujang, soy sauce, garlic and a little sugar into a glaze.
2. Sear the chicken on high heat till browned.
3. Add the cabbage, carrot and onion and toss till crisp-tender.
4. Pour in the glaze and reduce till it coats the chicken.
5. Finish with spring onion and serve with rice.

<a id="dish-193"></a>

### #193 Teriyaki tofu rice (inactive)

**File:** `data/dishes/teriyaki-tofu-rice.md`. **SHA-256:** `e1d992c33fa4f85bb922a485422039454190a2ea929617b5db63b94e9f299977`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Tofu; active No; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Japanese.

**Description:** Crisp tofu in a sweet soy teriyaki glaze served over rice with greens.

**Ingredients for two:** Tofu 250 g; Broccoli 100 g; Soy Sauce 30 ml; Ginger 8 g; Garlic 8 g; Spring Onion 20 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Press and cube the tofu and sear till golden and crisp.
3. Simmer soy sauce, ginger, garlic and a little sugar into a glossy teriyaki.
4. Toss the tofu in the glaze till coated.
5. Steam the broccoli till just tender.
6. Serve the tofu and broccoli over rice, scattered with spring onion.

<a id="dish-194"></a>

### #194 Japanese egg fried rice

**File:** `data/dishes/japanese-egg-fried-rice.md`. **SHA-256:** `ede98a2ae208718e7bcebb3b99c9f6705d75ac414c687786399556214c9b114b`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Rice; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Japanese.

**Description:** A light egg fried rice seasoned with soy, ginger and spring onion.

**Ingredients for two:** Egg 3 pcs; Spring Onion 40 g; Carrot 60 g; Green Pea 50 g; Soy Sauce 20 ml; Ginger 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Scramble the eggs softly in hot oil and set aside.
3. Fry the ginger, carrot and peas briefly.
4. Add cold rice and toss on high heat till hot through.
5. Season with soy sauce and fold the egg back in.
6. Finish with plenty of spring onion and serve.

<a id="dish-195"></a>

### #195 Greek salad

**File:** `data/dishes/greek-salad.md`. **SHA-256:** `63dd8d63fd933bc2d679685f288893df604d4319fdec7457fbd43aba4ea10bd3`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Cucumber; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Greek.

**Description:** Chunky cucumber, tomato and onion with feta and olive oil.

**Ingredients for two:** Cucumber 150 g; Tomato 150 g; Onion 60 g; Capsicum 60 g; Feta 80 g; Olive Oil 20 ml; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the cucumber, tomato, capsicum and onion into chunky pieces.
2. Toss with olive oil, lemon, oregano and a pinch of salt.
3. Crumble the feta over the top.
4. Leave a few minutes for the flavours to mingle.
5. Serve at room temperature with bread.

<a id="dish-196"></a>

### #196 Mediterranean couscous bowl

**File:** `data/dishes/mediterranean-couscous-bowl.md`. **SHA-256:** `5360b903e0e2f44f3df9c50fd823d164c0988b0377864f456f48bff484cb222f`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Couscous; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Mediterranean.

**Description:** Fluffy couscous with chickpeas, crisp vegetables, feta and lemon.

**Ingredients for two:** Couscous 180 g; Chickpea 120 g; Cucumber 80 g; Tomato 100 g; Capsicum 60 g; Feta 60 g; Olive Oil 15 ml; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pour hot water over the couscous, cover and steam, then fluff with a fork.
2. Warm the chickpeas with cumin and a pinch of chilli.
3. Chop the cucumber, tomato and capsicum small.
4. Toss everything with olive oil, lemon and herbs.
5. Crumble feta over the bowl and serve.

<a id="dish-197"></a>

### #197 Greek chicken souvlaki

**File:** `data/dishes/greek-chicken-souvlaki.md`. **SHA-256:** `752bfdfe92c8b389e97082f1964f074ea93594e3f0e7702d71703b59c8cd5421`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Greek.

**Description:** Lemon and oregano marinated chicken grilled and served with a yoghurt dip.

**Ingredients for two:** Chicken 300 g; Curd 150 g; Cucumber 80 g; Garlic 8 g; Lemon 1 pcs; Olive Oil 15 ml.

**Pre-prep:** Marinate the chicken for an hour or longer. **Purchase note:** Boneless chicken, 300g.

**Recipe:**

1. Marinate the cubed chicken in lemon, garlic, oregano and olive oil.
2. Grate the cucumber, squeeze it dry and stir into the curd with garlic for a tzatziki.
3. Thread the chicken onto skewers and grill hot till charred and cooked.
4. Rest the chicken a few minutes.
5. Serve with the tzatziki and lemon wedges.

<a id="dish-198"></a>

### #198 Chicken enchilada bowl

**File:** `data/dishes/chicken-enchilada-bowl.md`. **SHA-256:** `552fdcffbeb24fe14dab04a178acfc815b5ae3288c03c0634731e1c12effd782`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Mexican.

**Description:** Shredded chicken in a smoky tomato sauce over rice with beans and cheese.

**Ingredients for two:** Chicken 200 g; Kidney Bean 80 g; Tomato 150 g; Onion 60 g; Capsicum 60 g; Cheese 60 g; Garlic 8 g; Coriander Leaf 10 g; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Poach the chicken, then shred it.
3. Cook onion, garlic and capsicum, add tomato, cumin, paprika and chilli, and reduce to a thick sauce.
4. Stir the shredded chicken and beans into the sauce and simmer briefly.
5. Spoon over cooked rice, top with grated cheese and let it melt.
6. Finish with coriander and the juice of the listed half lemon.

<a id="dish-199"></a>

### #199 Mexican rice

**File:** `data/dishes/mexican-rice.md`. **SHA-256:** `d6165d0f38536671384390985729910c85c3c540d98497a5b33578f42747dd6e`.

**Menu:** Rice; Lunch; tags none; primaryIngredient Rice; active Yes; preferred No; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Tomato-stained rice cooked with sweet corn, peas and mild spices.

**Ingredients for two:** Tomato 120 g; Onion 60 g; Sweet Corn 60 g; Green Pea 50 g; Garlic 6 g; Coriander Leaf 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Blend the tomato with garlic into a smooth puree.
3. Toast the rice in a little oil with chopped onion till glossy.
4. Add the tomato puree, cumin and a pinch of chilli, then the measured water.
5. Stir in corn and peas, cover and cook till the rice is fluffy.
6. Fluff with a fork and fold in coriander.

<a id="dish-200"></a>

### #200 Guacamole

**File:** `data/dishes/guacamole.md`. **SHA-256:** `0523cb757e79b06cad650066b03bd7d77825c6ae4d569807f0ae820cc4da0bb7`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Avocado; active Yes; preferred No; satiety Low; active prep 10 minutes; seasons All; cuisine Mexican.

**Description:** Mashed ripe avocado with onion, tomato, lime and coriander.

**Ingredients for two:** Avocado 250 g; Onion 40 g; Tomato 60 g; Green Chilli 1 pcs; Coriander Leaf 10 g; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Scoop the avocado into a bowl and mash it chunky.
2. Finely chop the onion, tomato and green chilli.
3. Fold them in with the coriander.
4. Season with lime juice and salt to taste.
5. Serve fresh with tortillas or as a side.

<a id="dish-201"></a>

### #201 Spanish omelette

**File:** `data/dishes/spanish-omelette.md`. **SHA-256:** `6852648682539e20515653f6957c2f8827d46edadfe48af1e5b90f8733fad23d`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Egg; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Spanish.

**Description:** Thick potato and onion omelette cooked slow and set like a cake.

**Ingredients for two:** Egg 5 pcs; Potato 250 g; Onion 80 g; Olive Oil 20 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Slice the potato and onion thin and soften them gently in olive oil.
2. Beat the eggs with salt and fold in the cooked potato and onion.
3. Pour into a pan and cook on a low flame till the base sets.
4. Slide onto a plate, flip back into the pan and cook the other side.
5. Rest a few minutes, then cut into wedges.

<a id="dish-202"></a>

### #202 Patatas bravas

**File:** `data/dishes/patatas-bravas.md`. **SHA-256:** `50e2d91ecc919ab41782e045cddd5d35296249344d3b85141456a46e21706c1d`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Potato; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Spanish.

**Description:** Crisp potato cubes tossed in a smoky, lightly spiced tomato sauce.

**Ingredients for two:** Potato 300 g; Tomato 120 g; Onion 40 g; Garlic 8 g; Olive Oil 20 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the potato into cubes and fry or roast till deep golden and crisp.
2. Cook onion and garlic in olive oil, add tomato, paprika and a pinch of chilli.
3. Simmer the sauce till thick and smoky.
4. Toss the crisp potatoes in the sauce just before serving.
5. Serve hot.

<a id="dish-203"></a>

### #203 Spanish chickpea spinach stew

**File:** `data/dishes/spanish-chickpea-spinach-stew.md`. **SHA-256:** `95ae6f87def3338b23a16d557d70f600f850a450350b69e91ff3ae8ef4f84230`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Chickpea; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Spanish.

**Description:** Stewed chickpeas and wilted spinach in a smoky paprika tomato base.

**Ingredients for two:** Chickpea 180 g; Spinach 150 g; Tomato 120 g; Onion 60 g; Garlic 8 g; Olive Oil 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cook onion and garlic in olive oil till soft.
2. Add tomato, paprika and cumin and cook down to a thick base.
3. Stir in the cooked chickpeas with a splash of water and simmer.
4. Fold in the spinach and cook till just wilted.
5. Season and serve with bread.

<a id="dish-204"></a>

### #204 Gazpacho

**File:** `data/dishes/gazpacho.md`. **SHA-256:** `5d96046d1d0812b885d0fc3943ab66ac107cce79c125560ea0c1618d449fd90c`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Tomato; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons ['Summer']; cuisine Spanish.

**Description:** A chilled blended soup of ripe tomato, cucumber and capsicum.

**Ingredients for two:** Tomato 300 g; Cucumber 120 g; Capsicum 80 g; Onion 30 g; Garlic 4 g; Olive Oil 15 ml.

**Pre-prep:** Chill the soup for a couple of hours before serving. **Purchase note:** None recorded.

**Recipe:**

1. Roughly chop the tomato, cucumber, capsicum and onion.
2. Blend with garlic, olive oil and a splash of water till smooth.
3. Season with salt and a little vinegar.
4. Chill thoroughly.
5. Serve cold with a drizzle of olive oil on top.

<a id="dish-205"></a>

### #205 Ratatouille

**File:** `data/dishes/ratatouille.md`. **SHA-256:** `4487a3589392f84333c78d64e70a360cb65ecc0466e299ff57845800837fdf8f`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Mixed Veg; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Continental.

**Description:** A slow-cooked French stew of brinjal, zucchini, capsicum and tomato.

**Ingredients for two:** Brinjal 150 g; Zucchini 150 g; Capsicum 100 g; Tomato 150 g; Onion 60 g; Garlic 8 g; Olive Oil 20 ml; Basil 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the brinjal, zucchini and capsicum into even chunks.
2. Soften onion and garlic in olive oil, then add tomato and cook to a sauce.
3. Add the vegetables in stages, the firmer ones first.
4. Cover and cook gently till everything is tender but holds shape.
5. Finish with torn basil and serve warm.

<a id="dish-206"></a>

### #206 Continental baked vegetables

**File:** `data/dishes/continental-baked-vegetables.md`. **SHA-256:** `574f1d068b3f822c62d4527641afea17acc496e121acebabbd718802827611e6`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Mixed Veg; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons All; cuisine Continental.

**Description:** Mixed vegetables in a light white sauce baked under a cheese crust.

**Ingredients for two:** Broccoli 100 g; Cauliflower 100 g; Carrot 80 g; French Bean 60 g; Milk 150 ml; Cheese 60 g; Garlic 6 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For the white sauce, use 10 g plain flour with the listed 150 ml milk: whisk the flour into 30 ml cold milk first, then add it to the remaining hot milk and simmer, stirring, until thickened.
2. Parboil the broccoli, cauliflower, carrot and beans till just tender.
3. Make a light white sauce with milk, a little flour, garlic and pepper.
4. Fold the vegetables through the sauce and tip into a baking dish.
5. Scatter grated cheese over the top.
6. Bake till bubbling and golden.

<a id="dish-207"></a>

### #207 Korean japchae

**File:** `data/dishes/korean-japchae.md`. **SHA-256:** `2af0263a5a9738f97c2c025f5c8ff054201f533ceab029367dd36085160076b0`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Noodles; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Korean.

**Description:** Glass noodles tossed with stir-fried vegetables in a sweet soy sesame glaze.

**Ingredients for two:** Sweet Potato Glass Noodles 180 g; Carrot 80 g; Spinach 80 g; Mushroom 80 g; Capsicum 60 g; Spring Onion 30 g; Soy Sauce 25 ml; Sesame Oil 15 ml; Garlic 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the dry sweet-potato-starch glass noodles (dangmyeon) according to the packet, drain and toss with a little sesame oil.
2. Stir-fry the carrot, mushroom, capsicum and spinach separately, keeping each crisp.
3. Mix soy sauce, sesame oil, garlic and a little sugar into a glaze.
4. Toss the noodles, vegetables and glaze together over low heat.
5. Finish with spring onion and serve.

<a id="dish-208"></a>

### #208 Korean tofu soup (inactive)

**File:** `data/dishes/korean-tofu-soup.md`. **SHA-256:** `9b39ff03acb41116dc96cdb8d7f940cafb0190e35eb49b49437f5e3415f4a066`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Tofu; active No; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Korean.

**Description:** A gently spiced soft tofu broth with mushroom, spring onion and egg.

**Ingredients for two:** Tofu 200 g; Mushroom 80 g; Spring Onion 30 g; Egg 1 pcs; Gochujang 20 g; Garlic 8 g; Soy Sauce 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Fry garlic and gochujang in a little oil till fragrant.
2. Add water and bring to a simmer with the mushroom.
3. Spoon in the soft tofu in large chunks and warm through.
4. Crack in the egg and let it set in the broth.
5. Season with soy sauce and scatter spring onion on top.

<a id="dish-209"></a>

### #209 Japanese teriyaki chicken

**File:** `data/dishes/japanese-teriyaki-chicken.md`. **SHA-256:** `30ab067548d4a170b16a5da7d2729864f39d13fa1b05daa16d4d9e225cd2cd3f`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Japanese.

**Description:** Pan-seared chicken glazed in a sweet-salty soy teriyaki sauce.

**Ingredients for two:** Chicken 250 g; Soy Sauce 30 ml; Honey 20 g; Ginger 8 g; Garlic 8 g; Spring Onion 20 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Sear the chicken pieces in a hot pan till browned on both sides.
2. Mix soy sauce, honey, grated ginger and garlic into a sauce.
3. Pour over the chicken and simmer till it reduces to a glossy glaze.
4. Turn the chicken to coat it well.
5. Scatter spring onion over and serve with rice.

<a id="dish-210"></a>

### #210 Japanese miso soup

**File:** `data/dishes/japanese-miso-soup.md`. **SHA-256:** `16e182e615a13531240016d8f8ab938e2a137145db0f01a8606f9b343e5f5392`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Tofu; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Japanese.

**Description:** A light, savoury broth with soft tofu cubes and spring onion.

**Ingredients for two:** Tofu 120 g; Miso Paste 40 g; Spring Onion 20 g; Spinach 40 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Bring water to a gentle simmer in a pot.
2. Add the cubed tofu and the spinach and warm through.
3. Take the pot off the heat.
4. Whisk the miso paste with a ladle of the warm broth, then stir it back in.
5. Top with spring onion and serve at once.

<a id="dish-211"></a>

### #211 Vietnamese noodle salad

**File:** `data/dishes/vietnamese-noodle-salad.md`. **SHA-256:** `43d4d3ab597cec80696e9bc8cb2713d16e9215a8e0ba7b8a72676e7db3068aba`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Rice Vermicelli; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Vietnamese.

**Description:** Cold rice noodles tossed with crisp vegetables, herbs and a tangy lime dressing.

**Ingredients for two:** Rice Vermicelli 180 g; Carrot 80 g; Cucumber 80 g; Bean Sprout 60 g; Peanut 30 g; Mint Leaf 10 g; Coriander Leaf 10 g; Lemon 1 pcs; Soy Sauce 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soak or boil the rice vermicelli till soft, drain and cool under water.
2. Julienne the carrot and cucumber and pile the bean sprouts.
3. Whisk a dressing of lime, soy, a little sugar and chilli.
4. Toss the noodles, vegetables and herbs with the dressing.
5. Scatter crushed peanuts on top and serve cool.

<a id="dish-212"></a>

### #212 Vietnamese lemongrass chicken

**File:** `data/dishes/vietnamese-lemongrass-chicken.md`. **SHA-256:** `e761e6940eb9285a724dcfdf934d2b83ba54a63fab6311e1fca75ab9c9498a51`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Vietnamese.

**Description:** Caramelised chicken stir-fried with fragrant lemongrass, garlic and chilli.

**Ingredients for two:** Chicken 250 g; Lemongrass 20 g; Garlic 10 g; Onion 50 g; Green Chilli 1 pcs; Soy Sauce 20 ml; Honey 10 g.

**Pre-prep:** Marinate the chicken for an hour if time allows. **Purchase note:** None recorded.

**Recipe:**

1. Marinate the chicken with minced lemongrass, garlic, soy and honey.
2. Heat a pan hot and sear the chicken till browned.
3. Add onion and chilli and stir-fry till the chicken caramelises.
4. Splash in a little water to lift the sticky bits into a glaze.
5. Serve hot with rice.

<a id="dish-213"></a>

### #213 Greek lemon chicken and potatoes

**File:** `data/dishes/greek-lemon-chicken-and-potatoes.md`. **SHA-256:** `1cc0db788dfb7396ec93a973e8181606cfbafc2d18e6a82cbfb02545815d9e6a`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 40 minutes; seasons All; cuisine Greek.

**Description:** Chicken and potatoes roasted together in lemon, garlic and oregano.

**Ingredients for two:** Chicken 300 g; Potato 250 g; Garlic 12 g; Onion 60 g; Olive Oil 25 ml; Lemon 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** Curry cut chicken, 300g.

**Recipe:**

1. Toss the chicken and potato wedges with olive oil, garlic, lemon juice and oregano.
2. Spread in a roasting tray with sliced onion.
3. Pour in a little water so the potatoes stay moist.
4. Roast, turning once, till the chicken is done and the potatoes are golden.
5. Rest briefly and serve with the pan juices.

<a id="dish-214"></a>

### #214 Tzatziki

**File:** `data/dishes/tzatziki.md`. **SHA-256:** `207f2aa2a2801b0af8bb6949dcfbff0c276cdcce9c272675113bf1598f1b5505`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Curd; active Yes; preferred No; satiety Low; active prep 10 minutes; seasons All; cuisine Greek.

**Description:** A cooling thick-curd dip with grated cucumber, garlic and mint.

**Ingredients for two:** Curd 200 g; Cucumber 120 g; Garlic 6 g; Mint Leaf 8 g; Olive Oil 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Hang the curd briefly so it thickens, or use thick curd.
2. Grate the cucumber and squeeze out the water.
3. Fold the cucumber, grated garlic and chopped mint into the curd.
4. Stir in olive oil and salt.
5. Chill and serve with bread or as a side.

<a id="dish-215"></a>

### #215 Greek yogurt with honey and walnuts

**File:** `data/dishes/greek-yogurt-with-honey-and-walnuts.md`. **SHA-256:** `b6149221abc8e8c949fcbbba4422ab7138328ed25578af5346c996c8d12a7929`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Curd; active Yes; preferred No; satiety Low; active prep 10 minutes; seasons All; cuisine Greek.

**Description:** Thick strained curd spooned with honey and toasted walnuts.

**Ingredients for two:** Curd 250 g; Honey 30 g; Walnut 30 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Strain the curd briefly so it turns thick and creamy.
2. Toast the walnuts lightly and chop them coarse.
3. Spoon the curd into bowls.
4. Drizzle honey generously over the top.
5. Scatter the walnuts and serve chilled.

<a id="dish-216"></a>

### #216 Mango sorbet

**File:** `data/dishes/mango-sorbet.md`. **SHA-256:** `85b6ffbcdb033ba5615aae135005592dcf6d66dcbb2d76bbeac6d1afd19f0d0f`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Mango; active Yes; preferred No; satiety Low; active prep 10 minutes; seasons ['Summer']; cuisine Indian.

**Description:** A simple frozen blend of ripe mango with a squeeze of lime.

**Ingredients for two:** Mango 300 g; Lemon 1 pcs.

**Pre-prep:** Freeze the blended mango for a few hours before serving. **Purchase note:** None recorded.

**Recipe:**

1. Blend the ripe mango to a smooth puree.
2. Stir in a squeeze of lime to balance the sweetness.
3. Pour into a shallow tray and freeze.
4. Scrape and stir once or twice as it sets for a softer texture.
5. Scoop and serve frozen.

<a id="dish-217"></a>

### #217 Mutton rogan josh

**File:** `data/dishes/mutton-rogan-josh.md`. **SHA-256:** `6934c25c8e7530ee628a2574b58be044bc7e6225848b0ef8ac9026c39e5a5638`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Mutton; active Yes; preferred No; satiety High; active prep 55 minutes; seasons All; cuisine Indian.

**Description:** Kashmiri style mutton slow-cooked in a spiced curd and onion gravy with a deep red colour.

**Ingredients for two:** Mutton 300 g; Onion 150 g; Curd 80 g; Tomato 80 g; Ginger 12 g; Garlic 12 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Curry cut mutton, 300g.

**Recipe:**

1. Brown the onions in oil, then add ginger garlic paste and cook till fragrant.
2. Add the mutton and sear on high heat till the pieces are well coloured.
3. Stir in whisked curd, tomato, Kashmiri chilli and ground spices, cook till the oil separates.
4. Add hot water, cover and simmer on low heat 45 minutes until the mutton is fork tender.
5. Finish with coriander and a sprinkle of garam masala.

<a id="dish-218"></a>

### #218 Mutton curry

**File:** `data/dishes/mutton-curry.md`. **SHA-256:** `7591c62eb703c52618bfda0cd74da84e09efa9dde755b520b44218a5c30c9c9d`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Mutton; active Yes; preferred No; satiety High; active prep 55 minutes; seasons All; cuisine Indian.

**Description:** Home-style mutton curry in a spiced onion-tomato gravy.

**Ingredients for two:** Mutton 300 g; Onion 150 g; Tomato 120 g; Ginger 12 g; Garlic 12 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Curry cut mutton, 300g.

**Recipe:**

1. Brown the onions slowly in oil, then add ginger garlic paste.
2. Add tomato, green chilli and ground spices, cook till the oil separates.
3. Add the mutton and sear for a few minutes on high heat.
4. Pour in hot water, cover and simmer on low heat 45 minutes until the mutton is tender.
5. Finish with coriander and a sprinkle of garam masala.

<a id="dish-219"></a>

### #219 Mutton keema

**File:** `data/dishes/mutton-keema.md`. **SHA-256:** `5f27057b064413a4aaf8a251b6125964645206a941c7a6f849ce14d9af3c8c7e`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Mutton; active Yes; preferred No; satiety High; active prep 45 minutes; seasons All; cuisine Indian.

**Description:** Minced mutton bhuna cooked dry with onion, tomato and green peas.

**Ingredients for two:** Mutton 300 g; Onion 120 g; Tomato 100 g; Green Pea 80 g; Ginger 10 g; Garlic 10 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** Minced mutton, 300g.

**Recipe:**

1. Brown the onions in oil, then add ginger garlic paste and green chilli.
2. Add tomato and ground spices, cook till the masala thickens and the oil separates.
3. Add the minced mutton and break it up, frying till it changes colour.
4. Add green peas and a splash of water, cover and cook 25 minutes till tender, then dry off the moisture.
5. Finish with coriander and a sprinkle of garam masala.

<a id="dish-220"></a>

### #220 Mutton pepper fry

**File:** `data/dishes/mutton-pepper-fry.md`. **SHA-256:** `96e7c82c85851f5b80e397264c7a626235fe5f868fdb413f034e1d9da86c5a32`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Mutton; active Yes; preferred No; satiety High; active prep 50 minutes; seasons All; cuisine Indian.

**Description:** South Indian style mutton tossed dry with onion, curry leaf and coarsely crushed black pepper.

**Ingredients for two:** Mutton 300 g; Onion 100 g; Ginger 12 g; Garlic 12 g; Curry Leaf 5 g; Green Chilli 2 pcs.

**Pre-prep:** Pressure cook the mutton with salt and turmeric till tender. **Purchase note:** Curry cut mutton, 300g.

**Recipe:**

1. Pressure cook the mutton with salt and turmeric till tender, reserving the stock.
2. Saute ginger, garlic, green chilli and curry leaf in oil.
3. Add sliced onion and cook till soft, then add the cooked mutton.
4. Toss on high heat with plenty of coarsely crushed black pepper, splashing in the reserved stock to coat.
5. Fry till the masala clings dry to the mutton and serve hot.

<a id="dish-221"></a>

### #221 Mutton biryani

**File:** `data/dishes/mutton-biryani.md`. **SHA-256:** `02e8287c1388616afe77bf173749e17fc7f1441ce68ecf8cae3ec2bded25bf9f`.

**Menu:** Complete meal; Lunch; tags HP, complete_meal; primaryIngredient Mutton; active Yes; preferred No; satiety High; active prep 60 minutes; seasons All; cuisine Indian.

**Description:** Layered basmati rice and marinated mutton slow-cooked on dum with fried onions.

**Ingredients for two:** Mutton 300 g; Onion 150 g; Curd 80 g; Tomato 80 g; Ginger 12 g; Garlic 12 g; Green Chilli 2 pcs; Mint Leaf 10 g; Coriander Leaf 10 g.

**Pre-prep:** Marinate the mutton in curd and spices overnight so it tenderises. **Purchase note:** Curry cut mutton, 300g.

**Recipe:**

1. For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed.
2. Marinate the mutton in curd, ginger garlic paste, chilli and biryani spices, ideally overnight.
3. Fry sliced onion till golden, then cook the marinated mutton with tomato till tender.
4. Parboil soaked basmati rice with whole spices and salt, drain at 70 percent done.
5. Layer rice over the mutton with mint, coriander and fried onions.
6. Cover tight and cook on dum on low heat 25 minutes, then rest before fluffing.

<a id="dish-222"></a>

### #222 Aloo methi

**File:** `data/dishes/aloo-methi.md`. **SHA-256:** `7a72247c548288ecaf3244c0507755360945e0f5f11078d2a092694bdfcf6d45`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Potato; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Diced potato tossed with fresh fenugreek leaves, a faintly bitter everyday sabzi.

**Ingredients for two:** Potato 200 g; Fenugreek Leaf 100 g; Onion 50 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Wash the fenugreek leaves well, drain and chop them.
2. Heat oil, splutter cumin, then fry onion and green chilli till soft.
3. Add diced potato with turmeric and salt, cover and cook till nearly done.
4. Stir in the methi and cook uncovered a few minutes till the leaves wilt and the potato is tender.

<a id="dish-223"></a>

### #223 Cabbage thoran

**File:** `data/dishes/cabbage-thoran.md`. **SHA-256:** `1c10d337995f8f1f3c9095cac62d6793c77ffe64b7fc03e802ccb28f0c820646`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Cabbage; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** South Indian stir fried cabbage with carrot, curry leaves and a mustard tempering.

**Ingredients for two:** Cabbage 200 g; Carrot 50 g; Green Chilli 2 pcs; Curry Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Finely shred the cabbage and grate the carrot.
2. Temper mustard seeds and curry leaves in oil, add green chilli.
3. Add the cabbage and carrot with turmeric and salt.
4. Cover and cook on low till just tender, keeping a little crunch.

<a id="dish-224"></a>

### #224 Gajar matar

**File:** `data/dishes/gajar-matar.md`. **SHA-256:** `10615deaa0b2dfb691a285ddee4ad8963f01715aaf4787726b091e19276db18c`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Carrot; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Sweet winter carrots and green peas cooked dry with cumin and a little tomato.

**Ingredients for two:** Carrot 150 g; Green Pea 100 g; Onion 50 g; Tomato 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dice the carrot small so it cooks quickly.
2. Splutter cumin in oil, soften the onion, then add tomato and cook down.
3. Add carrot and peas with turmeric, chilli powder and salt.
4. Cover and cook on low till the carrot is tender, then dry off any moisture.

<a id="dish-225"></a>

### #225 Beans poriyal

**File:** `data/dishes/beans-poriyal.md`. **SHA-256:** `5c31e826f23c5fc15fef3c986c2e1b5e195ea396d69c618a544b8aa0c58de986`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient French Bean; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Finely chopped French beans stir fried South Indian style with curry leaves.

**Ingredients for two:** French Bean 200 g; Carrot 50 g; Green Chilli 2 pcs; Curry Leaf 5 g; Urad Dal 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Finely chop the beans and carrot.
2. Temper mustard seeds, urad dal and curry leaves in oil with green chilli.
3. Add the vegetables with a little salt and turmeric.
4. Sprinkle a splash of water, cover and steam cook till tender.

<a id="dish-226"></a>

### #226 Baingan bharta

**File:** `data/dishes/baingan-bharta.md`. **SHA-256:** `93101864c454aecc8e73e361f90907acea14a345fa1d87be8728a14908246ca1`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Brinjal; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Smoky roasted aubergine mashed into a spiced onion and tomato bhuna.

**Ingredients for two:** Brinjal 300 g; Onion 80 g; Tomato 80 g; Green Pea 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Ginger 10 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Roast the whole brinjal over a flame till the skin chars and the flesh is soft.
2. Cool, peel off the skin and mash the flesh.
3. Fry onion, green chilli and ginger garlic, add tomato and peas and cook down.
4. Stir in the mashed brinjal with salt and spices and bhuna till smoky.
5. Finish with chopped coriander.

<a id="dish-227"></a>

### #227 Begun bhaja

**File:** `data/dishes/begun-bhaja.md`. **SHA-256:** `b288430247fba734c3689bfdc117e10315282513e11cf717e74e1357f233185a`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Brinjal; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Bengali style brinjal rounds rubbed with turmeric and shallow fried till crisp.

**Ingredients for two:** Brinjal 250 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Slice the brinjal into thick rounds.
2. Rub both sides with turmeric, chilli powder and salt and rest 10 minutes.
3. Shallow fry in oil on medium heat till golden and soft.
4. Drain and serve hot as a side with dal and rice.

<a id="dish-228"></a>

### #228 Zucchini stir fry

**File:** `data/dishes/zucchini-stir-fry.md`. **SHA-256:** `686c12fb228a7ca56b02a9e50b4ebe4fa37283a43c07e103a4a0496cdb69de97`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Zucchini; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Quick garlicky zucchini and capsicum tossed on high heat.

**Ingredients for two:** Zucchini 200 g; Capsicum 50 g; Garlic 10 g; Onion 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Slice the zucchini into half moons and dice the capsicum and onion.
2. Heat oil hot, fry the garlic till fragrant.
3. Add onion and capsicum, toss a minute, then add zucchini.
4. Stir fry on high heat with salt and pepper, keeping the zucchini firm.

<a id="dish-229"></a>

### #229 Broccoli garlic stir fry

**File:** `data/dishes/broccoli-garlic-stir-fry.md`. **SHA-256:** `a567cd362b6c6bf528c34c6e4d821c949d924596e2325e48cb13eb8fd2e99b4a`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Broccoli; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Crisp tender broccoli florets tossed with plenty of garlic.

**Ingredients for two:** Broccoli 200 g; Garlic 15 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the broccoli into small florets and blanch 2 minutes in hot salted water.
2. Heat oil and fry the sliced garlic and green chilli till just golden.
3. Add the drained broccoli and toss on high heat.
4. Season with salt and pepper and serve crisp.

<a id="dish-230"></a>

### #230 Sprouts usal

**File:** `data/dishes/sprouts-usal.md`. **SHA-256:** `9041c93de8e511d61c6e85b7fac6933ca38e6fc1e23d6c68ac5706fe831dcadc`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Sprout; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Maharashtrian moth or moong sprouts simmered in a light onion tomato masala.

**Ingredients for two:** Sprout 150 g; Onion 60 g; Tomato 60 g; Green Chilli 2 pcs; Coriander Leaf 10 g; Ginger 8 g; Garlic 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Fry onion, green chilli and ginger garlic till soft.
2. Add tomato with turmeric, chilli powder and a little garam masala and cook down.
3. Add the sprouts and a cup of water and simmer till tender.
4. Adjust salt and finish with coriander.

<a id="dish-231"></a>

### #231 Mushroom do pyaza

**File:** `data/dishes/mushroom-do-pyaza.md`. **SHA-256:** `bd88d3d4a66211e291fe1d1f030f7d215f10ff37c983806e1bb8fe93836740a4`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Mushroom; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Mushrooms cooked dry with a double hit of onion and chunky capsicum.

**Ingredients for two:** Mushroom 200 g; Onion 150 g; Tomato 50 g; Capsicum 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Quarter the mushrooms and dice half the onion into chunks, finely chop the rest.
2. Fry the finely chopped onion to a base, add tomato and cook down.
3. Add mushrooms with spices and cook till they release and reabsorb their water.
4. Toss in the onion and capsicum chunks and cook till just softened.

<a id="dish-232"></a>

### #232 Bhindi do pyaza

**File:** `data/dishes/bhindi-do-pyaza.md`. **SHA-256:** `0a84c70ee1741ba907e0f682579ffae9a1f5f02abef20345a2d5b9d47df3b831`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Bhindi; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Okra and generous onions cooked dry till soft and lightly caramelised.

**Ingredients for two:** Bhindi 200 g; Onion 120 g; Tomato 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Wash and fully dry the okra, then cut into pieces.
2. Fry the okra in oil on medium heat till the stickiness goes, then set aside.
3. In the same pan soften the onion, add tomato and spices.
4. Return the okra, toss with salt and amchur and cook a few minutes more.

<a id="dish-233"></a>

### #233 Palak corn

**File:** `data/dishes/palak-corn.md`. **SHA-256:** `2753dfa730d3275cdfa0c8b91fbb5fbd1d71bd244777ea5f5e7c7a98de8895b2`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Spinach; active Yes; preferred No; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Chopped spinach and sweet corn cooked with garlic into a dry sabzi.

**Ingredients for two:** Spinach 200 g; Sweet Corn 100 g; Onion 50 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the corn till tender and wash and chop the spinach.
2. Fry garlic and onion in oil till soft.
3. Add the spinach and cook till it wilts and the water dries.
4. Stir in the corn with salt and pepper and toss through.

<a id="dish-234"></a>

### #234 Anda paratha

**File:** `data/dishes/anda-paratha.md`. **SHA-256:** `72403c2d412112b39c4b85f65e3d061d6d74452833e18e9ab80b073234baee45`.

**Menu:** Paratha; Breakfast; tags HP, complete_carb; primaryIngredient Egg; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Wheat paratha cooked with a spiced egg layer sealed inside, a filling breakfast.

**Ingredients for two:** Egg 2 pcs; Onion 40 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two large egg parathas (two portions), use 120 g whole-wheat atta and 75 ml water, adding up to 10 ml more for a soft dough.
2. Knead a soft wheat dough and roll out a paratha, half cooking it on the tawa.
3. Beat the eggs with chopped onion, green chilli, coriander and salt.
4. Pour the egg onto the tawa and lay the paratha over it to bond.
5. Flip and cook both sides with a little ghee till golden and the egg is set.

<a id="dish-235"></a>

### #235 Dal palak

**File:** `data/dishes/dal-palak.md`. **SHA-256:** `2d8388147efee9d066f89edefb40d69c243da5e776e1f468b336199fbd772567`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Moong Dal; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Soft moong dal cooked with spinach and a garlic tempering.

**Ingredients for two:** Moong Dal 100 g; Spinach 150 g; Tomato 50 g; Garlic 10 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook the moong dal with turmeric and salt till soft.
2. Wash and chop the spinach and add it with chopped tomato to the dal.
3. Simmer a few minutes till the spinach is cooked through.
4. Temper garlic and green chilli in ghee and pour over the dal.

<a id="dish-236"></a>

### #236 Panchmel dal

**File:** `data/dishes/panchmel-dal.md`. **SHA-256:** `2573b182c111e22fd58e73b513cf5e37825f04f4ba2e99ad1c6f9df2ed50ca39`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Toor Dal; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Five lentils cooked together and finished with a fragrant ghee tempering.

**Ingredients for two:** Toor Dal 26 g; Moong Dal 26 g; Chana Dal 26 g; Masoor Dal 26 g; Onion 50 g; Tomato 50 g; Garlic 10 g; Ginger 10 g; Urad Dal 26 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Rinse all the lentils together and pressure cook with turmeric and salt till soft.
2. Fry onion, garlic and ginger, add tomato and spices and cook to a masala.
3. Stir the masala into the dal and simmer to the consistency you like.
4. Finish with a tempering of cumin and dried chilli in ghee.

<a id="dish-237"></a>

### #237 Sambar

**File:** `data/dishes/sambar.md`. **SHA-256:** `b9d61d6e9d284eba84d756eaaeae2a0207c8499037f44851979ea9c21eeba9be`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Toor Dal; active Yes; preferred No; satiety Medium; active prep 40 minutes; seasons All; cuisine Indian.

**Description:** South Indian toor dal stew with mixed vegetables, tamarind and sambar masala.

**Ingredients for two:** Toor Dal 100 g; Carrot 60 g; French Bean 60 g; Brinjal 60 g; Tomato 60 g; Onion 50 g; Curry Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Pressure cook the toor dal with turmeric till soft and mash it smooth.
2. Boil the chopped vegetables with tamarind water and salt till tender.
3. Add the dal and sambar powder and simmer together a few minutes.
4. Temper mustard seeds, curry leaves and dried chilli in oil and pour over.

<a id="dish-238"></a>

### #238 Rasam

**File:** `data/dishes/rasam.md`. **SHA-256:** `e28c17dc413940982d21669a08b0e01b45009d2aa85d58575d44f84a1e95bcaf`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Tomato; active Yes; preferred No; satiety Low; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Thin peppery tamarind and tomato broth with a little dal, soothing with rice.

**Ingredients for two:** Toor Dal 40 g; Tomato 150 g; Garlic 10 g; Curry Leaf 5 g; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cook a little toor dal till soft and keep the cooking water.
2. Simmer mashed tomato with tamarind water, rasam powder, crushed garlic and salt.
3. Add the dal water and bring to a gentle froth without boiling hard.
4. Temper mustard seeds and curry leaves in ghee, pour over and add coriander.

<a id="dish-239"></a>

### #239 Aloo tamatar sabzi

**File:** `data/dishes/aloo-tamatar-sabzi.md`. **SHA-256:** `59f15ba048dd024d3b8c36ec075e7fa1869b8c8843cf09622d3975c76d732775`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Potato; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Boiled potato in a light tangy tomato gravy, the everyday rasewale aloo.

**Ingredients for two:** Potato 250 g; Tomato 100 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil and roughly crush the potatoes.
2. Splutter cumin in oil, add pureed tomato, green chilli and spices and cook down.
3. Add the potato and enough water for a thin gravy and simmer 10 minutes.
4. Finish with coriander.

<a id="dish-240"></a>

### #240 Dum aloo

**File:** `data/dishes/dum-aloo.md`. **SHA-256:** `d78b91a0470a1ca1c1b077d8356d45110b959ba8a3c049da2d690b9d51b4787b`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Potato; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Baby potatoes simmered in a rich curd and cashew gravy.

**Ingredients for two:** Potato 300 g; Curd 80 g; Tomato 80 g; Cashew 20 g; Onion 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil and lightly fry the baby potatoes till golden.
2. Make a paste of onion, tomato and soaked cashew.
3. Fry the paste with spices, then lower the heat and whisk in the curd.
4. Add the potatoes and a little water and simmer on dum till the gravy is rich.

<a id="dish-241"></a>

### #241 Paneer jalfrezi

**File:** `data/dishes/paneer-jalfrezi.md`. **SHA-256:** `891685f2933d27e919c5009b62b0bff78378486bf5f4210edf5e0a5dd8230d13`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Paneer and crunchy peppers tossed in a tangy semi dry jalfrezi masala.

**Ingredients for two:** Paneer 150 g; Capsicum 80 g; Onion 80 g; Tomato 60 g; Green Chilli 2 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cut the paneer, capsicum and onion into thick strips.
2. Fry onion and capsicum on high heat to keep them crunchy, then set aside.
3. Make a quick tomato masala with spices and a dash of vinegar.
4. Toss in the paneer and the vegetables and cook till just coated.

<a id="dish-242"></a>

### #242 Egg roast

**File:** `data/dishes/egg-roast.md`. **SHA-256:** `a50923bd46d780baccb0b9bee86e993d3adda7c58fdfb150579bf5e11a6ec637`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Egg; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Boiled eggs simmered in a Kerala style roasted onion masala.

**Ingredients for two:** Egg 4 pcs; Onion 150 g; Tomato 80 g; Green Chilli 2 pcs; Curry Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the eggs, peel and lightly score them.
2. Slow cook the sliced onion with curry leaves till deep brown.
3. Add tomato, green chilli and spices and cook to a thick masala.
4. Roll the eggs in the masala and cook a few minutes till coated.

<a id="dish-243"></a>

### #243 Vegetable stew

**File:** `data/dishes/vegetable-stew.md`. **SHA-256:** `ec8bbc891d7be1f24a72c5239f6a7d4ce1e28d3433c024ae9c28047e0d2fd1ad`.

**Menu:** Gravy dish; Lunch; tags none; primaryIngredient Coconut Milk; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Mild Kerala style mixed vegetables simmered in coconut milk.

**Ingredients for two:** Carrot 80 g; Potato 100 g; French Bean 60 g; Green Pea 40 g; Coconut Milk 100 ml; Ginger 10 g; Green Chilli 1 pcs; Curry Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dice the vegetables evenly.
2. Saute ginger, green chilli and curry leaves lightly without browning.
3. Add the vegetables and a little water and cook till tender.
4. Pour in the coconut milk, warm through gently and season with salt and pepper.

<a id="dish-244"></a>

### #244 Methi chicken

**File:** `data/dishes/methi-chicken.md`. **SHA-256:** `4d631702254363cab06ac4adbbabe7713a7bbfe9225faeeb6dd3fa4d69e969f5`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Chicken; active Yes; preferred No; satiety High; active prep 40 minutes; seasons ['Winter']; cuisine Indian.

**Description:** Chicken in an onion tomato gravy fragrant with fresh fenugreek leaves.

**Ingredients for two:** Chicken 300 g; Fenugreek Leaf 60 g; Onion 120 g; Tomato 80 g; Ginger 10 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** Curry cut chicken, 300g.

**Recipe:**

1. Brown the onion well, then add ginger garlic paste.
2. Add tomato and ground spices and cook till the oil separates.
3. Add the chicken and sear, then add the chopped fenugreek leaves.
4. Pour in water, cover and simmer till the chicken is tender and the methi mellow.

<a id="dish-245"></a>

### #245 Soya matar keema (inactive)

**File:** `data/dishes/soya-matar-keema.md`. **SHA-256:** `178e865ffc9c5feceb7e7a3129076f2336d09ab4bc14eece0953616f2d8b7d9e`.

**Menu:** Gravy dish; Lunch; tags HP; primaryIngredient Soyabean Chunk; active No; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Minced soya and green peas cooked keema style in onion tomato masala.

**Ingredients for two:** Soyabean Chunk 80 g; Green Pea 80 g; Onion 80 g; Tomato 80 g; Ginger 10 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soak the soya chunks in hot water, squeeze dry and pulse to a coarse mince.
2. Fry onion and ginger garlic, add tomato and spices and cook to a masala.
3. Add the soya mince and peas and toss to coat.
4. Add a little water, cover and cook till the peas are done and it is semi dry.

<a id="dish-246"></a>

### #246 Veg fried rice

**File:** `data/dishes/veg-fried-rice.md`. **SHA-256:** `50707946a4ba4eb50d5c3c170e5d2854691221f5aad9cceeb39e2b190ed60ff4`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Carrot; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Chinese.

**Description:** Wok tossed rice with finely diced vegetables and spring onion.

**Ingredients for two:** Carrot 60 g; French Bean 60 g; Capsicum 60 g; Spring Onion 30 g; Green Pea 40 g; Garlic 8 g; Soy Sauce 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Use cooled cooked rice so the grains stay separate.
3. Finely dice all the vegetables.
4. Stir fry the vegetables on high heat with garlic till crisp tender.
5. Add the rice with soy sauce, salt and pepper and toss, finishing with spring onion greens.

<a id="dish-247"></a>

### #247 Chana pulao

**File:** `data/dishes/chana-pulao.md`. **SHA-256:** `158c79437bf40a2aa3e261080568f509e98a098ad138c208a19c1d718872990c`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Chickpea; active Yes; preferred No; satiety High; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Fragrant one pot rice cooked with chickpeas and whole spices.

**Ingredients for two:** Chickpea 120 g; Onion 80 g; Tomato 50 g; Ginger 10 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Soak and boil the chickpeas till tender, or use cooked ones.
3. Fry whole spices and sliced onion till golden, add ginger garlic and tomato.
4. Add the chickpeas and soaked rice and toss with salt.
5. Add measured water and cook covered till the rice is fluffy.

<a id="dish-248"></a>

### #248 Soya pulao (inactive)

**File:** `data/dishes/soya-pulao.md`. **SHA-256:** `78772cd3a1be376ba2bda7860b687ac16ba09812087c529a9fa39a11bc67c86a`.

**Menu:** Complete meal; Lunch; tags complete_meal, HP; primaryIngredient Soyabean Chunk; active No; preferred No; satiety High; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** One pot rice with soya chunks and vegetables, a high protein meal.

**Ingredients for two:** Soyabean Chunk 80 g; Onion 80 g; Carrot 50 g; Green Pea 50 g; Ginger 10 g; Garlic 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Soak the soya chunks in hot salted water and squeeze dry.
3. Fry whole spices and onion, add ginger garlic and the vegetables.
4. Add the soya chunks and soaked rice and toss with salt.
5. Add measured water and cook covered till done, then rest and fluff.

<a id="dish-249"></a>

### #249 Paneer fried rice

**File:** `data/dishes/paneer-fried-rice.md`. **SHA-256:** `26e2233de91a9ff533db5ca2fa10ae68107ffd1a9f4bf50e5b13f283d767bc0e`.

**Menu:** Complete meal; Lunch; tags complete_meal, HP; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Rice tossed with cubes of paneer, peppers and spring onion.

**Ingredients for two:** Paneer 120 g; Capsicum 60 g; Spring Onion 30 g; Carrot 50 g; Soy Sauce 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly.
2. Use cooled cooked rice and lightly pan fry the paneer cubes.
3. Stir fry diced carrot, capsicum and spring onion whites on high heat.
4. Add the rice with soy sauce, salt and pepper and toss.
5. Fold in the paneer and spring onion greens.

<a id="dish-250"></a>

### #250 Vegetable daliya

**File:** `data/dishes/vegetable-daliya.md`. **SHA-256:** `101271ba47a1e5714acc70ac65aee62b13235694d86bb40616068423f71e0517`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Bulgur Wheat; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Savoury broken wheat cooked with vegetables, a light wholesome meal.

**Ingredients for two:** Bulgur Wheat 100 g; Carrot 50 g; Green Pea 50 g; Tomato 50 g; Onion 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dry roast the broken wheat lightly till fragrant.
2. Splutter cumin, fry onion and the diced vegetables with turmeric and salt.
3. Add the roasted wheat and three times its volume of water.
4. Pressure cook or simmer covered till soft and porridge like.

<a id="dish-251"></a>

### #251 Bisi bele bath

**File:** `data/dishes/bisi-bele-bath.md`. **SHA-256:** `687a6ed6d7981bd90a5596ea42fd2cb2bfa96725028b55c0953f8c024f83769c`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Toor Dal; active Yes; preferred No; satiety High; active prep 45 minutes; seasons All; cuisine Indian.

**Description:** Karnataka one pot rice and lentils with vegetables and a special spice blend.

**Ingredients for two:** Toor Dal 60 g; Carrot 60 g; French Bean 60 g; Green Pea 40 g; Tomato 50 g; Cashew 15 g; Curry Leaf 5 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, use 100 g dry rice and the listed 60 g toor dal with 650 ml water; reserve a further 150 ml water for cooking the vegetables and adjusting the final consistency.
2. Cook the rice and toor dal together till soft.
3. Boil the chopped vegetables with tamarind water till tender.
4. Combine rice, dal, vegetables and bisi bele bath masala with water to a thick consistency.
5. Simmer together and finish with a ghee tempering of cashew and curry leaves.

<a id="dish-252"></a>

### #252 Egg pulao

**File:** `data/dishes/egg-pulao.md`. **SHA-256:** `37fb5556c1bb701aaca4874f74959f3c9ab0c330a434cd6092ad71b9625f3dba`.

**Menu:** Complete meal; Lunch; tags complete_meal, HP; primaryIngredient Egg; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Lightly spiced one pot rice with boiled eggs and peas.

**Ingredients for two:** Egg 4 pcs; Onion 80 g; Green Pea 50 g; Tomato 50 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Boil the eggs, peel and halve them.
3. Fry whole spices and onion, add tomato and peas with mild spices.
4. Add soaked rice and water and cook covered till fluffy.
5. Fold the egg halves through gently before serving.

<a id="dish-253"></a>

### #253 Mac and cheese

**File:** `data/dishes/mac-and-cheese.md`. **SHA-256:** `1e2e75e19bcba526c2fad0e52aafe8164165db7dd4949480edab80cf97023bea`.

**Menu:** Complete meal; Lunch; tags none; primaryIngredient Pasta; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Continental.

**Description:** Macaroni in a creamy cheese sauce, a comforting bowl.

**Ingredients for two:** Pasta 120 g; Cheese 60 g; Milk 150 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For the roux, measure 10 g plain flour and 10 g butter with the listed 150 ml milk; cook the flour in the butter for 1 minute before gradually whisking in the milk.
2. Boil the macaroni in salted water till just done and drain.
3. Make a roux with butter and flour, then whisk in the milk to a smooth sauce.
4. Melt in most of the grated cheese with salt, pepper and a little mustard.
5. Fold in the pasta, top with the rest of the cheese and serve hot.

<a id="dish-254"></a>

### #254 White sauce pasta

**File:** `data/dishes/white-sauce-pasta.md`. **SHA-256:** `c3da3fffbcf57f00f09ae8971571db53f81d6469387cd84ac49c7e5f3e44d457`.

**Menu:** Complete meal; Lunch; tags none; primaryIngredient Pasta; active Yes; preferred Yes; satiety High; active prep 25 minutes; seasons All; cuisine Italian.

**Description:** Pasta and vegetables in a creamy white sauce.

**Ingredients for two:** Pasta 120 g; Milk 150 ml; Cheese 40 g; Capsicum 40 g; Sweet Corn 40 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For the roux, measure 10 g plain flour and 10 g butter with the listed 150 ml milk; cook the flour in the butter for 1 minute before gradually whisking in the milk.
2. Boil the pasta till just done and saute the diced capsicum and corn.
3. Make a roux with butter and flour and whisk in the milk to a smooth sauce.
4. Season with salt, pepper, herbs and the grated cheese.
5. Toss the pasta and vegetables through the sauce and serve hot.

<a id="dish-255"></a>

### #255 Cheese quesadilla

**File:** `data/dishes/cheese-quesadilla.md`. **SHA-256:** `83160773d058da97287f026c38aaca40551b0c7efb9145d21b263589771c6927`.

**Menu:** Complete meal; Lunch; tags none; primaryIngredient Tortilla; active Yes; preferred No; satiety High; active prep 15 minutes; seasons All; cuisine Mexican.

**Description:** Tortilla folded over melted cheese and peppers, crisped on a pan.

**Ingredients for two:** Tortilla 2 pcs; Cheese 60 g; Capsicum 40 g; Onion 40 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Saute the diced capsicum and onion till soft.
2. Lay grated cheese and the vegetables over half a tortilla and fold.
3. Toast on a dry pan, pressing, till golden and the cheese melts.
4. Cut into wedges and serve with salsa or curd dip.

<a id="dish-256"></a>

### #256 Bean tacos

**File:** `data/dishes/bean-tacos.md`. **SHA-256:** `1e019bd8372053e5c77b10df70447e1e742a3902af0ca3e60eb641046a47a50e`.

**Menu:** Complete meal; Lunch; tags none; primaryIngredient Kidney Bean; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Mexican.

**Description:** Tortillas filled with spiced beans, crunchy lettuce and tomato.

**Ingredients for two:** Tortilla 3 pcs; Kidney Bean 100 g; Lettuce 40 g; Tomato 50 g; Onion 40 g; Garlic 8 g; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Cook the boiled beans with onion, garlic and chilli till thick, mashing lightly.
2. Warm the tortillas on a pan.
3. Fill with the bean mix, shredded lettuce and chopped tomato.
4. Add a squeeze of lemon and fold to eat.

<a id="dish-257"></a>

### #257 Paneer bhurji keto

**File:** `data/dishes/paneer-bhurji-keto.md`. **SHA-256:** `3217ed392187a89e757d8a40937e1f6b4eec0b8e085f476dcb12502383ed6a5e`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Crumbled paneer scrambled with peppers and onion, a low carb plate.

**Ingredients for two:** Paneer 150 g; Onion 50 g; Capsicum 50 g; Tomato 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Crumble the paneer by hand.
2. Fry onion, green chilli and capsicum till soft, add tomato and cook down.
3. Add turmeric, chilli and salt, then the crumbled paneer.
4. Toss on low heat for a couple of minutes and finish with coriander.

<a id="dish-258"></a>

### #258 Keto chicken stir fry

**File:** `data/dishes/keto-chicken-stir-fry.md`. **SHA-256:** `1ec55623184d9f0b65b5794e1f48521d53a6518b28b1aefa37b9ecfa688fb41b`.

**Menu:** Keto; Lunch; tags HP; primaryIngredient Chicken Breast; active Yes; preferred No; satiety High; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Strips of chicken breast tossed with broccoli and peppers, low carb.

**Ingredients for two:** Chicken Breast 200 g; Broccoli 100 g; Capsicum 60 g; Garlic 10 g; Lemon 0.5 pcs.

**Pre-prep:** None recorded. **Purchase note:** Boneless chicken breast, 200g.

**Recipe:**

1. Slice the chicken breast into thin strips and season with salt and pepper.
2. Sear the chicken on high heat till just cooked and set aside.
3. Stir fry the garlic, broccoli and capsicum till crisp tender.
4. Return the chicken, toss together and finish with a squeeze of lemon.

<a id="dish-259"></a>

### #259 Sweet corn salad

**File:** `data/dishes/sweet-corn-salad.md`. **SHA-256:** `0b2937e50764f288c922ec60decae9db3167616835ec99b170369d105fc6cdfc`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Sweet Corn; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Bright salad of sweet corn, peppers and cucumber with a lemon dressing.

**Ingredients for two:** Sweet Corn 150 g; Capsicum 50 g; Onion 40 g; Cucumber 50 g; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the corn till tender and cool.
2. Finely dice the capsicum, onion and cucumber.
3. Toss everything with lemon juice, salt, pepper and chilli flakes.
4. Chill briefly and serve.

<a id="dish-260"></a>

### #260 Moong dal kosambari

**File:** `data/dishes/moong-dal-kosambari.md`. **SHA-256:** `bf2ae5f17628778c12dc5a4b0af0fb05ce2dc8a570caa974b15ab845a2167d0d`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Moong Dal; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** South Indian salad of soaked moong dal with cucumber and carrot.

**Ingredients for two:** Moong Dal 60 g; Cucumber 80 g; Carrot 40 g; Coriander Leaf 10 g; Lemon 0.5 pcs; Curry Leaf 3 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Soak the moong dal for an hour till softened, then drain well.
2. Finely chop the cucumber and grate the carrot.
3. Mix with the dal, salt, lemon and coriander.
4. Finish with a light mustard and curry leaf tempering.

<a id="dish-261"></a>

### #261 Cucumber raita

**File:** `data/dishes/cucumber-raita.md`. **SHA-256:** `2c67904ebe9a71c498847c1159295a6cd4a14de921337d95c5d4e30dd6a070b0`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Curd; active Yes; preferred No; satiety Low; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** Cooling whisked curd with grated cucumber and roasted cumin.

**Ingredients for two:** Cucumber 100 g; Curd 150 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Grate the cucumber and gently squeeze out excess water.
2. Whisk the curd smooth with a little salt.
3. Fold in the cucumber and roasted cumin powder.
4. Chill and serve.

<a id="dish-262"></a>

### #262 Tomato soup

**File:** `data/dishes/tomato-soup.md`. **SHA-256:** `84896315f02fbf2a050517e56c7c900fd43b2a588a6a46f4f8acb64ecf5064a6`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Tomato; active Yes; preferred No; satiety Low; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Smooth slow simmered tomato soup with a touch of garlic.

**Ingredients for two:** Tomato 250 g; Garlic 10 g; Onion 40 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Simmer chopped tomato, onion and garlic with a bay leaf and water till soft.
2. Blend smooth and strain back into the pan.
3. Season with salt, pepper and a pinch of sugar and warm through.
4. Finish with a swirl of butter or cream.

<a id="dish-263"></a>

### #263 Sweet corn soup

**File:** `data/dishes/sweet-corn-soup.md`. **SHA-256:** `2418c6d0f138374e29c5faced0e89390a97e3eaf71d886a9a5b7bbff94313c01`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Sweet Corn; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Chinese.

**Description:** Thick Indo Chinese sweet corn soup with finely diced vegetables.

**Ingredients for two:** Sweet Corn 150 g; Carrot 40 g; Cornflour 15 g; Spring Onion 20 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Coarsely blend half the corn and keep the rest whole.
2. Simmer all the corn and finely diced carrot in water or stock.
3. Stir in a cornflour slurry and cook till the soup thickens.
4. Season with salt, pepper and vinegar and top with spring onion.

<a id="dish-264"></a>

### #264 Hot and sour soup

**File:** `data/dishes/hot-and-sour-soup.md`. **SHA-256:** `d7192b3722e34cae2ac21e4cd082fc1e00c6feb2f29d9a29b50049975bc3e454`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Cabbage; active Yes; preferred No; satiety Low; active prep 25 minutes; seasons All; cuisine Chinese.

**Description:** Tangy peppery Indo Chinese soup with shredded vegetables and mushroom.

**Ingredients for two:** Cabbage 60 g; Carrot 40 g; Mushroom 50 g; Capsicum 40 g; Cornflour 15 g; Soy Sauce 15 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Finely shred the cabbage, carrot, capsicum and mushroom.
2. Saute the vegetables briefly in oil, then add stock and bring to a simmer.
3. Season with soy sauce, vinegar, salt and plenty of pepper.
4. Thicken with a cornflour slurry till glossy.

<a id="dish-265"></a>

### #265 Lemon coriander soup

**File:** `data/dishes/lemon-coriander-soup.md`. **SHA-256:** `83543a28634b006f1193b4ca44d499892d9dae5d0fcb426dc2d2760b5faef674`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Coriander Leaf; active Yes; preferred No; satiety Low; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Light tangy clear soup of vegetables, coriander and lemon.

**Ingredients for two:** Carrot 40 g; Cabbage 40 g; Coriander Leaf 15 g; Lemon 1 pcs; Garlic 8 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Finely chop the carrot and cabbage and saute with garlic.
2. Add stock or water and simmer till the vegetables are just tender.
3. Stir in chopped coriander, salt and pepper.
4. Take off the heat and add lemon juice to taste.

<a id="dish-266"></a>

### #266 Fattoush

**File:** `data/dishes/fattoush.md`. **SHA-256:** `809955d858be372cbbc800d95690850e78522bbda06f8446e747e62637de8d8e`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Lettuce; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Lebanese.

**Description:** Lebanese chopped salad with crisp toasted bread and a lemony dressing.

**Ingredients for two:** Lettuce 80 g; Cucumber 60 g; Tomato 60 g; Bread 1 pcs; Mint Leaf 10 g; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Toast or crisp the bread and break into pieces.
2. Chop the lettuce, cucumber, tomato and mint.
3. Whisk a dressing of olive oil, lemon, salt and sumac if you have it.
4. Toss everything together and add the bread just before serving so it stays crisp.

<a id="dish-267"></a>

### #267 Lentil salad

**File:** `data/dishes/lentil-salad.md`. **SHA-256:** `e108ee383c67eabc439de2849fc73189b074a6e6f1e20511a88e445cc9097f1f`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Masoor Dal; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Mediterranean.

**Description:** Whole lentils tossed with cucumber, tomato and a lemon herb dressing.

**Ingredients for two:** Masoor Dal 80 g; Cucumber 60 g; Tomato 60 g; Parsley 10 g; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the whole lentils till just tender, keeping them firm, then cool.
2. Dice the cucumber and tomato and chop the parsley.
3. Whisk olive oil, lemon, salt and pepper into a dressing.
4. Toss everything together and rest a few minutes before serving.

<a id="dish-268"></a>

### #268 Gobi manchurian

**File:** `data/dishes/gobi-manchurian.md`. **SHA-256:** `d151ac9397cb238779db37ea1f67199779b05c9267e2d9c9e505fea887a7dcf2`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Cauliflower; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons All; cuisine Chinese.

**Description:** Crisp fried cauliflower tossed in a spicy garlic Indo Chinese sauce.

**Ingredients for two:** Cauliflower 200 g; Cornflour 30 g; Capsicum 50 g; Spring Onion 30 g; Garlic 10 g; Soy Sauce 15 ml; Chilli Sauce 15 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For the batter, combine the listed 30 g cornflour with 20 g plain flour and 60 ml water; add up to 20 ml more for a coating that clings to the florets.
2. Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.
3. Coat the cauliflower florets in a cornflour and flour batter and fry till crisp.
4. Stir fry garlic, capsicum and spring onion whites on high heat.
5. Add soy sauce, chilli sauce and a splash of water and bring to a glaze.
6. Toss in the fried cauliflower, coat quickly and top with spring onion greens.

<a id="dish-269"></a>

### #269 Vegetable omelette

**File:** `data/dishes/vegetable-omelette.md`. **SHA-256:** `c4c3adbc6ab8d2721013d383c3a504836e42a26a1c1883ade33b5f6fbbe744d1`.

**Menu:** Dry dish; Breakfast; tags HP; primaryIngredient Egg; active Yes; preferred No; satiety High; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** Fluffy omelette loaded with onion, tomato and capsicum.

**Ingredients for two:** Egg 3 pcs; Onion 40 g; Tomato 40 g; Capsicum 40 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Beat the eggs with salt and pepper.
2. Mix in the finely chopped onion, tomato, capsicum and green chilli.
3. Pour onto a hot greased pan and spread evenly.
4. Cook on low till set, fold and serve hot.

<a id="dish-270"></a>

### #270 Mango lassi

**File:** `data/dishes/mango-lassi.md`. **SHA-256:** `5a2c7f5d50432d02f98a36610a87663da57b632d56c08419e78b17a41f258f7a`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Mango; active Yes; preferred No; satiety Low; active prep 10 minutes; seasons ['Summer']; cuisine Indian.

**Description:** Thick blended curd and mango drink, a cooling summer treat.

**Ingredients for two:** Mango 150 g; Curd 150 g; Milk 50 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel the ripe mango and chop the flesh.
2. Blend the mango with chilled curd and milk till smooth.
3. Sweeten lightly only if needed and add a pinch of cardamom.
4. Pour over and serve chilled.

<a id="dish-271"></a>

### #271 Besan chilla

**File:** `data/dishes/besan-chilla.md`. **SHA-256:** `a2220e32c72fa8a4af000fc5f1139d1426c87bab71d40fbbcc811a03d5575e59`.

**Menu:** Chilla; Breakfast; tags complete_carb; primaryIngredient Onion; active Yes; preferred No; satiety Medium; active prep 20 minutes; seasons All; cuisine Indian.

**Description:** Savoury gram flour pancakes with onion, tomato and coriander.

**Ingredients for two:** Onion 50 g; Tomato 50 g; Green Chilli 2 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four small chillas (two portions), use 100 g besan and 150 ml water; add up to 30 ml more if needed for a spreadable batter.
2. Whisk besan with water, salt and turmeric into a smooth pouring batter.
3. Stir in finely chopped onion, tomato, green chilli and coriander.
4. Ladle onto a hot greased tawa and spread into a thin round.
5. Cook both sides on medium heat till set and lightly browned.

<a id="dish-272"></a>

### #272 Steamed rice

**File:** `data/dishes/steamed-rice.md`. **SHA-256:** `69f19031648fb8b2f3c2045bac310bb93de5ffc9f3f85e92456dc31ee861de74`.

**Menu:** Rice; Lunch; tags cuisine_neutral; primaryIngredient Rice; active Yes; preferred No; satiety Low; active prep 15 minutes; seasons All; cuisine Indian.

**Description:** Plain steamed basmati rice with no tempering, the simplest base for any gravy or dal.

**Ingredients for two:** Empty table (pantry-only dish).

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing.
2. Rinse and soak basmati rice for 15 minutes, then drain.
3. Bring the rice to a boil with measured water and a little salt.
4. Cover and cook on low until the water is absorbed.
5. Rest off the heat for five minutes, then fluff with a fork.

<a id="dish-273"></a>

### #273 Avocado toast

**File:** `data/dishes/avocado-toast.md`. **SHA-256:** `5e929b19fe4b5492c46115fbf0d03f9045987795b6b87fc04a8e88e9b58ae47e`.

**Menu:** Bread; Breakfast; tags complete_carb; primaryIngredient Avocado; active Yes; preferred Yes; satiety Medium; active prep 10 minutes; seasons All; cuisine Indian.

**Description:** Toasted sourdough topped with smashed avocado, lemon and chilli flakes, a quick filling breakfast.

**Ingredients for two:** Bread 4 pcs; Avocado 150 g; Lemon 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Toast the bread slices until golden and crisp.
2. Scoop the avocado into a bowl, squeeze in the lemon, season with salt and mash to a coarse spread.
3. Spread the smashed avocado thickly over the warm toast.
4. Scatter chilli flakes over the top and serve at once.

<a id="dish-274"></a>

### #274 Mango bowl

**File:** `data/dishes/mango-bowl.md`. **SHA-256:** `ac6910f858877e7b5d96b6573627a71748db4c520d85a7d9a9d045a1d1a00443`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Mango; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons ['Summer', 'Monsoon']; cuisine Indian.

**Description:** Cubed ripe mango to eat alongside breakfast, sweet and juicy.

**Ingredients for two:** Mango 200 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel the mango and cut the flesh off the stone into cubes.
2. Serve fresh in a bowl alongside the breakfast main.

<a id="dish-275"></a>

### #275 Litchi bowl

**File:** `data/dishes/litchi-bowl.md`. **SHA-256:** `485aecf673f5d42b803e5c1e7ae8ec9406aa7477238094996e1ceb861e0a3adc`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Litchi; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons ['Summer', 'Monsoon']; cuisine Indian.

**Description:** Peeled fresh litchis to eat alongside breakfast, light and fragrant.

**Ingredients for two:** Litchi 150 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel the litchis and remove the seeds.
2. Serve fresh in a bowl alongside the breakfast main.

<a id="dish-276"></a>

### #276 Jamun bowl

**File:** `data/dishes/jamun-bowl.md`. **SHA-256:** `c091b094a4208155b29bf2a20fbb0ba6dc5232552aea6b4439ef47e26439f68d`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Jamun; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons ['Monsoon']; cuisine Indian.

**Description:** Fresh jamun to eat alongside breakfast, a tangy-sweet monsoon fruit.

**Ingredients for two:** Jamun 150 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Rinse the jamun well and pat dry.
2. Serve fresh in a bowl alongside the breakfast main, eating the flesh off the seed.

<a id="dish-277"></a>

### #277 Plum bowl

**File:** `data/dishes/plum-bowl.md`. **SHA-256:** `92bf9eed9e660e66fb37acaf17a6590226ad0c8008f23d824e41c9ecf31095d0`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Plum; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons ['Monsoon']; cuisine Indian.

**Description:** Sliced ripe plums to eat alongside breakfast, juicy and slightly tart.

**Ingredients for two:** Plum 200 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Rinse the plums, halve them and remove the stones.
2. Slice into a bowl and serve fresh alongside the breakfast main.

<a id="dish-278"></a>

### #278 Peach bowl

**File:** `data/dishes/peach-bowl.md`. **SHA-256:** `6f6f2251767a33485838d13bf9c71036d26eaee1ced3c94ab51fb1920460b690`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Peach; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons ['Monsoon']; cuisine Indian.

**Description:** Sliced ripe peaches to eat alongside breakfast, soft and sweet.

**Ingredients for two:** Peach 200 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Rinse the peaches, halve them and remove the stones.
2. Slice into a bowl and serve fresh alongside the breakfast main.

<a id="dish-279"></a>

### #279 Pineapple bowl

**File:** `data/dishes/pineapple-bowl.md`. **SHA-256:** `b714d3af4555d3178b2f8699d98015573fe4250f0c88d7b4e4464b21363df6db`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Pineapple; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons ['Monsoon']; cuisine Indian.

**Description:** Cubed fresh pineapple to eat alongside breakfast, juicy and tangy.

**Ingredients for two:** Pineapple 200 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Peel the pineapple, remove the core and cut into bite-size cubes.
2. Serve fresh in a bowl alongside the breakfast main.

<a id="dish-280"></a>

### #280 Pomegranate bowl

**File:** `data/dishes/pomegranate-bowl.md`. **SHA-256:** `d6f5c229ea171bc1330cd5d30f7343dc6e4c453b26d3941f19a34d8fcbc485d2`.

**Menu:** Fruit; Breakfast; tags fruit; primaryIngredient Pomegranate; active Yes; preferred Yes; satiety Low; active prep 5 minutes; seasons ['Monsoon', 'Winter']; cuisine Indian.

**Description:** Fresh pomegranate arils to eat alongside breakfast, crisp and jewel-like.

**Ingredients for two:** Pomegranate 150 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Halve the pomegranate and tap out the arils into a bowl.
2. Serve fresh alongside the breakfast main.

<a id="dish-281"></a>

### #281 Pav

**File:** `data/dishes/pav.md`. **SHA-256:** `44bde3e9d621044f8031f44f3adc68ed5bef07a145bac8a7d3e8dd1c5fe312f5`.

**Menu:** Bread; Lunch; tags none; primaryIngredient Pav Bread; active Yes; preferred No; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Soft buttered ladi pav, the simplest bread side for keema or bhaji.

**Ingredients for two:** Pav Bread 4 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Slit each pav part way through, keeping the rolls joined.
2. Warm a little butter on a tawa and toast the pav cut-side down till golden.
3. Serve hot alongside keema or bhaji.

<a id="dish-282"></a>

### #282 Beetroot roti

**File:** `data/dishes/beetroot-roti.md`. **SHA-256:** `a72be0296c5f3eb1623fa5d0e7cc55b8c7dbe7e8b7df863c13aa085027a8859c`.

**Menu:** Chapati; Lunch; tags none; primaryIngredient Beetroot; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Soft wheat flatbreads kneaded with grated beetroot, earthy and a deep pink.

**Ingredients for two:** Beetroot 100 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For four small rotis (two portions), use 150 g whole-wheat atta with the listed grated beetroot; start with 60 ml water and add up to 30 ml more as the beetroot releases moisture.
2. Grate the beetroot fine and knead it into wheat flour with salt, a little oil and water to a soft dough, then rest 15 minutes.
3. Divide and roll each ball into a round, dusting with flour.
4. Cook on a hot tawa, flipping once bubbles appear.
5. Puff on a low flame and brush with ghee.

<a id="dish-283"></a>

### #283 Cucumber tomato salad

**File:** `data/dishes/cucumber-tomato-salad.md`. **SHA-256:** `d05abc2e0d01ea39236e1c90d56a0c820c89d86332bbdc424849fff2609951af`.

**Menu:** Accompaniment; Lunch; tags none; primaryIngredient Cucumber; active Yes; preferred No; satiety Low; active prep 5 minutes; seasons All; cuisine Indian.

**Description:** Diced cucumber and tomato tossed with onion, lemon and coriander, a cooling lunch side.

**Ingredients for two:** Cucumber 150 g; Tomato 150 g; Onion 50 g; Lemon 1 pcs; Coriander Leaf 10 g; Green Chilli 1 pcs.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Dice the cucumber, tomato and onion fine and slit the green chilli.
2. Toss with lemon juice and salt.
3. Fold in the coriander and serve fresh.

<a id="dish-284"></a>

### #284 Red sauce pasta

**File:** `data/dishes/red-sauce-pasta.md`. **SHA-256:** `8ac18642828e37b38d5efc0285f8d3eab3957730995b19627a4ab905f1010d63`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Pasta; active Yes; preferred No; satiety High; active prep 25 minutes; seasons All; cuisine Italian.

**Description:** Pasta tossed in a spicy tomato, onion and garlic red sauce with capsicum.

**Ingredients for two:** Pasta 150 g; Tomato 300 g; Onion 80 g; Garlic 10 g; Capsicum 60 g; Olive Oil 20 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Boil the pasta in salted water till just firm and drain.
2. Soften chopped garlic and onion in olive oil till fragrant.
3. Add chopped tomato and cook down to a thick spicy sauce with chilli flakes, oregano and salt.
4. Stir in the capsicum and cook briefly so it keeps a slight crunch.
5. Toss the pasta through the sauce till well coated and serve hot.

<a id="dish-285"></a>

### #285 Dosa

**File:** `data/dishes/dosa.md`. **SHA-256:** `ce2850ff1f4ae3ec902d376ea40fba1567cba6a52b00e695fe2678a95f1f0265`.

**Menu:** Complete meal; Lunch; tags complete_meal; primaryIngredient Rice; active Yes; preferred No; satiety Medium; active prep 30 minutes; seasons All; cuisine Indian.

**Description:** Thin crisp South Indian crepe of fermented rice and lentil batter, served with sambar.

**Ingredients for two:** Urad Dal 60 g.

**Pre-prep:** Soak the rice and urad dal overnight, grind to a batter and leave it to ferment. **Purchase note:** None recorded.

**Recipe:**

1. For two portions (about six small dosas), use 180 g dry rice with the listed 60 g dry urad dal; start grinding with 180 ml fresh water and add up to 120 ml more gradually to reach a pouring batter.
2. Soak rice and urad dal separately for six hours, then grind each to a smooth batter.
3. Mix the two with salt and leave covered overnight to ferment and rise.
4. Thin the batter with water to a pouring consistency.
5. Pour a ladle onto a hot greased tawa and spread it outward into a thin round.
6. Drizzle oil at the edges and cook until the underside is golden and crisp, then fold and serve.

<a id="dish-286"></a>

### #286 Atta halva

**File:** `data/dishes/atta-halva.md`. **SHA-256:** `b7c7e65123197a9711e3e588873c8304c17afd5edbfe245c1e87e645266d5c17`.

**Menu:** Dessert; Lunch; tags none; primaryIngredient Wheat Flour; active Yes; preferred No; satiety Medium; active prep 25 minutes; seasons All; cuisine Indian.

**Description:** Wheat flour slow roasted in ghee and cooked with sugar syrup into a soft dark halva.

**Ingredients for two:** Cashew 20 g; Raisin 15 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. For two dessert portions, use 60 g whole-wheat atta, 40 g ghee, 50 g sugar and 180 ml water; dissolve the sugar in the hot water to make the syrup.
2. Melt ghee in a heavy kadhai and add the wheat flour.
3. Roast on low heat, stirring constantly, until the flour turns deep brown and smells nutty.
4. Fry the cashews and raisins alongside, keeping a few back for the top.
5. Pour in hot sugar syrup carefully, stirring hard so no lumps form.
6. Cook until the halva thickens, pulls away from the pan and releases its ghee, then serve warm.

<a id="dish-287"></a>

### #287 Paneer manchurian

**File:** `data/dishes/paneer-manchurian.md`. **SHA-256:** `f89d45e1da5f3bfb3a52607770387106e3de2983bada1157d0ac56bc8cba0d9b`.

**Menu:** Dry dish; Lunch; tags HP; primaryIngredient Paneer; active Yes; preferred No; satiety High; active prep 30 minutes; seasons All; cuisine Chinese.

**Description:** Crisp cornflour-coated paneer tossed in a garlicky Indo Chinese manchurian sauce.

**Ingredients for two:** Paneer 250 g; Cornflour 30 g; Capsicum 50 g; Spring Onion 30 g; Garlic 10 g; Soy Sauce 15 ml; Chilli Sauce 15 g; White Vinegar 10 ml.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.
2. Cube the paneer, coat it in cornflour seasoned with salt and pepper, and shallow fry till golden.
3. Stir fry garlic, capsicum and spring onion whites on high heat for a minute.
4. Add soy sauce, chilli sauce, a splash of white vinegar and a little water, and cook to a glaze.
5. Toss in the paneer so every cube is coated, keeping the pan dry.
6. Finish with the spring onion greens and serve hot.

<a id="dish-288"></a>

### #288 Stuffed capsicum

**File:** `data/dishes/stuffed-capsicum.md`. **SHA-256:** `6326ee35121e6c9d2c14cf1fe3bb57edc79fb98545f1083244da41ae8355051e`.

**Menu:** Dry dish; Lunch; tags none; primaryIngredient Capsicum; active Yes; preferred No; satiety Medium; active prep 35 minutes; seasons All; cuisine Indian.

**Description:** Whole capsicums hollowed out, packed with a spiced potato filling and pan cooked till tender.

**Ingredients for two:** Capsicum 250 g; Potato 200 g; Onion 60 g; Green Chilli 1 pcs; Coriander Leaf 10 g.

**Pre-prep:** None recorded. **Purchase note:** None recorded.

**Recipe:**

1. Slice the tops off the capsicums, hollow them out and remove the seeds.
2. Mash the boiled potato with sauteed onion, green chilli, coriander, amchur, turmeric and salt.
3. Pack the filling firmly into each capsicum.
4. Set them upright in a wide pan with a little oil, cover and cook on low heat.
5. Turn them now and then until the skins blister and soften all round, then serve.

## Current ingredient catalog evidence

All macros below are per 100 g; ml conversion still uses the documented 1:1 approximation, and pcs uses grams per piece. Blank means unknown/unspecified, not a verified zero. New source-backed profiles remain product examples, not a guarantee that the household buys that exact product.

| Ingredient                 | Unit | Group               | Pack  | g/piece | Protein | Carbs | Fat | Fibre | Special | Current dish IDs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | ---- | ------------------- | ----- | ------: | ------: | ----: | --: | ----: | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avocado                    | g    | Vegetables          |       |         |       2 |     9 |  15 |     7 | No      | 200, 273                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Banana                     | pcs  | Fruit               |       |     120 |     1.1 |    23 | 0.3 |   2.6 | No      | 131, 154                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Basil                      | g    | Aromatics and Herbs |       |         |         |       |     |       | No      | 160, 161, 163, 169, 170, 172, 173, 178, 183, 205                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Bean Sprout                | g    | Vegetables          |       |         |       3 |     6 | 0.2 |   1.8 | No      | 162, 211                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Beetroot                   | g    | Vegetables          |       |         |     1.6 |    10 | 0.2 |   2.8 | No      | 282                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Bhindi                     | g    | Vegetables          |       |         |     1.9 |     7 | 0.2 |   3.2 | No      | 21, 232                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Bitter Gourd               | g    | Vegetables          |       |         |       1 |     4 | 0.2 |   2.8 | No      | 138                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Black Urad Dal             | g    | Pantry              |       |         |      25 |    59 | 1.6 |    18 | No      | 100                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Bottle Gourd               | g    | Vegetables          |       |         |     0.6 |     4 |   0 |   0.5 | No      | 72, 136                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Bread                      | pcs  | Pantry              |       |      30 |       9 |    49 | 3.2 |   2.7 | No      | 33, 35, 40, 85, 86, 87, 109, 156, 157, 266, 273                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Brinjal                    | g    | Vegetables          |       |         |       1 |     6 | 0.2 |     3 | No      | 205, 226, 227, 237                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Broccoli                   | g    | Vegetables          |       |         |     2.8 |     7 | 0.4 |   2.6 | No      | 26, 182, 190, 193, 206, 229, 258                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Bulgur Wheat               | g    | Pantry              |       |         |      12 |    76 | 1.3 |    18 | Yes     | 176, 250                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Cabbage                    | g    | Vegetables          |       |         |     1.3 |     6 | 0.1 |   2.5 | No      | 23, 48, 164, 165, 167, 180, 192, 223, 264, 265                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Capsicum                   | g    | Vegetables          |       |         |       1 |     6 | 0.3 |   2.1 | No      | 4, 13, 25, 31, 35, 60, 62, 76, 78, 81, 85, 98, 117, 120, 121, 134, 135, 140, 143, 160, 161, 163, 164, 165, 166, 167, 168, 177, 178, 179, 180, 181, 182, 184, 186, 187, 188, 195, 196, 198, 204, 205, 207, 228, 231, 241, 246, 249, 254, 255, 257, 258, 259, 264, 268, 269, 284, 287, 288                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Carrot                     | g    | Vegetables          |       |         |     0.9 |    10 | 0.2 |   2.8 | No      | 24, 31, 39, 48, 49, 56, 81, 82, 94, 134, 135, 139, 153, 164, 165, 166, 167, 185, 190, 191, 192, 194, 206, 207, 211, 223, 224, 225, 237, 243, 246, 248, 249, 250, 251, 260, 263, 264, 265                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Cashew                     | g    | Pantry              |       |         |      18 |    30 |  44 |   3.3 | No      | 5, 53, 54, 59, 101, 102, 130, 132, 134, 139, 144, 146, 147, 148, 179, 240, 251, 286                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Cauliflower                | g    | Vegetables          |       |         |     1.9 |     5 | 0.3 |     2 | No      | 22, 37, 98, 206, 268                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Chana Dal                  | g    | Pantry              |       |         |      20 |    60 |   6 |    13 | No      | 68, 72, 236                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Cheese                     | g    | Proteins and Dairy  |       |         |      25 |   1.3 |  33 |     0 | No      | 87, 172, 182, 188, 189, 198, 206, 253, 254, 255                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Chicken                    | g    | Proteins and Dairy  |       |         |      27 |     0 |  14 |     0 | No      | 1, 2, 40, 43, 54, 55, 56, 95, 117, 120, 161, 166, 168, 187, 192, 197, 198, 209, 212, 213, 244                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Chicken Breast             | g    | Proteins and Dairy  | 250 g |         |      31 |     0 | 3.6 |     0 | No      | 104, 113, 124, 190, 258                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Chicken Keema              | g    | Proteins and Dairy  | 500 g |         |      17 |     0 |  20 |     0 | No      | 14, 125, 126, 163                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Chickpea                   | g    | Pantry              |       |         |      19 |    61 |   6 |    17 | No      | 6, 45, 50, 174, 175, 196, 203, 247                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Chilli Sauce               | g    | Pantry              |       |         |     1.5 |    33 | 1.2 |   3.7 | No      | 121, 162, 165, 167, 168, 268, 287                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Coconut Milk               | ml   | Pantry              |       |         |     2.3 |     6 |  21 |     0 | No      | 19, 20, 56, 147, 160, 161, 243                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Coriander Leaf             | g    | Aromatics and Herbs |       |         |         |       |     |       | No      | 1, 6, 8, 11, 12, 13, 14, 15, 19, 20, 22, 24, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 54, 55, 57, 58, 59, 60, 61, 63, 64, 65, 66, 67, 68, 69, 72, 73, 75, 76, 80, 81, 82, 85, 86, 90, 91, 94, 95, 96, 98, 99, 100, 101, 102, 106, 110, 124, 125, 126, 127, 128, 133, 134, 135, 136, 137, 142, 149, 151, 152, 153, 156, 157, 158, 159, 171, 175, 177, 186, 187, 188, 198, 199, 200, 211, 217, 218, 219, 221, 226, 230, 234, 238, 239, 257, 260, 265, 271, 283, 288                                                                                                                                                                                                                                                                   |
| Cornflour                  | g    | Pantry              |       |         |     0.3 |    91 | 0.1 |   0.9 | No      | 101, 121, 131, 167, 168, 181, 263, 264, 268, 287                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Couscous                   | g    | Pantry              |       |         |      13 |    77 | 0.6 |     5 | No      | 196                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Cucumber                   | g    | Vegetables          |       |         |     0.7 |     4 | 0.1 |   0.5 | No      | 35, 40, 42, 43, 44, 45, 46, 48, 49, 52, 86, 124, 127, 128, 195, 196, 197, 204, 211, 214, 259, 260, 261, 266, 267, 283                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Curd                       | g    | Proteins and Dairy  | 500 g |         |     3.5 |     5 | 3.3 |     0 | No      | 1, 8, 16, 35, 50, 52, 54, 90, 95, 117, 118, 134, 140, 143, 144, 197, 214, 215, 217, 221, 240, 261, 270                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Curry Leaf                 | g    | Aromatics and Herbs |       |         |         |       |     |       | No      | 8, 16, 17, 18, 19, 20, 29, 31, 34, 56, 63, 82, 112, 120, 137, 141, 147, 157, 158, 220, 223, 225, 237, 238, 242, 243, 251, 260                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Egg                        | pcs  | Proteins and Dairy  |       |      50 |      13 |   1.1 |  11 |     0 | No      | 12, 30, 33, 57, 58, 96, 127, 142, 158, 162, 164, 166, 177, 179, 191, 194, 201, 208, 234, 242, 252, 269                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Fenugreek Leaf             | g    | Vegetables          |       |         |     4.4 |     6 | 0.9 |   1.1 | No      | 90, 91, 222, 244                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Feta                       | g    | Proteins and Dairy  | 200 g |         |      14 |     4 |  21 |     0 | No      | 195, 196                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Fish                       | g    | Proteins and Dairy  | 500 g |         |      20 |     0 |   5 |     0 | No      | 19, 77, 118                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Flattened Rice             | g    | Pantry              |       |         |       7 |    77 | 1.2 |   2.4 | No      | 29                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| French Bean                | g    | Vegetables          |       |         |     1.8 |     7 | 0.2 |   2.7 | No      | 27, 31, 70, 81, 94, 134, 135, 160, 161, 166, 178, 190, 206, 225, 237, 243, 246, 251                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Fruit                      | pcs  | Fruit               |       |         |         |       |     |       | No      | 123                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Garlic                     | g    | Aromatics and Herbs |       |         |         |       |     |       | No      | 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 14, 19, 20, 26, 50, 54, 55, 56, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 72, 73, 74, 75, 76, 77, 78, 94, 95, 96, 98, 99, 100, 101, 102, 111, 112, 113, 117, 118, 120, 121, 126, 134, 137, 140, 141, 143, 148, 149, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 174, 175, 177, 178, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 192, 193, 197, 198, 199, 202, 203, 204, 205, 206, 207, 208, 209, 212, 213, 214, 217, 218, 219, 220, 221, 226, 228, 229, 230, 233, 235, 236, 238, 244, 245, 246, 247, 248, 256, 258, 262, 265, 268, 284, 287                                                                                                                                                                |
| Ginger                     | g    | Aromatics and Herbs |       |         |         |       |     |       | No      | 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25, 27, 36, 37, 38, 39, 50, 51, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 74, 75, 76, 77, 78, 80, 81, 82, 90, 91, 94, 95, 96, 98, 99, 100, 101, 102, 106, 110, 113, 117, 118, 120, 125, 126, 134, 135, 136, 137, 140, 141, 142, 143, 147, 148, 149, 152, 158, 159, 160, 161, 167, 181, 193, 194, 209, 217, 218, 219, 220, 221, 226, 230, 236, 243, 244, 245, 247, 248                                                                                                                                                                                                                                                                                                   |
| Gochujang                  | g    | Pantry              |       |         |       6 |    35 |   2 |     4 | Yes     | 191, 192, 208                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Green Chilli               | pcs  | Aromatics and Herbs |       |       5 |         |       |     |       | No      | 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39, 42, 45, 46, 47, 49, 50, 51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 74, 75, 76, 78, 79, 80, 81, 82, 86, 90, 91, 94, 95, 96, 99, 100, 101, 102, 106, 110, 112, 121, 125, 126, 133, 134, 135, 136, 137, 138, 141, 142, 147, 149, 151, 152, 153, 156, 157, 158, 159, 163, 168, 175, 200, 212, 217, 218, 219, 220, 221, 222, 223, 225, 226, 229, 230, 234, 235, 239, 241, 242, 243, 257, 269, 271, 283, 288                                                                                                                                                                                        |
| Green Pea                  | g    | Pantry              |       |         |       5 |    14 | 0.4 |     5 | No      | 9, 14, 23, 39, 61, 69, 80, 81, 82, 94, 98, 126, 134, 135, 182, 194, 199, 219, 224, 226, 243, 245, 246, 248, 250, 251, 252                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Honey                      | g    | Pantry              |       |         |     0.3 |    82 |   0 |   0.2 | No      | 209, 212, 215                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Jamun                      | g    | Fruit               |       |         |     0.7 |    14 | 0.2 |   0.6 | No      | 276                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Kidney Bean                | g    | Pantry              |       |         |      24 |    60 | 0.8 |    15 | No      | 99, 100, 186, 188, 198, 256                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Lemon                      | pcs  | Aromatics and Herbs |       |      60 |         |       |     |       | No      | 15, 17, 29, 31, 34, 42, 43, 44, 45, 46, 47, 48, 49, 77, 86, 98, 104, 110, 113, 117, 118, 120, 124, 127, 128, 133, 140, 141, 143, 155, 162, 174, 176, 184, 185, 186, 187, 190, 195, 196, 197, 198, 200, 211, 213, 216, 256, 258, 259, 260, 265, 266, 267, 273, 283                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Lemongrass                 | g    | Aromatics and Herbs |       |         |         |       |     |       | No      | 212                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Lettuce                    | g    | Vegetables          | 100 g |         |     1.4 |     3 | 0.2 |   1.3 | No      | 40, 43, 44, 86, 124, 127, 128, 256, 266                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Litchi                     | g    | Fruit               |       |         |     0.8 |  16.5 | 0.4 |   1.3 | No      | 275                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Mango                      | g    | Fruit               |       |         |     0.8 |    15 | 0.4 |   1.6 | No      | 145, 216, 270, 274                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Masoor Dal                 | g    | Pantry              |       |         |      25 |    60 | 1.1 |    11 | No      | 66, 185, 236, 267                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Milk                       | ml   | Proteins and Dairy  |       |         |     3.4 |     5 | 3.3 |     0 | No      | 53, 131, 132, 139, 144, 145, 146, 189, 206, 253, 254, 270                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Mint Leaf                  | g    | Aromatics and Herbs |       |         |         |       |     |       | No      | 80, 81, 94, 95, 96, 110, 126, 134, 149, 159, 175, 176, 211, 214, 221, 266                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Miso Paste                 | g    | Pantry              |       |         |      12 |    26 |   6 |     5 | Yes     | 210                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Moong Dal                  | g    | Pantry              |       |         |      24 |    59 | 1.2 |    16 | No      | 15, 65, 146, 152, 235, 236, 260                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Mozzarella                 | g    | Proteins and Dairy  | 200 g |         |      22 |   2.2 |  22 |     0 | No      | 173, 183                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Mushroom                   | g    | Vegetables          | 200 g |         |     3.1 |   3.3 | 0.3 |     1 | No      | 9, 10, 11, 189, 191, 207, 208, 231, 264                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Mutton                     | g    | Proteins and Dairy  |       |         |      25 |     0 |  21 |     0 | No      | 217, 218, 219, 220, 221                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Noodles                    | g    | Pantry              |       |         |      12 |    71 | 1.4 |   2.4 | No      | 165, 180                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Oats                       | g    | Pantry              |       |         |      13 |    67 |   7 |    10 | No      | 39, 153                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Olive Oil                  | ml   | Pantry              |       |         |       0 |     0 | 100 |     0 | No      | 169, 170, 171, 172, 173, 174, 176, 182, 183, 184, 185, 189, 190, 195, 196, 197, 201, 202, 203, 204, 205, 213, 214, 284                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Onion                      | g    | Aromatics and Herbs |       |         |    0.68 |  7.43 |   0 |  2.03 | No      | 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 19, 20, 21, 22, 23, 24, 25, 26, 27, 29, 31, 32, 33, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47, 48, 50, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 74, 75, 76, 77, 78, 80, 81, 82, 85, 86, 91, 94, 95, 96, 98, 99, 100, 101, 102, 106, 117, 120, 121, 124, 125, 126, 127, 128, 134, 135, 136, 137, 138, 140, 141, 142, 143, 148, 149, 151, 152, 153, 156, 157, 158, 159, 160, 161, 163, 168, 169, 170, 175, 176, 177, 183, 185, 186, 187, 188, 189, 192, 195, 198, 199, 200, 201, 202, 203, 204, 205, 212, 213, 217, 218, 219, 220, 221, 222, 224, 226, 228, 230, 231, 232, 233, 234, 236, 237, 240, 241, 242, 244, 245, 247, 248, 250, 252, 255, 256, 257, 259, 262, 269, 271, 283, 284, 288 |
| Paneer                     | g    | Proteins and Dairy  | 200 g |         |      18 |     4 |  20 |     0 | No      | 3, 4, 5, 11, 13, 32, 38, 59, 60, 61, 62, 85, 101, 102, 106, 121, 128, 140, 241, 249, 257, 287                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Papaya                     | g    | Fruit               |       |         |     0.5 |    11 | 0.3 |   1.7 | No      | 131, 155                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Parsley                    | g    | Aromatics and Herbs |       |         |       3 |     6 | 0.8 |   3.3 | Yes     | 176, 267                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Pasta                      | g    | Pantry              |       |         |      13 |    75 | 1.5 |   3.2 | No      | 169, 170, 172, 182, 183, 253, 254, 284                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Pav Bread                  | pcs  | Pantry              |       |      40 |       8 |    52 | 3.5 |   2.5 | No      | 98, 281                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Peach                      | g    | Fruit               |       |         |     0.9 |   9.5 | 0.3 |   1.5 | No      | 278                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Peanut                     | g    | Pantry              |       |         |      26 |    16 |  49 |     8 | No      | 17, 18, 29, 34, 112, 162, 172, 211                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Pineapple                  | g    | Fruit               |       |         |     0.5 |    13 | 0.1 |   1.4 | No      | 179, 279                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Plum                       | g    | Fruit               |       |         |     0.7 |  11.4 | 0.3 |   1.4 | No      | 277                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Pomegranate                | g    | Fruit               |       |         |     1.7 |  18.7 | 1.2 |     4 | No      | 280                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Pomegranate Molasses       | ml   | Pantry              |       |         |       0 |    70 |   0 |     0 | Yes     | 184                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Potato                     | g    | Vegetables          |       |         |       2 |    17 | 0.1 |   2.2 | No      | 22, 23, 24, 25, 28, 29, 34, 36, 51, 56, 69, 70, 91, 94, 98, 101, 135, 201, 202, 213, 222, 239, 240, 243, 288                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Prawn                      | g    | Proteins and Dairy  | 500 g |         |      20 |     0 | 1.7 |     0 | No      | 20, 44, 78, 141, 159, 162, 181                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Raisin                     | g    | Pantry              |       |         |     3.1 |    79 | 0.5 |   3.7 | No      | 53, 130, 132, 139, 146, 286                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Rice Vermicelli            | g    | Pantry              |       |         |       6 |    83 | 0.1 |   0.9 | No      | 31, 132, 162, 164, 211                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Ridge Gourd                | g    | Vegetables          |       |         |     0.5 |     4 | 0.1 |   0.5 | No      | 74                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Sabudana                   | g    | Pantry              |       |         |     0.2 |    88 |   0 |   0.9 | No      | 34                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Semolina                   | g    | Pantry              |       |         |      13 |    73 |   1 |   3.9 | No      | 82, 130                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sesame Oil                 | ml   | Pantry              |       |         |       0 |     0 | 100 |     0 | No      | 207                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Soy Sauce                  | ml   | Pantry              |       |         |       8 |     5 | 0.1 |   0.8 | No      | 121, 160, 161, 162, 163, 164, 165, 166, 167, 168, 178, 179, 180, 181, 191, 192, 193, 194, 207, 208, 209, 211, 212, 246, 249, 264, 268, 287                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Soyabean Chunk             | g    | Pantry              |       |         |      52 |    33 | 0.5 |    13 | No      | 75, 76, 143, 245, 248                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Spaghetti                  | g    | Pantry              |       |         |      13 |    75 | 1.5 |   3.2 | No      | 171                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Spinach                    | g    | Vegetables          |       |         |     2.9 |     4 | 0.4 |   2.2 | No      | 2, 3, 191, 203, 207, 210, 233, 235                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Spring Onion               | g    | Aromatics and Herbs |       |         |     1.8 |     7 | 0.2 |   2.6 | No      | 162, 164, 165, 166, 167, 168, 178, 179, 180, 181, 192, 193, 194, 207, 208, 209, 210, 246, 249, 263, 268, 287                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Sprout                     | g    | Pantry              |       |         |       9 |    22 | 0.5 |     6 | No      | 42, 230                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sweet Corn                 | g    | Pantry              |       |         |     3.4 |    19 | 1.2 |   2.4 | No      | 10, 26, 186, 199, 233, 254, 259, 263                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Sweet Potato Glass Noodles | g    | Pantry              |       |         |       0 |    73 |   0 |     1 | Yes     | 207                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Tahini                     | g    | Pantry              |       |         |      17 |    21 |  54 |     9 | Yes     | 174                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Thai Green Curry Paste     | g    | Pantry              |       |         |    1.76 | 17.65 |   0 |  5.88 | Yes     | 161                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Thai Red Curry Paste       | g    | Pantry              |       |         |     2.5 | 18.75 |   0 |  6.25 | Yes     | 160                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Tinda                      | g    | Vegetables          |       |         |       1 |     5 | 0.2 |   1.5 | No      | 73                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Tofu                       | g    | Proteins and Dairy  | 200 g |         |      12 |     2 |   5 |   0.9 | No      | 160, 178, 191, 193, 208, 210                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Tomato                     | g    | Aromatics and Herbs |       |         |    0.68 |  3.38 |   0 |  0.68 | No      | 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 27, 32, 39, 40, 42, 43, 44, 45, 47, 48, 50, 52, 54, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 72, 73, 74, 75, 76, 82, 85, 86, 94, 95, 96, 98, 99, 100, 101, 102, 106, 124, 126, 127, 128, 134, 135, 136, 137, 142, 153, 156, 157, 159, 169, 170, 173, 176, 177, 183, 186, 195, 196, 198, 199, 200, 202, 203, 204, 205, 217, 218, 219, 221, 224, 226, 230, 231, 232, 235, 236, 237, 238, 239, 240, 241, 242, 244, 245, 247, 250, 251, 252, 256, 257, 262, 266, 267, 269, 271, 283, 284                                                                                                                                                                                                           |
| Toor Dal                   | g    | Pantry              |       |         |      22 |    63 | 1.5 |    15 | No      | 63, 64, 67, 236, 237, 238, 251                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Tortilla                   | pcs  | Pantry              |       |      45 |       8 |    50 |   7 |     3 | No      | 188, 255, 256                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Urad Dal                   | g    | Pantry              |       |         |      25 |    59 | 1.2 |    18 | No      | 225, 236, 285                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Walnut                     | g    | Pantry              |       |         |      15 |    14 |  65 |     7 | No      | 184, 215                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| White Vinegar              | ml   | Pantry              |       |         |       0 |     0 |   0 |     0 | No      | 121, 165, 167, 168, 287                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Zucchini                   | g    | Vegetables          |       |         |     1.2 |     3 | 0.3 |     1 | No      | 205, 228                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Source basis added with the high-confidence fixes

[Dassana's suji halwa recipe](https://www.vegrecipesofindia.com/sooji-halwa-recipe-rava-sheera/) and [fruit custard recipe](https://www.vegrecipesofindia.com/fruit-custard-mixed-fruit-custard/) support the ingredients and cooking methods. This batch adapts quantities for two; it does not claim to reproduce those recipes or to have tested all portions. [Maangchi's japchae](https://www.maangchi.com/recipe/japchae) establishes the dangmyeon product form.

| Catalog entry              | Profile basis per 100 g (protein/carbs/fat/fibre) | Source and limitation                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sweet Potato Glass Noodles | 0 / 73 / 0 / 1 g                                  | [Published Nongshim product nutrition via BienManger](https://www.bienmanger.com/2F48744_Sweet_Potato_Noodles_Glass_Noodles.html). Retailer-transcribed label; match the actual purchased packet before claiming precise nutrition.                                           |
| Thai Red Curry Paste       | 2.5 / 18.75 / 0 / 6.25 g                          | [Thai Kitchen label](https://www.clubhouse.ca/en-ca/thai-kitchen/products/pastes-dips-and-sauces/red-curry-paste), normalized from 16 g.                                                                                                                                      |
| Thai Green Curry Paste     | 1.76 / 17.65 / 0 / 5.88 g                         | [Thai Kitchen label](https://www.clubhouse.ca/en-ca/thai-kitchen/products/pastes-dips-and-sauces/green-curry-paste), normalized from 17 g, rounded.                                                                                                                           |
| Chilli Sauce               | 1.5 / 33 / 1.2 / 3.7 g                            | [Flying Goose supplier product sheet](https://www.henderson-foodservice.com/productpdf/download/file/id/10118/name/Spicy_Sriracha_Sauce_%25286x730ml%2529.pdf/). Recipe specifies sriracha-style hot red sauce in grams; other chilli sauces need their own matching profile. |
| White Vinegar              | 0 / 0 / 0 / 0 g                                   | Plain unsweetened distilled white vinegar, a negligible-macronutrient approximation at the 10 ml recipe amounts. This does not assert zero energy from acetic acid; the engine models only protein/carbohydrate/fat energy.                                                   |
| Onion                      | 0.68 / 7.43 / 0 / 2.03 g                          | [FDA raw edible portion table](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/nutrition-information-raw-vegetables): 1 g protein, 11 g carbohydrate, 0 g fat, 3 g fibre per 148 g, normalized and rounded.                                               |
| Tomato                     | 0.68 / 3.38 / 0 / 0.68 g                          | Same FDA table: 1 g protein, 5 g carbohydrate, 0 g fat, 1 g fibre per 148 g. FDA serving values are rounded, so scaled values remain approximate.                                                                                                                             |

## Review output requested

| Finding ID | Verdict | Confidence | Dish IDs | Evidence / reasoning | Proposed exact change | Further evidence or household decision needed |
| ---------- | ------- | ---------- | -------- | -------------------- | --------------------- | --------------------------------------------- |

Cover M01-M59 without silently dropping inactive dishes. Consolidate duplicate fixes while retaining finding references. Distinguish a changed recipe quantity from a changed purchase quantity, and name the dry/cooked/edible basis for any numerical correction. Identify which findings are resolved by the high-confidence work, partly resolved, or still open.

When reviewing the implementation locally, read `CLAUDE.md`, `docs/development.md`, `docs/engine.md` (nutrition and field definitions), `docs/product.md` (pantry policy), `ADDING-DISHES.md`, and `engine/src/nutrition.ts`. The fix checkout is isolated; the main checkout and production deployment are not updated. The high-confidence patch is supplied separately so the exact implementation can be inspected even if the worktree path is unavailable.
