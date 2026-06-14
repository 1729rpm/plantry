# Dish photo style spec

The single source of truth for how every Plantry dish photo looks. Photos are
AI-generated, one dish at a time, by filling the prompt template below with a
dish's name and a short description and running it through an image model. Every
image, for the 121 dishes in the library today and all ~80 dishes the expansion
batches will add, is generated from this one document, so the whole library
reads as if one photographer shot it on one afternoon (Decision #4 in
`features/design-revamp.md` §3). The consistency lives in this committed spec,
not in anyone's memory: a run six months from now, on a different machine, that
follows this file produces a photo that sits next to the originals without a
seam.

This is an internal spec. Claude Code cannot generate images, so the actual
files are produced outside the session (a human runs the prompt through an image
model) and dropped into `data/dish-photos/` in a later content batch (track B2.2+
in `features/design-revamp.md` §4.2). This file is the committable half of the
work: it fixes the look before any pixels exist.

---

## Prompt template

Fill the three slots from the dish's data file, then run verbatim. `{dish name}`
is the file's `name` field; `{short description}` is the first body paragraph of
the dish file (the one-line description), trimmed to a phrase; `{cuisine}` is the
dish's cuisine adjective derived per the map below. Everything outside the slots
is fixed and must not be reworded between runs (the fixed wording is what holds
the style steady).

```
An everyday phone photo of {dish name} ({short description}), a dish of {cuisine} home cooking, taken looking straight down from directly above. It is a single helping served the way it actually comes to the table, not styled or arranged, on a plain simple ceramic plate or bowl on an ordinary kitchen surface, lit by soft daylight from a nearby window with gentle natural shadows. The colours are true to life and the textures look real and a little uneven, the way home food really looks. The plate sits centred in the frame with a comfortable margin of bare surface on every side. Casual, realistic, unpolished documentary food photography, square 1:1.
```

The look this prompt aims for is a candid home phone photo: the dish as it
actually lands on the table, shot from straight overhead in soft window light, on
a plain everyday plate or bowl. It is deliberately unstyled and a little uneven.
An earlier styled-stoneware, flat-lay-with-a-prop direction read as glossy CGI
rather than real food; this candid framing is the correction.

Notes for whoever runs it:
- Keep the fixed sentences exactly as written; only the three slots change.
  Swapping the boilerplate is how a library drifts into two looks.
- The `{cuisine}` slot is the bare cuisine adjective (Indian, Thai, Chinese, and
  so on). The template already supplies "a dish of {cuisine} home cooking", so
  there is no article logic and no "home-cooked dish" wrapping to fill; just drop
  the adjective in.
- The generation script applies one prompt-only transform after filling the
  slots: it rewrites the literal token "fried" out of the assembled string (see
  the "fried" token note below). This never touches the dish file on disk.
- If the model returns a non-square image or one cropped tight to the edges,
  regenerate rather than post-processing. The output should arrive web-ready
  (see Output below) with no editing step in the pipeline.
- Do not add per-dish art direction ("on a banana leaf", "with a side of rice")
  unless the dish genuinely is that thing; the point is uniformity.

### Generation parameters

Fixed for the whole library; the candid-realism look depends on them as much as on
the prompt wording:

- `cfg_scale` 3.5 (lower guidance lets the model render looser, more natural food
  rather than the over-tight, plasticky composition higher guidance produces),
- `steps` 40 (more refinement steps for realistic texture),
- `width` / `height` 1024 (square source, see Crop below).

### The "fried" token

NVIDIA's FLUX.1-dev content filter false-positives on the literal token "fried"
(it deterministically returns `finishReason: CONTENT_FILTERED` and a black frame,
seed-independent); the verb "fry" is fine. The generation script rewrites "fried"
out of the assembled prompt string only (never the dish file on disk) to a
visually-equivalent synonym with no "fried" substring, so the rendered image still
matches the dish: "stir-fried" -> "wok-tossed", "deep/shallow fried" ->
"pan-crisped", "fried rice" -> "stir-fry rice", "fried onions" -> "golden browned
onions", "fried patties" -> "golden patties", and a bare "fried" -> "pan-cooked".
It is a general token transform applied to every prompt, so future "fried" dishes
are handled automatically.

---

## Cuisine slot

The library spans roughly ten cuisines, so the cuisine phrase is derived per
dish rather than hardcoded. The `{cuisine}` slot is the full phrase
"a {Adjective} home-cooked dish" or "an {Adjective} home-cooked dish" (pick the
article that reads naturally before the adjective). Only the adjective varies;
the "home-cooked dish" wording is fixed like the rest of the template.

The slot is the bare cuisine adjective (the template supplies "a dish of
{cuisine} home cooking", so there is no article to pick and no wrapping to fill).

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

- **Framing and angle.** Straight down from directly above, the casual overhead
  angle of a phone snap. One helping, plate centred, with a comfortable margin of
  bare surface on every side. Overhead is the one angle that survives both crops
  the UI applies (see Crop below), which is why it is fixed rather than left to
  taste.
- **Lighting.** Soft daylight from a nearby window, with gentle natural shadows.
  No harsh specular highlights, no on-camera flash. Bright enough to read on a
  phone in daylight, never blown out.
- **Plating and styling.** A plain, simple everyday ceramic plate or bowl (a bowl
  for gravies and dals, a plate for dry dishes and breads) on an ordinary kitchen
  surface. The food is served the way it actually comes to the table, not styled
  or arranged: textures look real and a little uneven, the way home food really
  looks. This is candid documentary food photography, not restaurant plating or
  tweezer styling.
  - **Props policy:** minimal. The frame is just the dish on its plate or bowl on
    a plain kitchen surface, with bare margin around it. No styling props, no
    cutlery, no hands, no second plate, no text or labels, no busy garnish. An
    empty margin is on-style; clutter is not.

    This intent is enforced **positively** in the prompt, not by a list of
    forbidden objects. The prompt names only what is in frame (a single helping on
    a plain plate or bowl on an ordinary surface, centred with bare margin) and
    does not say "no cutlery", "no fork", "no hands", and so on. The reason is
    mechanical: FLUX is a guidance-distilled model family that barely honors
    negative instructions, and naming an object in order to exclude it tends to
    summon it (the model attends to the noun, not the negation). Any future "keep
    X out of frame" rule is expressed the same way: say what is in frame, never
    what is forbidden.
- **Background.** An ordinary plain kitchen surface around the plate, nothing else
  in frame. The background is a quiet field, never a scene.
- **Color and mood.** True to life, casual, realistic, unpolished. The colours are
  the food's real colours under soft daylight, not the oversaturated, glossy,
  high-contrast look of stock or CGI food photography. The look reads as a real
  home phone photo, a little imperfect, rather than a styled studio shot.
- **Crop and aspect ratio.** Square, 1:1. The source is square on purpose: the
  PWA renders photos with `object-fit: cover` at two very different shapes, a
  small rounded square thumbnail on day cards and dish rows (about 40 to 48 px,
  `design_handoff/hifi-primitives.jsx`) and a wide, short hero strip on Explore
  cards (full width, 96 px tall, `design_handoff/hifi-screens.jsx`). A centered
  subject in a square frame survives both: the square thumb is a lossless
  center, and the wide strip center-crops without ever clipping the dish.
  Generate with the food centered and comfortable headroom on all four edges so
  neither crop touches it.
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
  PR, never apart. This spec does not set any `photo:` field; that is the photo
  batches' job.
- Slugs are stable and never reused (slice 1.2 discipline), so a filename, once
  chosen, is permanent.

---

## Coverage

Photos are optional during the transition. The PWA has a no-photo fallback (a
quiet diagonal-stripe placeholder with a `+`, in the `Thumb` primitive), so a
dish without a photo renders as a clean text card rather than a broken image, and
partial coverage never looks broken. Photo batches (B2.2+) burn coverage down
toward complete; the coverage report (`npm run reports`) tracks the percentage of
active dishes with a photo. There is no deadline by which every dish must have
one; the library is allowed to be partially photographed indefinitely without any
screen looking wrong.
