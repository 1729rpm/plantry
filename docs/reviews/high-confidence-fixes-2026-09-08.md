# High-confidence dish audit fixes

8 September 2026. Base `a8778b8`; branch `fix/dish-audit-confidence`; isolated checkout `/tmp/plantry-dish-audit-fixes`. Implementation and review evidence for the high-confidence fix PR. Git history and deployment checks determine shipping status.

**Coverage:** All H01-H51 finding groups are addressed. H01-H50 change 106 dishes. H51 uses the audit's conservative option: partial nutrition remains explicitly partial and cannot create a Healthy classification. Complete recipe nutrition is not claimed. The catalog grows from 98 to 103 entries; ingredient rows grow from 1,459 to 1,554. All 270 dish IDs, active flags and HP tags are preserved.

## Recipe decisions

- Missing amounts are explicit two-person recipe defaults. They are implementation choices requiring normal cooking/taste adjustment, not measured household yields or kitchen-tested corrections.
- Keep existing 300 g chicken recipes and align the two purchase notes; do not arbitrarily double both meals.
- Preserve the 130 g total dry Panchmel dal amount with five 26 g portions, adding Urad Dal.
- Keep Kidney Bean 120 g and rename dish #188 to Kidney bean quesadilla. Preserve its ID and existing photo filename.
- Use Sweet Potato Glass Noodles 180 g for japchae. This is a separate catalog product from generic wheat noodles.
- Fruit custard uses Milk 500 ml, Cornflour 25 g, Banana 1 pcs, Papaya 150 g edible flesh, sugar 30 g and pantry vanilla 2.5 ml. It has a two-hour chilling requirement.
- Sewaiyan kheer explicitly uses thin Rice Vermicelli 60 g with its existing milk/nuts, rather than silently treating rice vermicelli as wheat sevai.
- Pantry rice and flour remain excluded from groceries; amounts and water ratios are in the recipe. White Vinegar is tracked only where the high-confidence Asian-sauce fixes explicitly require it. Other vinegar/butter/cream pantry decisions remain in the medium review.

## Source basis

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

## Finding-by-finding resolution

### H01: Quantity conflict

**Original issue:** buySpecially says curry-cut chicken 600 g; ingredient table says Chicken 300 g.

**#1 Chicken masala gravy**, `data/dishes/chicken-masala-gravy.md`: Purchase note aligned to existing Chicken 300 g two-person recipe.

**#56 Chicken stew**, `data/dishes/chicken-stew.md`: Purchase note aligned to existing Chicken 300 g two-person recipe.

### H02: Empty ingredient table

**Original issue:** Recipe needs chicken breast and lemon; table is empty despite buySpecially explicitly specifying 300 g boneless chicken breast.

**#104 Chicken breast**, `data/dishes/chicken-breast.md`: Chicken Breast: 300 g; Lemon: 0.5 pcs.

### H03: Empty ingredient table

**Original issue:** Recipe uses paneer, onion, ginger, green chilli, tomato and coriander; none has an ingredient row or quantity.

**#106 Paneer bhurji**, `data/dishes/paneer-bhurji-106.md`: Paneer: 200 g; Onion: 80 g; Ginger: 10 g; Green Chilli: 1 pcs; Tomato: 80 g; Coriander Leaf: 10 g.

### H04: Empty ingredient table

**Original issue:** Toast requires bread, a cataloged ingredient measured in pcs, but the table is empty.

**#109 Toast**, `data/dishes/toast.md`: Bread: 4 pcs.

### H05: Empty ingredient table

**Original issue:** Mint chutney uses mint, coriander, green chilli, ginger and lemon; all five cataloged ingredients are missing.

**#110 Mint chutney**, `data/dishes/mint-chutney.md`: Mint Leaf: 20 g; Coriander Leaf: 30 g; Green Chilli: 1 pcs; Ginger: 5 g; Lemon: 0.5 pcs; For two dipping portions, use the listed herbs and 20 ml water to start; add up to another 20 ml only if needed..

### H06: Empty ingredient table

**Original issue:** Garlic is the main ingredient and appears in the first recipe step, but the table is empty.

**#111 Garlic chutney**, `data/dishes/garlic-chutney.md`: Garlic: 30 g; For two small condiment portions, use 30 g peeled garlic, 2 g dried red chillies and 5 ml oil; add only a pinch of salt..

### H07: Empty ingredient table

**Original issue:** Recipe uses peanuts, green chilli, garlic and curry leaves; all cataloged ingredients are missing. Tamarind is also unquantified.

**#112 Peanut chutney**, `data/dishes/peanut-chutney.md`: Peanut: 40 g; Green Chilli: 1 pcs; Garlic: 5 g; Curry Leaf: 3 g; This batch makes two condiment portions; start blending with 30 ml water and add up to 20 ml more if needed..

### H08: Main ingredient missing

**Original issue:** Suji halwa lists only Cashew 20 g and Raisin 15 g; Semolina, its named main ingredient and a cataloged food, is absent.

**#130 Suji halwa**, `data/dishes/suji-halwa.md`: Semolina: 60 g; For two dessert portions, use 60 g semolina, 30 g ghee, 45 g sugar and 180 ml hot water with the listed nuts and raisins..

### H09: Main ingredient missing

**Original issue:** Fruit custard lists only Milk 500 ml; the recipe also requires custard powder and chopped seasonal fruit with no quantities.

**#131 Fruit custard**, `data/dishes/fruit-custard.md`: Cornflour: 25 g; Banana: 1 pcs; Papaya: 150 g; Recipe amounts/method clarified.

### H10: Main ingredient missing

**Original issue:** Sewaiyan kheer lists milk, cashews and raisins but no vermicelli, which is roasted and simmered in steps 1-3.

**#132 Sewaiyan kheer**, `data/dishes/sewaiyan-kheer.md`: Rice Vermicelli: 60 g; Explicitly use rice vermicelli for this sevai variation; no whole-wheat product is silently substituted; For two dessert portions, use the listed 60 g thin rice vermicelli and 500 ml milk with 30 g sugar and 10 g ghee..

### H11: Wrong ingredient form

**Original issue:** The recipe uses gram flour but the table specifies Chickpea 80 g, the whole dry chickpea catalog item. There is no grinding step or gram-flour catalog item.

**#151 Missi roti**, `data/dishes/missi-roti.md`: Remove whole Chickpea 80 g; gram flour is quantified as a pantry ingredient in the recipe; For six small missi rotis (two portions), use 120 g whole-wheat atta and 80 g besan (gram flour), with 110 ml water initially and up to 20 ml more as needed. Whole chickpeas are not used..

### H12: Dish-name ingredient mismatch

**Original issue:** Black bean quesadilla uses Kidney Bean 120 g. Black beans and kidney beans are different purchases, and the recipe does not label the substitution.

**#188 Kidney bean quesadilla**, `data/dishes/kidney-bean-quesadilla.md`: Garlic: 8 g; Rename to match the existing kidney-bean recipe, preserving ID 188 and its portion.

### H13: Wrong ingredient form

**Original issue:** The description promises glass noodles, but the row orders generic Noodles 180 g, the same catalog item used for Hakka noodles with 12 g protein/100 g. No starch-noodle product is distinguished.

**#207 Korean japchae**, `data/dishes/korean-japchae.md`: Use a distinct dangmyeon shopping and nutrition entry; retain 180 g dry noodles.

### H14: Dish-name ingredient mismatch

**Original issue:** Panchmel dal's description says five lentils; the table contains only Toor Dal, Moong Dal, Chana Dal and Masoor Dal, four types.

**#236 Panchmel dal**, `data/dishes/panchmel-dal.md`: Ginger: 10 g; Toor Dal: 26 g; Moong Dal: 26 g; Chana Dal: 26 g; Masoor Dal: 26 g; Urad Dal: 26 g; Five equal dal portions, preserving the existing total of 130 g dry lentils.

### H15: Recipe ingredient missing

**Original issue:** Recipe finishes with coriander, but no Coriander Leaf row exists.

**#11 Mushroom paneer**, `data/dishes/mushroom-paneer.md`: Coriander Leaf: 10 g.

### H16: Recipe ingredient missing

**Original issue:** Final recipe step requires lemon, but no Lemon row exists.

**#31 Vegetable sevai**, `data/dishes/vegetable-sevai.md`: Lemon: 0.5 pcs.

### H17: Recipe ingredient missing

**Original issue:** ID 50 needs curd in the maida-curd bhatura dough; ID 54 needs curd in the chicken marinade. Neither table contains Curd.

**#50 Chole bhature**, `data/dishes/chole-bhature.md`: Curd: 50 g; For four small bhature (two portions), mix 160 g maida, the listed 50 g curd, 2 g sugar, 1 g baking powder and 5 ml oil; knead with 45 ml water, adding up to 15 ml more only if needed. Cover and rest for 2 hours before rolling..

**#54 Butter chicken**, `data/dishes/butter-chicken.md`: Curd: 60 g.

### H18: Recipe ingredient missing

**Original issue:** Chutney step explicitly blends Green Chilli and Lemon; both are absent from the table.

**#86 Veg sandwich**, `data/dishes/veg-sandwich.md`: Green Chilli: 1 pcs; Lemon: 0.5 pcs.

### H19: Recipe ingredient missing

**Original issue:** Final serving instruction includes lemon; Lemon is absent from the table.

**#98 Pav bhaji**, `data/dishes/pav-bhaji.md`: Lemon: 1 pcs.

### H20: Recipe ingredient missing

**Original issue:** Kofta binding explicitly uses cornflour, but Cornflour is absent from the table.

**#101 Malai kofta**, `data/dishes/malai-kofta.md`: Cornflour: 15 g.

### H21: Recipe ingredient missing

**Original issue:** Final step adds curry leaves and lemon; neither Curry Leaf nor Lemon is in the table.

**#120 Pepper chicken dry**, `data/dishes/pepper-chicken-dry.md`: Curry Leaf: 5 g; Lemon: 0.5 pcs.

### H22: Recipe ingredient missing

**Original issue:** Method requires a Cornflour coating and Soy Sauce, but neither is listed. Chilli sauce and vinegar are also required with no quantity or catalog entry.

**#121 Chilli paneer dry**, `data/dishes/chilli-paneer-dry.md`: Cornflour: 20 g; Soy Sauce: 15 ml; Chilli Sauce: 15 g; White Vinegar: 10 ml; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams..

### H23: Recipe ingredient missing

**Original issue:** Saffron is soaked in warm milk in step 3, but Milk is absent from the table.

**#144 Shrikhand**, `data/dishes/shrikhand.md`: Milk: 15 ml; For this two-person batch, measure 50 g powdered sugar; use the listed 15 ml milk to soak the saffron before adding it to the curd..

### H24: Recipe ingredient missing

**Original issue:** Red curry paste and Soy Sauce are required in steps 2 and 5, but neither is listed; red curry paste has no catalog entry.

**#160 Thai red curry tofu (inactive)**, `data/dishes/thai-red-curry-tofu.md`: Thai Red Curry Paste: 25 g; Soy Sauce: 10 ml.

### H25: Recipe ingredient missing

**Original issue:** Green curry paste and fish sauce OR soy sauce are required but unlisted and unquantified; curry paste/fish sauce have no catalog entries.

**#161 Thai green curry chicken**, `data/dishes/thai-green-curry-chicken.md`: Thai Green Curry Paste: 25 g; Soy Sauce: 10 ml.

### H26: Recipe ingredient missing

**Original issue:** The central tamarind-soy-chilli sauce has no ingredient rows or quantities; Soy Sauce exists in the catalog but is absent here.

**#162 Pad thai prawn**, `data/dishes/pad-thai-prawn.md`: Soy Sauce: 15 ml; Chilli Sauce: 10 g; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.; For the sauce, soak 5 g seedless dried tamarind from the pantry in 30 ml hot water for 10 minutes, mash and strain; mix the extract with the listed soy sauce and chilli sauce..

### H27: Recipe ingredient missing

**Original issue:** The recipe explicitly seasons with soy sauce, but Soy Sauce is absent from the table.

**#163 Thai basil chicken**, `data/dishes/thai-basil-chicken.md`: Soy Sauce: 15 ml.

**#164 Singapore noodles**, `data/dishes/singapore-noodles.md`: Soy Sauce: 20 ml.

**#166 Chicken fried rice**, `data/dishes/chicken-fried-rice.md`: Soy Sauce: 20 ml; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

### H28: Recipe ingredient missing

**Original issue:** Soy sauce, vinegar and chilli sauce are required in the method but none is represented in the table.

**#165 Veg hakka noodles**, `data/dishes/veg-hakka-noodles.md`: Soy Sauce: 20 ml; Chilli Sauce: 15 g; White Vinegar: 10 ml; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams..

**#167 Veg manchurian gravy**, `data/dishes/veg-manchurian-gravy.md`: Soy Sauce: 15 ml; Chilli Sauce: 15 g; White Vinegar: 10 ml; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams..

**#168 Chilli chicken dry**, `data/dishes/chilli-chicken-dry.md`: Soy Sauce: 15 ml; Chilli Sauce: 15 g; White Vinegar: 10 ml; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams..

### H29: Recipe ingredient missing

**Original issue:** Recipe explicitly uses garlic, but Garlic is absent from the ingredient table.

**#186 Bean burrito bowl**, `data/dishes/bean-burrito-bowl.md`: Garlic: 8 g; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#188 Kidney bean quesadilla**, `data/dishes/kidney-bean-quesadilla.md`: Garlic: 8 g; Rename to match the existing kidney-bean recipe, preserving ID 188 and its portion.

### H30: Recipe ingredient missing

**Original issue:** Final step calls for a squeeze of lime; no Lime or Lemon row exists.

**#198 Chicken enchilada bowl**, `data/dishes/chicken-enchilada-bowl.md`: Lemon: 0.5 pcs; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

### H31: Recipe ingredient missing

**Original issue:** The dressing explicitly contains soy, but Soy Sauce is absent from the table.

**#211 Vietnamese noodle salad**, `data/dishes/vietnamese-noodle-salad.md`: Soy Sauce: 15 ml.

### H32: Recipe ingredient missing

**Original issue:** The tempering explicitly uses urad dal; Urad Dal is missing from the table.

**#225 Beans poriyal**, `data/dishes/beans-poriyal.md`: Urad Dal: 5 g.

### H33: Recipe ingredient missing

**Original issue:** Step 3 uses ginger garlic but neither Ginger nor Garlic appears in the table.

**#226 Baingan bharta**, `data/dishes/baingan-bharta.md`: Ginger: 10 g; Garlic: 10 g.

### H34: Recipe ingredient missing

**Original issue:** Method explicitly uses ginger garlic, but neither Ginger nor Garlic is in the table.

**#230 Sprouts usal**, `data/dishes/sprouts-usal.md`: Ginger: 8 g; Garlic: 8 g.

**#245 Soya matar keema (inactive)**, `data/dishes/soya-matar-keema.md`: Ginger: 10 g; Garlic: 10 g.

**#247 Chana pulao**, `data/dishes/chana-pulao.md`: Ginger: 10 g; Garlic: 10 g; For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#248 Soya pulao (inactive)**, `data/dishes/soya-pulao.md`: Ginger: 10 g; Garlic: 10 g; For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

### H35: Recipe ingredient missing

**Original issue:** Step 2 explicitly fries ginger, but Ginger is not in the table.

**#236 Panchmel dal**, `data/dishes/panchmel-dal.md`: Ginger: 10 g; Toor Dal: 26 g; Moong Dal: 26 g; Chana Dal: 26 g; Masoor Dal: 26 g; Urad Dal: 26 g; Five equal dal portions, preserving the existing total of 130 g dry lentils.

### H36: Recipe ingredient missing

**Original issue:** The final tempering requires curry leaves; Curry Leaf is absent from the table.

**#237 Sambar**, `data/dishes/sambar.md`: Curry Leaf: 5 g.

### H37: Recipe ingredient missing

**Original issue:** Step 2 requires ginger, green chilli and curry leaves; all three are missing from the table.

**#243 Vegetable stew**, `data/dishes/vegetable-stew.md`: Ginger: 10 g; Green Chilli: 1 pcs; Curry Leaf: 5 g.

### H38: Recipe ingredient missing

**Original issue:** Stir-fry uses garlic and soy sauce; neither Garlic nor Soy Sauce is listed.

**#246 Veg fried rice**, `data/dishes/veg-fried-rice.md`: Garlic: 8 g; Soy Sauce: 15 ml; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

### H39: Recipe ingredient missing

**Original issue:** Step 3 uses soy sauce but Soy Sauce is absent from the table.

**#249 Paneer fried rice**, `data/dishes/paneer-fried-rice.md`: Soy Sauce: 15 ml; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

### H40: Recipe ingredient missing

**Original issue:** Final tempering requires cashews and curry leaves, but Cashew and Curry Leaf are absent.

**#251 Bisi bele bath**, `data/dishes/bisi-bele-bath.md`: Cashew: 15 g; Curry Leaf: 5 g; For two portions, use 100 g dry rice and the listed 60 g toor dal with 650 ml water; reserve a further 150 ml water for cooking the vegetables and adjusting the final consistency..

### H41: Recipe ingredient missing

**Original issue:** Method uses garlic and finishes with lemon; neither Garlic nor Lemon appears in the table.

**#256 Bean tacos**, `data/dishes/bean-tacos.md`: Garlic: 8 g; Lemon: 0.5 pcs.

### H42: Recipe ingredient missing

**Original issue:** Final step finishes with coriander; Coriander Leaf is absent from the table.

**#257 Paneer bhurji keto**, `data/dishes/paneer-bhurji-keto.md`: Coriander Leaf: 10 g.

### H43: Recipe ingredient missing

**Original issue:** Final step squeezes lemon over the stir-fry, but Lemon is absent from the table.

**#258 Keto chicken stir fry**, `data/dishes/keto-chicken-stir-fry.md`: Lemon: 0.5 pcs.

### H44: Recipe ingredient missing

**Original issue:** Recipe dresses with lemon and tempers curry leaves, but neither Lemon nor Curry Leaf is listed.

**#260 Moong dal kosambari**, `data/dishes/moong-dal-kosambari.md`: Lemon: 0.5 pcs; Curry Leaf: 3 g.

### H45: Recipe ingredient missing

**Original issue:** First step sautees vegetables with garlic, but Garlic is missing from the table.

**#265 Lemon coriander soup**, `data/dishes/lemon-coriander-soup.md`: Garlic: 8 g.

### H46: Recipe ingredient missing

**Original issue:** Method needs Soy Sauce and chilli sauce; neither is listed. ID 287 also requires unlisted vinegar.

**#268 Gobi manchurian**, `data/dishes/gobi-manchurian.md`: Soy Sauce: 15 ml; Chilli Sauce: 15 g; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.; For the batter, combine the listed 30 g cornflour with 20 g plain flour and 60 ml water; add up to 20 ml more for a coating that clings to the florets..

**#287 Paneer manchurian**, `data/dishes/paneer-manchurian.md`: Soy Sauce: 15 ml; Chilli Sauce: 15 g; White Vinegar: 10 ml; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams..

### H47: Recipe ingredient missing

**Original issue:** Step 2 mixes in green chilli; Green Chilli is absent from the table.

**#269 Vegetable omelette**, `data/dishes/vegetable-omelette.md`: Green Chilli: 1 pcs.

### H48: Unquantified recipe rice

**Original issue:** Rice is part of the actual dish or assembled bowl, but no rice quantity is recorded. Dosa also has no rice-to-urad ratio. Many methods refer to measured water without stating its amount or ratio. Optional rice serving suggestions on unrelated curries are excluded from this finding.

**#15 Khichdi**, `data/dishes/khichdi.md`: For two portions, rinse 100 g dry rice with the listed dry moong dal; use 650 ml water for a soft khichdi, adding hot water at the end only to loosen it..

**#16 Curd rice**, `data/dishes/curd-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#17 Lemon rice**, `data/dishes/lemon-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#18 Tomato rice**, `data/dishes/tomato-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#53 Kheer**, `data/dishes/kheer.md`: For two dessert portions, use 40 g dry short-grain rice with the listed 500 ml milk and 30 g sugar..

**#79 Jeera rice**, `data/dishes/jeera-rice.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#80 Peas pulao**, `data/dishes/peas-pulao.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#81 Veg pulao**, `data/dishes/veg-pulao.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#94 Veg biryani**, `data/dishes/veg-biryani.md`: For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed..

**#95 Chicken biryani**, `data/dishes/chicken-biryani.md`: For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed..

**#96 Egg biryani**, `data/dishes/egg-biryani.md`: For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed..

**#99 Rajma chawal**, `data/dishes/rajma-chawal.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#126 Keema pulao**, `data/dishes/keema-pulao.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#147 Coconut rice**, `data/dishes/coconut-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#148 Ghee rice**, `data/dishes/ghee-rice.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#149 Mint rice**, `data/dishes/mint-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#159 Prawn pulao**, `data/dishes/prawn-pulao.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#166 Chicken fried rice**, `data/dishes/chicken-fried-rice.md`: Soy Sauce: 20 ml; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#179 Thai pineapple fried rice**, `data/dishes/thai-pineapple-fried-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#186 Bean burrito bowl**, `data/dishes/bean-burrito-bowl.md`: Garlic: 8 g; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#187 Chicken fajita bowl**, `data/dishes/chicken-fajita-bowl.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#189 Mushroom risotto**, `data/dishes/mushroom-risotto.md`: For two portions, use 140 g dry rice and keep 600 ml hot water ready; add it gradually and stop when the grains are tender with a slight bite..

**#191 Tofu bibimbap (inactive)**, `data/dishes/tofu-bibimbap.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#193 Teriyaki tofu rice (inactive)**, `data/dishes/teriyaki-tofu-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#194 Japanese egg fried rice**, `data/dishes/japanese-egg-fried-rice.md`: For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#198 Chicken enchilada bowl**, `data/dishes/chicken-enchilada-bowl.md`: Lemon: 0.5 pcs; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#199 Mexican rice**, `data/dishes/mexican-rice.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#221 Mutton biryani**, `data/dishes/mutton-biryani.md`: For two portions, use 150 g dry basmati rice; soak and drain it, then parboil in 1 litre boiling water and drain before layering as directed..

**#246 Veg fried rice**, `data/dishes/veg-fried-rice.md`: Garlic: 8 g; Soy Sauce: 15 ml; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#247 Chana pulao**, `data/dishes/chana-pulao.md`: Ginger: 10 g; Garlic: 10 g; For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#248 Soya pulao (inactive)**, `data/dishes/soya-pulao.md`: Ginger: 10 g; Garlic: 10 g; For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#249 Paneer fried rice**, `data/dishes/paneer-fried-rice.md`: Soy Sauce: 15 ml; For two portions, use 360 g cooked rice from 120 g dry rice. If starting from dry rice, rinse, cook covered with 240 ml water until absorbed, then rest 10 minutes; cool before any frying or cold assembly..

**#251 Bisi bele bath**, `data/dishes/bisi-bele-bath.md`: Cashew: 15 g; Curry Leaf: 5 g; For two portions, use 100 g dry rice and the listed 60 g toor dal with 650 ml water; reserve a further 150 ml water for cooking the vegetables and adjusting the final consistency..

**#252 Egg pulao**, `data/dishes/egg-pulao.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#272 Steamed rice**, `data/dishes/steamed-rice.md`: For two portions, rinse and soak 150 g dry basmati rice for 15 minutes, then drain. Use 300 ml fresh water for the covered absorption-cooking step; rest 10 minutes before fluffing..

**#285 Dosa**, `data/dishes/dosa.md`: For two portions (about six small dosas), use 180 g dry rice with the listed 60 g dry urad dal; start grinding with 180 ml fresh water and add up to 120 ml more gradually to reach a pouring batter..

### H49: Unquantified recipe flour

**Original issue:** Flour/besan/atta/maida or wheat dough is required, but the recipe gives no flour quantity, dough yield or reliable batter/roux ratio. The quantity cannot be recovered from the grocery table.

**#8 Kadhi**, `data/dishes/kadhi.md`: Whisk 30 g besan with the listed 300 g curd and 500 ml water for two portions of kadhi..

**#32 Besan paneer chilla**, `data/dishes/besan-paneer-chilla.md`: For four small chillas (two portions), use 80 g besan and 120 ml water; add up to 30 ml more to make a spreadable batter..

**#36 Aloo paratha**, `data/dishes/aloo-paratha.md`: For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; use the listed potato filling..

**#37 Gobi paratha**, `data/dishes/gobi-paratha.md`: For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; use the listed cauliflower filling..

**#38 Paneer paratha**, `data/dishes/paneer-paratha.md`: For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; use the listed paneer filling..

**#50 Chole bhature**, `data/dishes/chole-bhature.md`: Curd: 50 g; For four small bhature (two portions), mix 160 g maida, the listed 50 g curd, 2 g sugar, 1 g baking powder and 5 ml oil; knead with 45 ml water, adding up to 15 ml more only if needed. Cover and rest for 2 hours before rolling..

**#51 Aloo puri**, `data/dishes/aloo-puri.md`: For eight small puris (two portions), knead 160 g whole-wheat atta with 80 ml water and 5 ml oil into a firm dough; rest 15 minutes..

**#90 Thepla**, `data/dishes/thepla.md`: For six small theplas (two portions), use 160 g whole-wheat atta with the listed curd and fenugreek; add 40 ml water first and up to 30 ml more as the greens release moisture..

**#91 Methi paratha**, `data/dishes/methi-paratha.md`: For four parathas (two portions), use 160 g whole-wheat atta with the listed potato and fenugreek; add 60 ml water first and up to 30 ml more as needed..

**#103 Roti**, `data/dishes/roti.md`: For six small rotis (two portions), use 180 g whole-wheat atta and 110 ml water, adding up to 15 ml more for a soft dough..

**#108 Plain paratha**, `data/dishes/plain-paratha.md`: For four parathas (two portions), use 160 g whole-wheat atta and 95 ml water, adding up to 15 ml more for a soft dough..

**#125 Keema paratha (inactive)**, `data/dishes/keema-paratha.md`: For four stuffed parathas (two portions), knead 160 g whole-wheat atta with 95 ml water, adding up to 15 ml more as needed; cool the cooked keema before filling..

**#150 Bajra roti**, `data/dishes/bajra-roti.md`: For four small bajra rotis (two portions), mix 160 g pearl-millet flour with 120 ml warm water, adding up to 20 ml more to make a pliable dough..

**#151 Missi roti**, `data/dishes/missi-roti.md`: Remove whole Chickpea 80 g; gram flour is quantified as a pantry ingredient in the recipe; For six small missi rotis (two portions), use 120 g whole-wheat atta and 80 g besan (gram flour), with 110 ml water initially and up to 20 ml more as needed. Whole chickpeas are not used..

**#153 Oats chilla**, `data/dishes/oats-chilla.md`: For four small chillas (two portions), combine the listed 80 g oats with 30 g besan and 150 ml water; rest 10 minutes and add up to 30 ml more if the batter thickens..

**#206 Continental baked vegetables**, `data/dishes/continental-baked-vegetables.md`: For the white sauce, use 10 g plain flour with the listed 150 ml milk: whisk the flour into 30 ml cold milk first, then add it to the remaining hot milk and simmer, stirring, until thickened..

**#234 Anda paratha**, `data/dishes/anda-paratha.md`: For two large egg parathas (two portions), use 120 g whole-wheat atta and 75 ml water, adding up to 10 ml more for a soft dough..

**#253 Mac and cheese**, `data/dishes/mac-and-cheese.md`: For the roux, measure 10 g plain flour and 10 g butter with the listed 150 ml milk; cook the flour in the butter for 1 minute before gradually whisking in the milk..

**#254 White sauce pasta**, `data/dishes/white-sauce-pasta.md`: For the roux, measure 10 g plain flour and 10 g butter with the listed 150 ml milk; cook the flour in the butter for 1 minute before gradually whisking in the milk..

**#268 Gobi manchurian**, `data/dishes/gobi-manchurian.md`: Soy Sauce: 15 ml; Chilli Sauce: 15 g; Use the listed chilli sauce as a ready-made hot red chilli sauce (sriracha style), weighed in grams.; For the batter, combine the listed 30 g cornflour with 20 g plain flour and 60 ml water; add up to 20 ml more for a coating that clings to the florets..

**#271 Besan chilla**, `data/dishes/besan-chilla.md`: For four small chillas (two portions), use 100 g besan and 150 ml water; add up to 30 ml more if needed for a spreadable batter..

**#282 Beetroot roti**, `data/dishes/beetroot-roti.md`: For four small rotis (two portions), use 150 g whole-wheat atta with the listed grated beetroot; start with 60 ml water and add up to 30 ml more as the beetroot releases moisture..

**#286 Atta halva**, `data/dishes/atta-halva.md`: For two dessert portions, use 60 g whole-wheat atta, 40 g ghee, 50 g sugar and 180 ml water; dissolve the sugar in the hot water to make the syrup..

### H50: Unquantified dessert proportions

**Original issue:** The dessert requires sugar with no measured amount. Suji, carrot, moong-dal and atta halwa also use unquantified ghee; the recipe cannot establish its intended sweetness, yield or nutrition from stored data.

**#53 Kheer**, `data/dishes/kheer.md`: For two dessert portions, use 40 g dry short-grain rice with the listed 500 ml milk and 30 g sugar..

**#130 Suji halwa**, `data/dishes/suji-halwa.md`: Semolina: 60 g; For two dessert portions, use 60 g semolina, 30 g ghee, 45 g sugar and 180 ml hot water with the listed nuts and raisins..

**#131 Fruit custard**, `data/dishes/fruit-custard.md`: Cornflour: 25 g; Banana: 1 pcs; Papaya: 150 g; Recipe amounts/method clarified.

**#132 Sewaiyan kheer**, `data/dishes/sewaiyan-kheer.md`: Rice Vermicelli: 60 g; Explicitly use rice vermicelli for this sevai variation; no whole-wheat product is silently substituted; For two dessert portions, use the listed 60 g thin rice vermicelli and 500 ml milk with 30 g sugar and 10 g ghee..

**#139 Carrot halwa**, `data/dishes/carrot-halwa.md`: For two dessert portions, use 40 g sugar and 25 g ghee with the listed 500 g carrot and 250 ml milk; reserve 5 g of the ghee for frying the nuts..

**#144 Shrikhand**, `data/dishes/shrikhand.md`: Milk: 15 ml; For this two-person batch, measure 50 g powdered sugar; use the listed 15 ml milk to soak the saffron before adding it to the curd..

**#146 Moong dal halwa**, `data/dishes/moong-dal-halwa.md`: For the listed 150 g dry moong dal, use 90 g ghee, 90 g sugar, 250 ml milk and 150 ml water; reserve 10 g of the ghee for the nuts. This makes two generous dessert portions..

**#286 Atta halva**, `data/dishes/atta-halva.md`: For two dessert portions, use 60 g whole-wheat atta, 40 g ghee, 50 g sugar and 180 ml water; dissolve the sugar in the hot water to make the syrup..

### H51: Incomplete nutrition inputs

**Original issue:** The same grocery rows are the sole macro inputs. Excluded rice, flour, sugar and cooking fat contribute nothing. Blank catalog macros also contribute zero: Onion and Tomato are substantial recipe ingredients, not always negligible seasonings. Recalculation gives Peas pulao 31.84 kcal/person, Veg biryani 67.56, Atta halva 83.77, and Tomato soup 0 from the recorded inputs. Dosa is classified Healthy from its urad-only rows, with its rice and oil omitted. These are partial computations, not measured nutrition of the complete recipes.

**Resolution:** `deriveDishMacros` returns `nutritionBasis: partial` and `healthy: null` for grocery-only inputs. Complete-recipe callers must explicitly opt in and provide finite, weighable rows with populated catalog macros. Explore disables Healthy with an under-review label; pickers omit the unavailable filter. Reports identify totals as partial. Onion and Tomato now contribute source-based estimates. Full nutrition remains a medium-review follow-up, not a claim made by these changes.

## Verification

Validation results are recorded in VALIDATION-2026-09-08.md in this folder. The fix patch and medium-review handoff travel with these results. No production write, deployment, HP retagging or point-4 work occurs in this batch.
