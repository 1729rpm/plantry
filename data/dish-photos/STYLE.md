# Dish photo style spec

The single source of truth for how every Plantry dish photo looks. Photos are
AI-generated, one dish at a time, by filling the prompt template below with a
dish's name, its cuisine, and its per-dish visual-detail line, and running it
through an image model (`scripts/generate-dish-photos.mjs`). Every image, for all
200 dishes in the library, is generated from one shared realism skeleton plus that
dish's detail line, so the whole library reads as one honest set of real-looking
food photos while each dish renders its own true ingredients. The look lives in
this committed spec and in the committed detail map (`details.md`), not in anyone's
memory: a run six months from now, on a different machine, that follows this file
produces a photo that sits next to the others without a seam.

The direction is candid realism: photos that look like a real person photographed
their own meal, not a styled studio shot or glossy CGI. Each dish is shot at a
natural angle in a real everyday vessel against a softly out-of-focus home or
restaurant background, in ordinary warm light, with food that looks genuinely
cooked and a little imperfect. A single generic prompt held the overall look but
got ingredient-level details wrong (okra rendered as whole cylinders rather than
sliced rounds, plain roti garnished with coriander, boiled eggs too smooth, dry
dishes shown in sauce). The fix is per-dish: a shared realism skeleton carries the
look (angle, vessel, light, cooked-and-imperfect texture), and a per-dish
visual-detail line carries the truth of the specific dish (form, cut, garnish,
dry-vs-gravy state, texture). The detail lines live in `details.md`, one per dish,
derived from a per-dish study of real reference photos plus culinary knowledge.

Variety across the library is now desired, not uniformity. The generation script
gives each dish its own base seed (derived from its slug), so vessels, backgrounds,
and angles differ from one dish to the next while a re-run still reproduces the same
set.

---

## Prompt template

Each dish's prompt is a shared realism skeleton with three slots filled per dish:
`{dish name}` is the file's `name` field; `{cuisine}` is the dish's cuisine
adjective derived per the map below; `{per-dish detail}` is the dish's line from
`details.md` (its true form, cut, garnish, dry-vs-gravy state, and texture).
Everything outside the slots is the fixed skeleton and must not be reworded between
runs (the fixed wording is what holds the look steady).

```
A real, candid phone photograph of {dish name}, a home-style {cuisine} dish: {per-dish detail}. Shot from a natural low or three-quarter angle with shallow depth of field, in a real everyday vessel that suits the dish, a softly blurred home or restaurant background, ordinary warm light and gentle natural shadows, honest true-to-life colour with a matte natural finish, true slightly-muted colours, not glossy, not oversaturated, not plastic-looking. The food looks genuinely cooked and a little imperfect with real texture, irregular hand-made shapes, a little oil sheen and uneven edges; any garnish is fresh green coriander (cilantro) leaves, never flat-leaf parsley. Realistic and unstyled, square 1:1.
```

The look this prompt aims for: a real, candid food photo, the dish as it actually
lands on the table, shot at a natural angle (low or three-quarter, not flat
overhead) in a real everyday vessel against a softly blurred home context, in
ordinary warm light, with food that reads as genuinely cooked and a little
imperfect and with the correct real texture for its type, and with the specific
dish's true ingredients (carried by the `{per-dish detail}` line). It is
deliberately unstyled.

Notes for whoever runs it:
- Keep the fixed skeleton sentences exactly as written; only the three slots
  change. Swapping the boilerplate is how a library drifts into two looks.
- The `{cuisine}` slot is the bare cuisine adjective (Indian, Thai, Chinese, and
  so on). The skeleton already supplies "a home-style {cuisine} dish", so there is
  no article logic and no wrapping to fill; just drop the adjective in.
- The `{per-dish detail}` slot is the dish's line in `details.md`, looked up by
  slug. Each line names the dish's true form, cut, garnish, dry-vs-gravy state, and
  texture, so the image renders the right ingredients (sliced okra, not whole pods;
  plain roti, not garnished; halved eggs; a dry dish dry). If a dish has no line
  (should not happen: `details.md` covers all 200), the generator falls back to the
  dish file's first-paragraph description so a new dish still renders. A new dish is
  added by appending one line to `details.md`; the skeleton does not change.
- The generation script applies one prompt-only transform after filling the
  slots: it rewrites the filter-tripping tokens "fried" and "sweet-salty" out of
  the assembled string (see "Filter-safe tokens" below). This never touches the
  dish file or `details.md` on disk.
- If the model returns a non-square image or one cropped tight to the edges,
  regenerate rather than post-processing. The output should arrive web-ready
  (see Output below) with no editing step in the pipeline.
- Per-dish art direction belongs in the dish's `details.md` line, reviewable as
  data, not in the skeleton; the skeleton's vessel and context cues carry the
  shared look and the per-dish seed carries the variety.

### Generation parameters

Fixed for the whole library; the candid-realism look depends on them as much as on
the prompt wording:

- `cfg_scale` 3.0 (lower guidance lets the model render looser, more natural food
  rather than the over-tight, plasticky composition higher guidance produces;
  lowered from 3.5 to further cut the over-styled CGI gloss the realism audit
  flagged as the #1 universal tell),
- `steps` 40 (more refinement steps for realistic texture),
- `width` / `height` 1024 (square source, see Crop below),
- per-dish seed: each dish's base seed is derived from its slug, so the library has
  varied vessels, angles, and backgrounds while a re-run reproduces the same set.
  Setting `IMAGE_SEED` pins every dish to one seed (used to A/B a prompt change).

### Filter-safe tokens

NVIDIA's FLUX.1-dev content filter false-positives on a few benign culinary
tokens, deterministically returning `finishReason: CONTENT_FILTERED` and a black
frame (seed-independent). The literal token "fried" is one (the verb "fry" is
fine); the adjacent "sweet-salty" is another; the hyphenated "flat-leaf" is a
third (it surfaced from the skeleton's coriander-not-parsley garnish cue; bisected
live, "flat-leaf" trips the filter while "flat leaf" without the hyphen and the
bare word "parsley" both pass, so only the hyphen needs to go). The generation
script rewrites these out of the assembled prompt string only (never the dish file
on disk) to a visually-equivalent synonym with no blocked substring, so the
rendered image still matches the dish: "stir-fried" -> "wok-tossed",
"deep/shallow fried" -> "pan-crisped", "fried rice" -> "stir-fry rice",
"fried onions" -> "golden browned onions", "fried patties" -> "golden patties", a
bare "fried" -> "pan-cooked", "sweet-salty" -> "sweet and savoury", and
"flat-leaf" -> "flat leaf" (so the skeleton's "never flat-leaf parsley" renders as
"never flat leaf parsley", same meaning, no blocked substring). It is a general
token transform applied to every prompt, so future dishes with these words are
handled automatically.

---

## Cuisine slot

The library spans roughly a dozen cuisines. The `{cuisine}` slot is the bare
cuisine adjective (the template supplies "a home-style {cuisine} dish", so there
is no article to pick and no wrapping to fill).

The cuisine for a dish is its first-class `cuisine:` frontmatter field (engine.md
§12), the single source of truth for cuisine across the app and this tool. The
field already holds the human-readable adjective ("Indian", "Thai", "Chinese",
"Greek", and so on), so the script reads it straight into the slot with no tag
scan and no decoding table. A dish whose field is somehow blank falls back to
**Indian**, the library's default.

The cuisine vocabulary in the library is: Indian (the default for the untagged
originals and the fruit bowls), Italian, Chinese, Mexican, Greek, Spanish,
Korean, Japanese, Continental, Vietnamese, Lebanese, Mediterranean, and Thai.

Notes on two judgment calls baked into the field values:

- **Thai**: the dishes that were tagged `oriental` (pad thai, the Thai curries,
  Thai basil chicken, Thai pineapple fried rice) carry `cuisine: Thai`.
- **Singapore noodles** is a Chinese-Malay curry-powder noodle dish, not Thai,
  so it carries `cuisine: Chinese` (Rajat's call: the closest honest single-word
  cuisine for the photo). This is now a plain field value, not a code override.

---

## Style parameters

Each is fixed for the whole library. They are also encoded in the prompt above;
this section is the human-readable contract, the prompt is the machine input.

- **Framing and angle.** A natural angle, the way a person actually photographs
  their own meal: low or three-quarter rather than flat overhead, with a shallow
  depth of field. The dish fills its vessel like a real portion, not a small
  centred mound. The per-dish seed lets the angle vary across the library so the
  set does not read as one repeated template.
- **Lighting.** Ordinary warm indoor light or soft daylight, with gentle natural
  shadows. No harsh specular highlights, no on-camera flash, never blown out.
- **Vessel and plating.** A real everyday vessel that genuinely suits the dish: a
  steel katori or thali, a karahi or kadai, a cast-iron pan, or a plain home
  plate. The food is served the way it actually comes to the table, not styled or
  arranged. This is candid documentary food photography, not restaurant plating
  or tweezer styling.
  - **Cooked-and-imperfect food.** The most important cue. The food looks
    genuinely cooked and a little imperfect: real browning and char where it has
    been cooked; the correct real texture and consistency for the dish (a dry dish
    stays dry, a gravy is thick, opaque, and oil-flecked with pieces
    half-submerged, rice is loose separate grains, a pudding is loose and soft);
    irregular hand-made shapes rather than identical pieces; oil sheen, uneven
    edges, stray crumbs, and a little mess.
  - **Garnish.** Scattered naturally as it really would be, never a single sprig
    placed in the centre. Where a dish is garnished with green herb leaves, the
    skeleton forces fresh green coriander (cilantro), never flat-leaf parsley:
    the realism audit found flat parsley standing in for coriander was a recurring
    ingredient tell.
  - **Props policy:** the vessel and a softly out-of-focus home or restaurant
    background carry the frame. This is enforced **positively** in the prompt, not
    by a list of forbidden objects: the prompt names what is in frame (the dish in
    its vessel, the blurred context) and does not say "no cutlery", "no hands",
    and so on. The reason is mechanical: FLUX is a guidance-distilled model family
    that barely honors negative instructions, and naming an object in order to
    exclude it tends to summon it (the model attends to the noun, not the
    negation). Any future "keep X out of frame" rule is expressed the same way:
    say what is in frame, never what is forbidden.
- **Background and context.** A real, slightly cluttered home or restaurant
  background, softly out of focus behind the dish. The shallow depth of field
  keeps it a quiet field rather than a competing scene, but it is a real context,
  not an empty studio sweep.
- **Color and mood.** Honest and true to life, never bright or oversaturated. The
  colours are the food's real colours under ordinary warm light, not the glossy,
  high-contrast look of stock or CGI food photography. The look reads as a real
  phone photo, a little imperfect, rather than a styled studio shot. The skeleton
  states this explicitly as a matte natural finish with true slightly-muted
  colours, not glossy, not oversaturated, not plastic-looking: the realism audit
  found a waxy/plastic CGI sheen and oversaturation to be the #1 universal AI
  tell, so the wording counters it head-on.
- **Crop and aspect ratio.** Square, 1:1. The source is square on purpose: the
  PWA renders photos with `object-fit: cover` at several different shapes, a
  small rounded square thumbnail on day cards and dish rows (about 40 to 48 px,
  `design_handoff/hifi-primitives.jsx`) and wider landscape crops elsewhere: a
  16:9 strip on Explore cards and a 5:2 hero on the dish detail sheet, both pinned
  by `aspect-ratio` so the crop is identical on every phone width (a fixed pixel
  height against a fluid width made the crop viewport-dependent and showed the
  vessel rim on narrow phones; see CHANGELOG #93/#94). The square source survives
  all of these crops: the square thumb is a lossless center, and the landscape
  crops center-crop without clipping the dish. Keep the dish well inside the frame
  so no crop touches it.
- **Output size and format.** Web-ready at generation, no post-processing
  dependency in the pipeline (slice 1.2 carried over a no-image-processing-library
  constraint; photos arrive already sized). Target a square JPEG, roughly
  1024 x 1024 px (a clean source for the small thumbnail and the wide strip
  alike), quality tuned so each file lands well under ~300 KB to keep the PWA
  bundle light. Format is `.jpg`. No alpha channel needed (photos are always
  full-bleed). If a model only emits PNG, convert to JPEG before committing; do
  not commit PNGs.

---

## Naming and placement

- One file per dish at `data/dish-photos/<slug>.jpg`, where `<slug>` exactly
  matches the dish's file slug (the `data/dishes/<slug>.md` basename). Example:
  the dish in `data/dishes/chicken-masala-gravy.md` gets
  `data/dish-photos/chicken-masala-gravy.jpg`.
- When the image lands, the dish file's optional `photo:` frontmatter field is
  set to the bare filename, `photo: chicken-masala-gravy.jpg` (the field already
  exists in the schema; see `engine/src/data/schemas.ts` and `docs/engine.md`
  §field reference). The blocking validator only fires on a **declared** `photo:`,
  so setting it and committing the file happen together in the same content-batch
  PR, never apart.
- Slugs are stable and never reused (slice 1.2 discipline), so a filename, once
  chosen, is permanent.

---

## Coverage

Coverage is complete: all 200 active dishes carry a photo. The PWA also has a
no-photo fallback (a quiet diagonal-stripe placeholder with a `+`, in the `Thumb`
primitive), so a dish without a photo renders as a clean text card rather than a
broken image, and partial coverage never looks broken. The coverage report
(`npm run reports`) tracks the percentage of active dishes with a photo. A dish the
provider declines to render (a deterministic content-filter block) is left to the
placeholder rather than shipped as a black frame; the library is allowed to be
partially photographed without any screen looking wrong.
