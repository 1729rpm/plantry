// Canvas renderer for the week's menu share image.
//
// WHY A CANVAS, NOT html-to-image
// -------------------------------
// The menu share image overlapped on real iOS Safari: a breakfast dish list
// that wrapped to a second line collided with the LUNCH row below it. Root
// cause: html-to-image clones the DOM into an SVG <foreignObject> and FREEZES
// each element's computed pixel height, then re-wraps the text with the embedded
// webfont. On iOS Safari the foreignObject re-wraps to more lines than the
// frozen height allows, so the overflow spills onto the next meal. Two prior CSS
// layout fixes (inline label, then flex columns) did not fix it; it is specific
// to real iOS Safari foreignObject reflow and is not reproducible on desktop
// Chromium or Playwright-WebKit.
//
// The durable fix (Rajat's call): render the menu on an HTML <canvas> with
// manual text layout (measureText + manual line-breaking + fillText). There is
// no foreignObject and no reflow, so overlap is structurally impossible: every
// y-position is derived from the actual measured line count.
//
// SINGLE SOURCE (design-revamp §1.7)
// ----------------------------------
// The SAME canvas backs both the on-screen preview slide and the exported PNG,
// so the preview and the shared image cannot drift. drawMenuShareCanvas paints
// into a caller-supplied canvas; SharePreviewSheet shows that canvas in the rail
// and reads its blob in renderFiles.
//
// Grocery and recipe sheets stay on html-to-image (they have not shown the bug;
// converting them is out of scope). The shared foreignObject risk is noted in
// the PR diagnosis card.

import type { CurrentWeek } from "../lib/types.js";
import { weekRangeLabel } from "../lib/days.js";
import { buildShareDayModels, type ShareDayModel } from "./ShareImages.js";

// Logical width matches .share__capture / .share-img (360px). The backing store
// is scaled by EXPORT_SCALE for crispness, matching the old export's
// pixelRatio: 3. All geometry below is in LOGICAL (CSS) pixels; ctx.scale maps
// it to the backing store.
const WIDTH = 360;
export const EXPORT_SCALE = 3;

// Palette and metrics pulled verbatim from .share-img* in index.css and from
// design_handoff/hifi-share-image.jsx. Keep these in sync if the CSS changes.
const COLOR = {
  cardBg: "#fbf6ed", // .share-img background (warm cream)
  dayBg: "#fffefa", // .share-img__day
  dayBorder: "#ebe2d2", // .share-img__day / badge divider
  ink: "#2c241b", // --pt-ink
  sub: "#94846f", // --pt-sub
  green: "#5f7355", // --pt-green (meal labels)
  wordmark: "#b5a78f", // .share-img__wordmark
};

const FONT_SANS = '"Source Sans 3", "Helvetica Neue", sans-serif';
const FONT_SERIF = '"Source Serif 4", Georgia, serif';

// Frame padding: .share-img padding 26px 24px 20px (top, sides, bottom).
const PAD_TOP = 26;
const PAD_SIDE = 24;
const PAD_BOTTOM = 20;

// Heading: .share-img__heading margin-bottom 16; title serif 21/700; sub
// sans 12.5 sub-color, margin-top 3.
const TITLE_SIZE = 21;
const TITLE_LINE = 27; // serif title block height, generous for the cap/descenders
const SUB_SIZE = 12.5;
const SUB_GAP = 3;
const SUB_LINE = 16;
const HEADING_GAP = 16;

// Day cards: .share-img__day padding 10 12, border 1px, radius 12; gap 8.
const CARD_GAP = 8;
const CARD_PAD_Y = 10;
const CARD_PAD_X = 12;
const CARD_RADIUS = 12;

// Badge: .share-img__badge width 38, border-right 1px, padding-right 10.
const BADGE_WIDTH = 38;
const BADGE_PAD_RIGHT = 10;
const BADGE_DAY_SIZE = 9.5; // uppercase, letter-spacing 0.14em
const BADGE_DAY_TRACK = 0.14;
const BADGE_DATE_SIZE = 20; // serif 600, line-height 1.15
// Inner gap between badge column and meals column (.share-img__day gap: 12).
const COL_GAP = 12;

// Meals: .share-img__meals font 12.5 line-height 1.5. Label green 700 10.5
// uppercase letter-spacing 0.1em. Since we control geometry, we lay the label
// on its own line then the wrapped dish lines below it in a clean column, with a
// clear gap between meals (the handoff reads label then names).
const MEAL_LABEL_SIZE = 10.5;
const MEAL_LABEL_TRACK = 0.1;
const MEAL_LABEL_LINE = 15;
const MEAL_LABEL_GAP = 3; // space below a label before its dish lines
const DISH_SIZE = 12.5;
const DISH_LINE = 18; // 12.5 * 1.44, comfortable for cream card text
const MEAL_GAP = 8; // space between the breakfast block and the lunch block
const SKIPPED_SIZE = 12.5;
const SKIPPED_LINE = 18;

// Wordmark: .share-img__wordmark margin-top 18, serif 12, color wordmark,
// letter-spacing 0.06em, centered.
const WORDMARK_TOP = 18;
const WORDMARK_SIZE = 12;
const WORDMARK_TRACK = 0.06;
const WORDMARK_LINE = 15;

// The faces/weights/sizes we actually draw. measureText/fillText silently fall
// back to a system font if the webfont is not yet loaded, which would change
// wrap points and break the layout->draw contract; we load every one before the
// layout pass. (Source Sans 3 is loaded at 400 and 700; Source Serif 4 at 600
// and 700, matching the <link> in index.html.)
const REQUIRED_FONTS = [
  `400 ${SUB_SIZE}px "Source Sans 3"`,
  `400 ${DISH_SIZE}px "Source Sans 3"`,
  `400 ${SKIPPED_SIZE}px "Source Sans 3"`,
  `400 ${BADGE_DAY_SIZE}px "Source Sans 3"`,
  `700 ${MEAL_LABEL_SIZE}px "Source Sans 3"`,
  `600 ${BADGE_DATE_SIZE}px "Source Serif 4"`,
  `600 ${WORDMARK_SIZE}px "Source Serif 4"`,
  `700 ${TITLE_SIZE}px "Source Serif 4"`,
];

// Resolve once and cache, so repeated share opens do not re-await fonts. A
// rejected load (offline cold start) still resolves: we proceed and let the CSS
// fallback face draw rather than throwing and showing no image at all.
let fontsReadyPromise: Promise<void> | null = null;

export function ensureMenuShareFonts(): Promise<void> {
  if (fontsReadyPromise) return fontsReadyPromise;
  fontsReadyPromise = (async () => {
    const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fontSet) return; // very old browser: rely on whatever is available
    try {
      await Promise.all(REQUIRED_FONTS.map((f) => fontSet.load(f)));
      await fontSet.ready;
    } catch {
      // Offline or a face failed to load: draw with the fallback rather than
      // refusing to render. The fallback metrics differ slightly but the
      // layout-then-draw passes still keep meals from overlapping.
    }
  })();
  return fontsReadyPromise;
}

// Wrap one string to lines that fit maxWidth using the live ctx font (set by
// the caller before calling). Splits on spaces; a single token longer than the
// column is broken character by character so it can never overflow the card.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      // Fits, or the line is empty (must place at least one word). If a single
      // word is itself too wide, hard-break it below.
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      // line is empty and the lone word is too wide: hard-break the word.
      let chunk = "";
      for (const ch of word) {
        const next = chunk + ch;
        if (ctx.measureText(next).width > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = next;
        }
      }
      line = chunk;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draw text with manual letter-spacing (em fraction), returning nothing. Canvas
// letterSpacing exists but is not universally supported; manual spacing keeps
// the uppercase labels visually identical to the CSS letter-spacing values.
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  trackEm: number,
  fontSize: number,
): number {
  const track = trackEm * fontSize;
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + track;
  }
  // The trailing track is not part of the visible advance; subtract it.
  return cursor - x - track;
}

function measureTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  trackEm: number,
  fontSize: number,
): number {
  const track = trackEm * fontSize;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + track;
  return w - (text.length > 0 ? track : 0);
}

// One meal's laid-out lines plus its measured block height.
interface MealLayout {
  label: string; // "Breakfast" | "Lunch" (already cased; drawn uppercase)
  lines: string[];
  height: number;
}

interface DayLayout {
  model: ShareDayModel;
  meals: MealLayout[]; // empty when skipped
  skipped: boolean;
  contentHeight: number; // height of the meals column (badge column is shorter)
  cardHeight: number;
}

// LAYOUT PASS: wrap every meal's dish string to the dishes column width, count
// lines, and compute each meal block, each card, and the total height. Returns
// the layout plus the total logical canvas height. ctx is used only to measure
// here; the font is set per measurement.
function layoutMenu(
  ctx: CanvasRenderingContext2D,
  days: ShareDayModel[],
): { days: DayLayout[]; totalHeight: number } {
  const dishesColX = PAD_SIDE + BADGE_WIDTH + BADGE_PAD_RIGHT + COL_GAP + CARD_PAD_X;
  // dishes column width = card inner width minus the badge column minus the gap.
  const cardInnerWidth = WIDTH - PAD_SIDE * 2 - CARD_PAD_X * 2;
  const dishesWidth = cardInnerWidth - BADGE_WIDTH - BADGE_PAD_RIGHT - COL_GAP;
  void dishesColX;

  const laidOut: DayLayout[] = days.map((model) => {
    if (model.skipped) {
      const contentHeight = SKIPPED_LINE;
      return {
        model,
        meals: [],
        skipped: true,
        contentHeight,
        cardHeight: contentHeight + CARD_PAD_Y * 2,
      };
    }
    const meals: MealLayout[] = [];
    const addMeal = (label: string, names: string[]) => {
      if (names.length === 0) return;
      ctx.font = `400 ${DISH_SIZE}px ${FONT_SANS}`;
      const lines = wrapText(ctx, names.join(", "), dishesWidth);
      const height = MEAL_LABEL_LINE + MEAL_LABEL_GAP + lines.length * DISH_LINE;
      meals.push({ label, lines, height });
    };
    addMeal("Breakfast", model.breakfast);
    addMeal("Lunch", model.lunch);
    // Total content = sum of meal blocks + gaps between them.
    const contentHeight =
      meals.reduce((sum, m) => sum + m.height, 0) + Math.max(0, meals.length - 1) * MEAL_GAP;
    // A card with no meals (no breakfast, no lunch, not skipped) still gets a
    // minimum height so the badge has room.
    const safeContent = Math.max(contentHeight, BADGE_DATE_SIZE + BADGE_DAY_SIZE);
    return {
      model,
      meals,
      skipped: false,
      contentHeight: safeContent,
      cardHeight: safeContent + CARD_PAD_Y * 2,
    };
  });

  let total = PAD_TOP;
  total += TITLE_LINE + SUB_GAP + SUB_LINE + HEADING_GAP;
  laidOut.forEach((d, i) => {
    total += d.cardHeight;
    if (i < laidOut.length - 1) total += CARD_GAP;
  });
  total += WORDMARK_TOP + WORDMARK_LINE;
  total += PAD_BOTTOM;
  return { days: laidOut, totalHeight: Math.ceil(total) };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// DRAW PASS: paint header, each day card at its computed y, and the wordmark.
// Because y-positions come from the layout pass's measured line counts, meals
// can never overlap. Assumes ctx is already scaled to EXPORT_SCALE and the
// canvas is sized; clears first so re-draws (re-open) start clean.
function paintMenu(
  ctx: CanvasRenderingContext2D,
  laidOut: { days: DayLayout[]; totalHeight: number },
  rangeLabel: string,
) {
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Frame background.
  ctx.fillStyle = COLOR.cardBg;
  ctx.fillRect(0, 0, WIDTH, laidOut.totalHeight);

  let y = PAD_TOP;

  // Heading (centered).
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.ink;
  ctx.font = `700 ${TITLE_SIZE}px ${FONT_SERIF}`;
  ctx.fillText("This week", WIDTH / 2, y + TITLE_SIZE);
  y += TITLE_LINE + SUB_GAP;
  ctx.fillStyle = COLOR.sub;
  ctx.font = `400 ${SUB_SIZE}px ${FONT_SANS}`;
  ctx.fillText(rangeLabel, WIDTH / 2, y + SUB_SIZE);
  y += SUB_LINE + HEADING_GAP;
  ctx.textAlign = "left";

  const cardX = PAD_SIDE;
  const cardW = WIDTH - PAD_SIDE * 2;
  const badgeColX = cardX + CARD_PAD_X;
  const badgeCenterX = badgeColX + BADGE_WIDTH / 2;
  const dividerX = badgeColX + BADGE_WIDTH + BADGE_PAD_RIGHT;
  const dishX = dividerX + COL_GAP;

  laidOut.days.forEach((d, i) => {
    const cardY = y;
    const cardH = d.cardHeight;

    // Card surface + border.
    ctx.fillStyle = COLOR.dayBg;
    roundRect(ctx, cardX, cardY, cardW, cardH, CARD_RADIUS);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLOR.dayBorder;
    roundRect(ctx, cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1, CARD_RADIUS);
    ctx.stroke();

    // Badge column (centered text) + right divider.
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.sub;
    ctx.font = `400 ${BADGE_DAY_SIZE}px ${FONT_SANS}`;
    const dayText = d.model.short.toUpperCase();
    // Manual tracking, centered: measure the tracked width, start left of center.
    const dayW = measureTracked(ctx, dayText, BADGE_DAY_TRACK, BADGE_DAY_SIZE);
    ctx.textAlign = "left";
    drawTracked(
      ctx,
      dayText,
      badgeCenterX - dayW / 2,
      cardY + CARD_PAD_Y + BADGE_DAY_SIZE,
      BADGE_DAY_TRACK,
      BADGE_DAY_SIZE,
    );
    ctx.textAlign = "center";
    ctx.fillStyle = COLOR.ink;
    ctx.font = `600 ${BADGE_DATE_SIZE}px ${FONT_SERIF}`;
    ctx.fillText(
      String(d.model.dateNum),
      badgeCenterX,
      cardY + CARD_PAD_Y + BADGE_DAY_SIZE + 4 + BADGE_DATE_SIZE,
    );
    ctx.textAlign = "left";

    // Badge divider.
    ctx.strokeStyle = COLOR.dayBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dividerX + 0.5, cardY + CARD_PAD_Y);
    ctx.lineTo(dividerX + 0.5, cardY + cardH - CARD_PAD_Y);
    ctx.stroke();

    // Meals column.
    let my = cardY + CARD_PAD_Y;
    if (d.skipped) {
      ctx.fillStyle = COLOR.sub;
      ctx.font = `400 ${SKIPPED_SIZE}px ${FONT_SANS}`;
      ctx.fillText("Skipped", dishX, my + SKIPPED_SIZE);
    } else {
      d.meals.forEach((meal, mi) => {
        if (mi > 0) my += MEAL_GAP;
        // Label line (green, uppercase, tracked).
        ctx.fillStyle = COLOR.green;
        ctx.font = `700 ${MEAL_LABEL_SIZE}px ${FONT_SANS}`;
        drawTracked(
          ctx,
          meal.label.toUpperCase(),
          dishX,
          my + MEAL_LABEL_SIZE,
          MEAL_LABEL_TRACK,
          MEAL_LABEL_SIZE,
        );
        my += MEAL_LABEL_LINE + MEAL_LABEL_GAP;
        // Dish lines (ink).
        ctx.fillStyle = COLOR.ink;
        ctx.font = `400 ${DISH_SIZE}px ${FONT_SANS}`;
        meal.lines.forEach((line) => {
          ctx.fillText(line, dishX, my + DISH_SIZE);
          my += DISH_LINE;
        });
      });
    }

    y += cardH;
    if (i < laidOut.days.length - 1) y += CARD_GAP;
  });

  // Wordmark (centered, serif, tracked).
  y += WORDMARK_TOP;
  ctx.fillStyle = COLOR.wordmark;
  ctx.font = `600 ${WORDMARK_SIZE}px ${FONT_SERIF}`;
  const mark = "Plantry";
  const markW = measureTracked(ctx, mark, WORDMARK_TRACK, WORDMARK_SIZE);
  drawTracked(ctx, mark, WIDTH / 2 - markW / 2, y + WORDMARK_SIZE, WORDMARK_TRACK, WORDMARK_SIZE);
}

// Public API: lay out + draw the menu into the given canvas. Sizes the canvas
// backing store to logical*EXPORT_SCALE for crispness (matching the old export's
// pixelRatio: 3). On-screen display is governed by CSS (.share__menu-canvas:
// width:100%; height:auto), which scales the canvas to fit the slide frame using
// the intrinsic aspect ratio from the backing-store width/height attributes; we
// deliberately do not set an inline CSS size here, so the preview never overflows
// the rail. Fonts must be loaded first; call
// ensureMenuShareFonts() and await it before this, or pass a font-ready ctx.
//
// Returns the logical { width, height } so the caller can size the slide frame.
export function drawMenuShareCanvas(
  canvas: HTMLCanvasElement,
  week: CurrentWeek,
): { width: number; height: number } {
  const days = buildShareDayModels(week);
  const rangeLabel = weekRangeLabel(week.weekStart);

  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: WIDTH, height: 0 };

  // Layout uses a fresh transform (logical units, no scale) for measurement.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const laidOut = layoutMenu(ctx, days);

  // Size the backing store at 3x, then scale the context so all drawing math
  // stays in logical pixels. We do not set an inline CSS size: .share__menu-canvas
  // (width:100%; height:auto) sizes the on-screen box from the backing store's
  // intrinsic aspect ratio, so the preview fits the slide frame instead of
  // overflowing it at a fixed 360px.
  canvas.width = WIDTH * EXPORT_SCALE;
  canvas.height = laidOut.totalHeight * EXPORT_SCALE;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);

  paintMenu(ctx, laidOut, rangeLabel);
  return { width: WIDTH, height: laidOut.totalHeight };
}

// Export the menu canvas to a PNG Blob, the same surface the preview shows.
export function menuCanvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
