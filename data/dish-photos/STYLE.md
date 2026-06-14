# Dish photo style spec

The single source of truth for how every Plantry dish photo looks. Photos are
AI-generated, one dish at a time, by filling the prompt template below with a
dish's name, a short description, and its cuisine, and running it through an image
model (`scripts/generate-dish-photos.mjs`). Every image, for all 200 dishes in the
library, is generated from this one document, so the whole library reads as one
honest set of real-looking food photos. The look lives in this committed spec, not
in anyone's memory: a run six months from now, on a different machine, that follows
this file produces a photo that sits next to the others without a seam.

The direction is candid realism: photos that look like a real person photographed
their own meal, not a styled studio shot or glossy CGI. Each dish is shot at a
natural angle in a real everyday vessel against a softly out-of-focus home or
restaurant background, in ordinary warm light, with food that looks genuinely
cooked and a little imperfect. The prompt was rewritten from a study of 60 real
reference photos against the prior AI set: the earlier overhead, plain-plate,
centred-mound direction read as too clean and styled, so the corrections (real
angle, real vessel and context, cooked-and-imperfect food, correct per-type
texture) are baked into the template below.

Variety across the library is now desired, not uniformity. The generation script
gives each dish its own base seed (derived from its slug), so vessels, backgrounds,
and angles differ from one dish to the next while a re-run still reproduces the same
set.

---

## Prompt template

Fill the three slots from the dish's data file, then run verbatim. `{dish name}`
is the file's `name` field; `{short description}` is the first body paragraph of
the dish file (the one-line description), trimmed to a phrase; `{cuisine}` is the
dish's cuisine adjective derived per the map below. Everything outside the slots
is fixed and must not be reworded between runs (the fixed wording is what holds
the look steady).

```
A real, candid food photograph of {dish name} ({short description}), a home-style {cuisine} dish, shot the way a person would actually photograph their own meal: from a natural angle, often low or three-quarter rather than flat overhead, with shallow depth of field and a real, slightly cluttered home or restaurant background softly out of focus. It is served in a real everyday vessel that genuinely suits the dish (a steel katori or thali, a karahi or kadai, a cast-iron pan, or a plain home plate), filling the vessel like a real portion, not a small centred mound. Ordinary warm indoor light or soft daylight with gentle natural shadows, and honest true-to-life colour that is not bright or oversaturated. Most important, the food looks genuinely cooked and a little imperfect: real browning and char where it has been cooked; the correct real texture and consistency for this dish (a dry, grilled, roasted or fried dish is served dry on a plate with charred or browned edges and absolutely no pooled sauce, gravy or liquid around it; only a gravy dish sits in sauce, which is then thick, opaque and oil-flecked with the pieces half-submerged; rice is loose separate grains; a pudding is loose and soft); irregular hand-made shapes rather than identical pieces; oil sheen, uneven edges, stray crumbs and a little mess; and any garnish scattered naturally as it really would be, never a single sprig placed in the centre. Shot on a phone, realistic and unstyled, square 1:1.
```

The look this prompt aims for: a real, candid food photo, the dish as it actually
lands on the table, shot at a natural angle (low or three-quarter, not flat
overhead) in a real everyday vessel against a softly blurred home context, in
ordinary warm light, with food that reads as genuinely cooked and a little
imperfect and with the correct real texture for its type. It is deliberately
unstyled.

Notes for whoever runs it:
- Keep the fixed sentences exactly as written; only the three slots change.
  Swapping the boilerplate is how a library drifts into two looks.
- The `{cuisine}` slot is the bare cuisine adjective (Indian, Thai, Chinese, and
  so on). The template already supplies "a home-style {cuisine} dish", so there is
  no article logic and no wrapping to fill; just drop the adjective in.
- The generation script applies one prompt-only transform after filling the
  slots: it rewrites the filter-tripping tokens "fried" and "sweet-salty" out of
  the assembled string (see "Filter-safe tokens" below). This never touches the
  dish file on disk.
- If the model returns a non-square image or one cropped tight to the edges,
  regenerate rather than post-processing. The output should arrive web-ready
  (see Output below) with no editing step in the pipeline.
- Do not add per-dish art direction beyond the three slots; the template's vessel
  and context cues carry the look, and the per-dish seed carries the variety.

### Generation parameters

Fixed for the whole library; the candid-realism look depends on them as much as on
the prompt wording:

- `cfg_scale` 3.5 (lower guidance lets the model render looser, more natural food
  rather than the over-tight, plasticky composition higher guidance produces),
- `steps` 40 (more refinement steps for realistic texture),
- `width` / `height` 1024 (square source, see Crop below),
- per-dish seed: each dish's base seed is derived from its slug, so the library has
  varied vessels, angles, and backgrounds while a re-run reproduces the same set.
  Setting `IMAGE_SEED` pins every dish to one seed (used to A/B a prompt change).

### Filter-safe tokens

NVIDIA's FLUX.1-dev content filter false-positives on a couple of benign culinary
tokens, deterministically returning `finishReason: CONTENT_FILTERED` and a black
frame (seed-independent). The literal token "fried" is one (the verb "fry" is
fine); the adjacent "sweet-salty" is another. The generation script rewrites these
out of the assembled prompt string only (never the dish file on disk) to a
visually-equivalent synonym with no blocked substring, so the rendered image still
matches the dish: "stir-fried" -> "wok-tossed", "deep/shallow fried" ->
"pan-crisped", "fried rice" -> "stir-fry rice", "fried onions" -> "golden browned
onions", "fried patties" -> "golden patties", a bare "fried" -> "pan-cooked", and
"sweet-salty" -> "sweet and savoury". It is a general token transform applied to
every prompt, so future dishes with these words are handled automatically.

---

## Cuisine slot

The library spans roughly ten cuisines, so the cuisine phrase is derived per
dish rather than hardcoded. The `{cuisine}` slot is the bare cuisine adjective
(the template supplies "a home-style {cuisine} dish", so there is no article to
pick and no wrapping to fill).

How to derive the cuisine for a dish:

1. Take the first cuisine tag in the dish's `tags:` list (tags are ordered;
   scan left to right and use the first one that is a cuisine tag).
2. Map it to an adjective via the table below.
3. If the dish has no cuisine tag, the cuisine is **Indian**. The roughly 110
   untagged originals are Indian home cooking, which is the library's default.

`HP`, `complete_meal`, `complete_carb`, and `fruit` are functional tags, not
cuisines; never treat them as a cuisine. A dish like `[HP, oriental]` is Thai
(skip `HP`, the first cuisine tag is `oriental`).

The cuisine-tag vocabulary in the library is exactly:

| Tag             | Cuisine adjective |
|-----------------|-------------------|
| `italian`       | Italian           |
| `chinese`       | Chinese           |
| `mexican`       | Mexican           |
| `greek`         | Greek             |
| `spanish`       | Spanish           |
| `korean`        | Korean            |
| `japanese`      | Japanese          |
| `continental`   | Continental       |
| `vietnamese`    | Vietnamese        |
| `lebanese`      | Lebanese          |
| `mediterranean` | Mediterranean     |
| `oriental`      | Thai              |
| (no cuisine tag)| Indian            |

`oriental` maps to Thai: the dishes tagged `oriental` are Thai (pad thai, the
Thai curries, Thai basil chicken, Thai pineapple fried rice). The one exception
is **Singapore noodles** (a Chinese-Malay curry-powder noodle dish, not Thai);
that dish's cuisine adjective is pinned to **Chinese** so it is not mislabelled
as Thai (Rajat's call: it is the closest honest single-word cuisine for the
photo). The pipeline hardcodes this single override by slug.

This table is the single source of truth for the tag-to-cuisine mapping; the
generation script reads its logic from here, so any future cuisine tag must be
added to this table first.

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
    been cooked; the correct real texture and consistency for the dish (a dry,
    grilled, roasted or fried dish is served dry on a plate with charred or
    browned edges and absolutely no pooled sauce, gravy or liquid around it; only
    a gravy dish sits in sauce, which is then thick, opaque and oil-flecked with
    the pieces half-submerged; rice is loose separate grains; a pudding is loose
    and soft); irregular hand-made shapes rather than identical pieces; oil sheen,
    uneven edges, stray crumbs, and a little mess.
  - **Garnish.** Scattered naturally as it really would be, never a single sprig
    placed in the centre.
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
  phone photo, a little imperfect, rather than a styled studio shot.
- **Crop and aspect ratio.** Square, 1:1. The source is square on purpose: the
  PWA renders photos with `object-fit: cover` at two very different shapes, a
  small rounded square thumbnail on day cards and dish rows (about 40 to 48 px,
  `design_handoff/hifi-primitives.jsx`) and a wide, short hero strip on Explore
  cards (full width, 96 px tall, `design_handoff/hifi-screens.jsx`). The square
  source survives both crops: the square thumb is a lossless center, and the wide
  strip center-crops without clipping the dish. Keep the dish well inside the
  frame so neither crop touches it.
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
