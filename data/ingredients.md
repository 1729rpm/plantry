# Ingredient Catalog

One row per canonical ingredient. `Group` is the user-facing grocery-list
bucket (fixed order: Proteins and Dairy, Pantry, Vegetables, Aromatics and
Herbs, Other). `Unit` is the canonical measure (g/ml/pcs). `Pack Size`
present marks a tracked ingredient (used by §6 Ingredient Consolidation and
rounded up to whole packs on the buy list); blank marks an untracked staple
bought by weight.

`Grams per piece` applies only to `pcs`-unit ingredients (an egg is about
50 g) so macro derivation can convert pieces to grams; blank on every other
row. `Protein /100g`, `Carbs /100g`, `Fat /100g` and `Fiber /100g` power the
derived dish macros, calories (Atwater), and the Healthy definition (engine.md
Nutrition section); a blank cell reads as zero. Only macro-relevant rows (the
Proteins and Dairy, Pantry and Vegetables groups) carry values; aromatics,
herbs and the Other group may stay blank.

`Special` is `Yes` for an ingredient that needs special sourcing (not stocked
by a regular Bangalore sabziwala/kirana, so a supermarket or specialty-store
run); blank means regular sourcing, the common case. The special-sourcing
report (engine.md Reports) lists, per active dish, which special ingredients
it uses, so the week's special shopping trip is visible up front.

Grouping judgment calls (institutional memory; do not silently re-bucket):

- Onion and Tomato: Aromatics and Herbs. Both are the base of nearly every
  curry; grouping them with herbs matches how the buy list is shopped at the
  aromatics counter.
- Lemon: Aromatics and Herbs. Used as a flavoring agent, never as the body of
  a dish.
- Capsicum: Vegetables, not Aromatics. Bought as a veg by weight; the engine's
  soft-consolidation list (engine/src/consolidation.ts FRESH_PRODUCE_ITEMS) is
  a separate concept and lives in code, not here.
- Cucumber: Vegetables. Eaten as a vegetable in salads.
- Coconut Milk: Pantry. A shelf-stable tin/carton, bought rarely, not dairy.
- Sprout: Pantry. Dry pulse pre-sprouted, slots with the other dry pulses.
- Fruit: Other. A placeholder ingredient name for the "Seasonal fruit" dish
  (id 123); it is not a specific item to put on a buy list, so Other keeps it
  visible without forcing a wrong category.
| Ingredient | Group | Unit | Pack Size | Grams per piece | Protein /100g | Carbs /100g | Fat /100g | Fiber /100g | Special |
|------------|-------|------|-----------|-----------------|---------------|-------------|-----------|-------------|---------|
| Avocado | Vegetables | g | | | 2 | 9 | 15 | 7 | |
| Banana | Other | pcs | | 120 | 1.1 | 23 | 0.3 | 2.6 | |
| Basil | Aromatics and Herbs | g | | | | | | | |
| Bean Sprout | Vegetables | g | | | 3 | 6 | 0.2 | 1.8 | |
| Bhindi | Vegetables | g | | | 1.9 | 7 | 0.2 | 3.2 | |
| Bitter Gourd | Vegetables | g | | | 1 | 4 | 0.2 | 2.8 | |
| Black Urad Dal | Pantry | g | | | 25 | 59 | 1.6 | 18 | |
| Bottle Gourd | Vegetables | g | | | 0.6 | 4 | 0 | 0.5 | |
| Bread | Pantry | pcs | | 30 | 9 | 49 | 3.2 | 2.7 | |
| Brinjal | Vegetables | g | | | 1 | 6 | 0.2 | 3 | |
| Broccoli | Vegetables | g | | | 2.8 | 7 | 0.4 | 2.6 | |
| Bulgur Wheat | Pantry | g | | | 12 | 76 | 1.3 | 18 | Yes |
| Cabbage | Vegetables | g | | | 1.3 | 6 | 0.1 | 2.5 | |
| Capsicum | Vegetables | g | | | 1 | 6 | 0.3 | 2.1 | |
| Carrot | Vegetables | g | | | 0.9 | 10 | 0.2 | 2.8 | |
| Cashew | Pantry | g | | | 18 | 30 | 44 | 3.3 | |
| Cauliflower | Vegetables | g | | | 1.9 | 5 | 0.3 | 2 | |
| Chana Dal | Pantry | g | | | 20 | 60 | 6 | 13 | |
| Cheese | Proteins and Dairy | g | | | 25 | 1.3 | 33 | 0 | |
| Chicken | Proteins and Dairy | g | | | 27 | 0 | 14 | 0 | |
| Chicken Breast | Proteins and Dairy | g | 250 g | | 31 | 0 | 3.6 | 0 | |
| Chicken Keema | Proteins and Dairy | g | 500 g | | 17 | 0 | 20 | 0 | |
| Chickpea | Pantry | g | | | 19 | 61 | 6 | 17 | |
| Coconut Milk | Pantry | ml | | | 2.3 | 6 | 21 | 0 | |
| Coriander Leaf | Aromatics and Herbs | g | | | | | | | |
| Cornflour | Pantry | g | | | 0.3 | 91 | 0.1 | 0.9 | |
| Couscous | Pantry | g | | | 13 | 77 | 0.6 | 5 | |
| Cucumber | Vegetables | g | | | 0.7 | 4 | 0.1 | 0.5 | |
| Curd | Proteins and Dairy | g | 500 g | | 3.5 | 5 | 3.3 | 0 | |
| Curry Leaf | Aromatics and Herbs | g | | | | | | | |
| Egg | Proteins and Dairy | pcs | | 50 | 13 | 1.1 | 11 | 0 | |
| Fenugreek Leaf | Vegetables | g | | | 4.4 | 6 | 0.9 | 1.1 | |
| Feta | Proteins and Dairy | g | 200 g | | 14 | 4 | 21 | 0 | |
| Fish | Proteins and Dairy | g | 500 g | | 20 | 0 | 5 | 0 | |
| Flattened Rice | Pantry | g | | | 7 | 77 | 1.2 | 2.4 | |
| French Bean | Vegetables | g | | | 1.8 | 7 | 0.2 | 2.7 | |
| Fruit | Other | pcs | | | | | | | |
| Garlic | Aromatics and Herbs | g | | | | | | | |
| Ginger | Aromatics and Herbs | g | | | | | | | |
| Gochujang | Pantry | g | | | 6 | 35 | 2 | 4 | Yes |
| Green Chilli | Aromatics and Herbs | pcs | | 5 | | | | | |
| Green Pea | Pantry | g | | | 5 | 14 | 0.4 | 5 | |
| Honey | Pantry | g | | | 0.3 | 82 | 0 | 0.2 | |
| Jamun | Other | g | | | 0.7 | 14 | 0.2 | 0.6 | |
| Kidney Bean | Pantry | g | | | 24 | 60 | 0.8 | 15 | |
| Lemon | Aromatics and Herbs | pcs | | 60 | | | | | |
| Lemongrass | Aromatics and Herbs | g | | | | | | | |
| Lettuce | Vegetables | g | 100 g | | 1.4 | 3 | 0.2 | 1.3 | |
| Litchi | Other | g | | | 0.8 | 16.5 | 0.4 | 1.3 | |
| Mango | Other | g | | | 0.8 | 15 | 0.4 | 1.6 | |
| Masoor Dal | Pantry | g | | | 25 | 60 | 1.1 | 11 | |
| Milk | Proteins and Dairy | ml | | | 3.4 | 5 | 3.3 | 0 | |
| Mint Leaf | Aromatics and Herbs | g | | | | | | | |
| Miso Paste | Pantry | g | | | 12 | 26 | 6 | 5 | Yes |
| Moong Dal | Pantry | g | | | 24 | 59 | 1.2 | 16 | |
| Mozzarella | Proteins and Dairy | g | 200 g | | 22 | 2.2 | 22 | 0 | |
| Mushroom | Vegetables | g | 200 g | | 3.1 | 3.3 | 0.3 | 1 | |
| Mutton | Proteins and Dairy | g | | | 25 | 0 | 21 | 0 | |
| Noodles | Pantry | g | | | 12 | 71 | 1.4 | 2.4 | |
| Oats | Pantry | g | | | 13 | 67 | 7 | 10 | |
| Olive Oil | Pantry | ml | | | 0 | 0 | 100 | 0 | |
| Onion | Aromatics and Herbs | g | | | | | | | |
| Papaya | Other | g | | | 0.5 | 11 | 0.3 | 1.7 | |
| Paneer | Proteins and Dairy | g | 200 g | | 18 | 4 | 20 | 0 | |
| Parsley | Aromatics and Herbs | g | | | 3 | 6 | 0.8 | 3.3 | Yes |
| Pasta | Pantry | g | | | 13 | 75 | 1.5 | 3.2 | |
| Pav Bread | Pantry | pcs | | 40 | 8 | 52 | 3.5 | 2.5 | |
| Peach | Other | g | | | 0.9 | 9.5 | 0.3 | 1.5 | |
| Peanut | Pantry | g | | | 26 | 16 | 49 | 8 | |
| Pineapple | Other | g | | | 0.5 | 13 | 0.1 | 1.4 | |
| Plum | Other | g | | | 0.7 | 11.4 | 0.3 | 1.4 | |
| Pomegranate | Other | g | | | 1.7 | 18.7 | 1.2 | 4 | |
| Pomegranate Molasses | Pantry | ml | | | 0 | 70 | 0 | 0 | Yes |
| Potato | Vegetables | g | | | 2 | 17 | 0.1 | 2.2 | |
| Prawn | Proteins and Dairy | g | 500 g | | 20 | 0 | 1.7 | 0 | |
| Raisin | Pantry | g | | | 3.1 | 79 | 0.5 | 3.7 | |
| Rice Vermicelli | Pantry | g | | | 6 | 83 | 0.1 | 0.9 | |
| Ridge Gourd | Vegetables | g | | | 0.5 | 4 | 0.1 | 0.5 | |
| Sabudana | Pantry | g | | | 0.2 | 88 | 0 | 0.9 | |
| Semolina | Pantry | g | | | 13 | 73 | 1 | 3.9 | |
| Sesame Oil | Pantry | ml | | | 0 | 0 | 100 | 0 | |
| Soy Sauce | Pantry | ml | | | 8 | 5 | 0.1 | 0.8 | |
| Soyabean Chunk | Pantry | g | | | 52 | 33 | 0.5 | 13 | |
| Spaghetti | Pantry | g | | | 13 | 75 | 1.5 | 3.2 | |
| Spinach | Vegetables | g | | | 2.9 | 4 | 0.4 | 2.2 | |
| Spring Onion | Aromatics and Herbs | g | | | 1.8 | 7 | 0.2 | 2.6 | |
| Sprout | Pantry | g | | | 9 | 22 | 0.5 | 6 | |
| Sweet Corn | Pantry | g | | | 3.4 | 19 | 1.2 | 2.4 | |
| Tahini | Pantry | g | | | 17 | 21 | 54 | 9 | Yes |
| Tinda | Vegetables | g | | | 1 | 5 | 0.2 | 1.5 | |
| Tofu | Proteins and Dairy | g | 200 g | | 12 | 2 | 5 | 0.9 | |
| Tomato | Aromatics and Herbs | g | | | | | | | |
| Toor Dal | Pantry | g | | | 22 | 63 | 1.5 | 15 | |
| Tortilla | Pantry | pcs | | 45 | 8 | 50 | 7 | 3 | |
| Walnut | Pantry | g | | | 15 | 14 | 65 | 7 | |
| Zucchini | Vegetables | g | | | 1.2 | 3 | 0.3 | 1 | |
