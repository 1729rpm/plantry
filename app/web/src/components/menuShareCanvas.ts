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
// WHY THIS SHAPE (share-image refresh)
// ------------------------------------
// The "This week" PNG arrived soft in WhatsApp. The cause was not our render
// resolution (we already exported at 3x): WhatsApp re-encodes every shared image
// to JPEG and downscales it so its longest side fits a cap of about 1600px. The
// old menu was a tall portrait (~360 x 960 layout units), so WhatsApp shrank it
// until the height fit and dragged the width down to ~540px, softening the text.
// The fix is the shape: a compact, near-square single-column ledger (600 wide,
// ~754 tall, aspect ~1.26) exported at S = 2 -> 1200 x 1508. Because 1508 < 1600
// WhatsApp ships it un-downscaled, so the in-chat width stays ~1200px (about 2x
// sharper). EXPORT_SCALE is therefore 2 on purpose: pushing past ~2.1 sends the
// long edge over 1600 and re-triggers WhatsApp's downscale, buying nothing.
//
// Recipe sheets stay on html-to-image (they have not shown the bug). Grocery is
// no longer in the share family.

import type { CurrentWeek } from "../lib/types.js";
import { weekRangeLabel } from "../lib/days.js";
import { buildShareDayModels, type ShareDayModel } from "./ShareImages.js";

// Logical width matches the ledger design (600px). The backing store is scaled
// by EXPORT_SCALE for the bitmap. All geometry below is in LOGICAL (CSS) pixels;
// ctx.scale maps it to the backing store. EXPORT_SCALE = 2 keeps the long edge
// under WhatsApp's ~1600 cap (see the file header).
const WIDTH = 600;
export const EXPORT_SCALE = 2;

// Palette: app tokens plus the warmer share-surface literals already used by the
// existing share images. Kept in sync with the handoff geometry.
const COLOR = {
  frameBg: "#FBF6ED", // image background (warm cream)
  panelBg: "#FFFEFA", // ledger panel
  panelBorder: "#EBE2D2", // panel border + row hairline
  ink: "#2C241B", // --pt-ink
  sub: "#94846F", // --pt-sub
  green: "#5F7355", // --pt-green (meal labels)
  footer: "#B5A78F", // Plantry wordmark
};

const FONT_SANS = '"Source Sans 3", "Helvetica Neue", sans-serif';
const FONT_SERIF = '"Source Serif 4", Georgia, serif';

// Frame padding: top 30, right 26, bottom 24, left 26. Content width = 548.
const PAD_TOP = 30;
const PAD_RIGHT = 26;
const PAD_BOTTOM = 24;
const PAD_LEFT = 26;
const CONTENT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT; // 548

// Header (centered, margin-bottom 22): title "This week" serif 700 30px; sub
// (date range) sans 400 15px, margin-top 4.
const TITLE_SIZE = 30;
const TITLE_BLOCK = 33; // serif title block height (~1.1 line-height, cap/descenders)
const SUB_SIZE = 15;
const SUB_GAP = 4;
const SUB_BLOCK = 18;
const HEADER_GAP = 22;
const HEADER_BLOCK = TITLE_BLOCK + SUB_GAP + SUB_BLOCK; // 55

// Ledger panel: border 1px, radius 16.
const PANEL_BORDER = 1;
const PANEL_RADIUS = 16;

// Day row: column gap 16; padding 14 top/bottom x 18 left/right; 1px bottom
// hairline between rows (none on the last).
const ROW_PAD_Y = 14;
const ROW_PAD_X = 18;
const COL_GAP = 16;

// Date rail (width 40, fixed): weekday "MON" sans 700 10px tracked 0.12em
// uppercase; date "15" serif 600 24px line-height 1.1.
const RAIL_WIDTH = 40;
const WEEKDAY_SIZE = 10;
const WEEKDAY_TRACK = 0.12;
const WEEKDAY_BLOCK = 13;
const DATE_SIZE = 24;
const DATE_BLOCK = 26;
const RAIL_HEIGHT = WEEKDAY_BLOCK + DATE_BLOCK; // 39

// Meals column: vertical stack, gap 6, one labeled line per present meal.
const MEALS_GAP = 6;
// Meal line: flex gap 10. Label width 66 (sans 700 9.5px tracked 0.08em
// uppercase green, padding-top 3). Value (sans 400 14px, line advance 20).
const LABEL_WIDTH = 66;
const LABEL_GAP = 10;
const LABEL_SIZE = 9.5;
const LABEL_TRACK = 0.08;
const LABEL_PAD_TOP = 3;
const VALUE_SIZE = 14;
const LINE_ADVANCE = 20; // round(14 * 1.4)

// Value column width = 548 - 2 (panel border) - 18 - 18 (row padding) - 40
// (rail) - 16 (column gap) - 66 (label) - 10 (label gap) = 378.
const VALUE_WIDTH =
  CONTENT_WIDTH - PANEL_BORDER * 2 - ROW_PAD_X * 2 - RAIL_WIDTH - COL_GAP - LABEL_WIDTH - LABEL_GAP;

// Skipped day: one "Skipped" line, sans 14px sub.
const SKIPPED_SIZE = 14;

// Footer "Plantry" serif 15px footer-color, letter-spacing 0.06em, centered,
// margin-top 18.
const FOOTER_GAP = 18;
const FOOTER_SIZE = 15;
const FOOTER_BLOCK = 20;
const FOOTER_TRACK = 0.06;

// The faces/weights/sizes we actually draw. measureText/fillText silently fall
// back to a system font if the webfont is not yet loaded, which would change
// wrap points and break the layout->draw contract; we load every one before the
// layout pass. (Source Sans 3 at 400 and 700; Source Serif 4 at 600 and 700,
// matching the <link> in index.html.)
const REQUIRED_FONTS = [
  `400 ${SUB_SIZE}px "Source Sans 3"`,
  `400 ${VALUE_SIZE}px "Source Sans 3"`,
  `400 ${SKIPPED_SIZE}px "Source Sans 3"`,
  `700 ${WEEKDAY_SIZE}px "Source Sans 3"`,
  `700 ${LABEL_SIZE}px "Source Sans 3"`,
  `600 ${DATE_SIZE}px "Source Serif 4"`,
  `600 ${FOOTER_SIZE}px "Source Serif 4"`,
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

// Wrap one value string to lines that fit maxWidth using the live ctx font (set
// by the caller before calling). Manual, greedy: split on single spaces, fit as
// many tokens as fit, no hyphenation, no mid-word break. A lone token wider than
// maxWidth (rare) overflows on its own line rather than breaking, per the spec.
function wrapValue(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ").filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

// Draw text with manual letter-spacing (em fraction), returning the visible
// advance. Canvas letterSpacing exists but is not universally supported; manual
// spacing keeps the uppercase labels visually identical to the CSS values.
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
  label: string; // "Breakfast" | "Lunch" | "Fruit" (drawn uppercase)
  lines: string[];
  height: number; // max(13, lineCount * 20)
}

interface DayLayout {
  model: ShareDayModel;
  meals: MealLayout[]; // empty when skipped
  skipped: boolean;
  rowHeight: number;
}

// One present-meal block height: max(13, lineCount * 20). One line = 20.
function mealLineHeight(lineCount: number): number {
  return Math.max(13, lineCount * LINE_ADVANCE);
}

// LAYOUT PASS: wrap every meal's value to the value column width, count lines,
// and compute each meal block, each row, and the panel + image heights. ctx is
// used only to measure here; the font is set per measurement.
function layoutMenu(
  ctx: CanvasRenderingContext2D,
  days: ShareDayModel[],
): { days: DayLayout[]; panelHeight: number; totalHeight: number } {
  const laidOut: DayLayout[] = days.map((model) => {
    if (model.skipped) {
      // Skipped row: the meals block is a single 20px line.
      const mealsHeight = LINE_ADVANCE;
      return {
        model,
        meals: [],
        skipped: true,
        rowHeight: ROW_PAD_Y + Math.max(RAIL_HEIGHT, mealsHeight) + ROW_PAD_Y,
      };
    }
    const meals: MealLayout[] = [];
    const addMeal = (label: string, names: string[]) => {
      if (names.length === 0) return;
      ctx.font = `400 ${VALUE_SIZE}px ${FONT_SANS}`;
      const lines = wrapValue(ctx, names.join(", "), VALUE_WIDTH);
      meals.push({ label, lines, height: mealLineHeight(lines.length) });
    };
    addMeal("Breakfast", model.breakfast);
    addMeal("Lunch", model.lunch);
    addMeal("Fruit", model.fruit);
    const mealsHeight =
      meals.reduce((sum, m) => sum + m.height, 0) + Math.max(0, meals.length - 1) * MEALS_GAP;
    return {
      model,
      meals,
      skipped: false,
      rowHeight: ROW_PAD_Y + Math.max(RAIL_HEIGHT, mealsHeight) + ROW_PAD_Y,
    };
  });

  const panelHeight =
    laidOut.reduce((sum, d) => sum + d.rowHeight, 0) + PANEL_BORDER * 2;

  // imageHeight = pad-top + header + header gap + panel + footer gap + footer +
  // pad-bottom.
  const totalHeight =
    PAD_TOP +
    HEADER_BLOCK +
    HEADER_GAP +
    panelHeight +
    FOOTER_GAP +
    FOOTER_BLOCK +
    PAD_BOTTOM;

  return { days: laidOut, panelHeight, totalHeight: Math.ceil(totalHeight) };
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

// DRAW PASS: paint header, the ledger panel with each day row at its computed y,
// and the footer wordmark. Because y-positions come from the layout pass's
// measured line counts, meals can never overlap. Assumes ctx is already scaled
// to EXPORT_SCALE and the canvas is sized.
function paintMenu(
  ctx: CanvasRenderingContext2D,
  laidOut: { days: DayLayout[]; panelHeight: number; totalHeight: number },
  rangeLabel: string,
) {
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Frame background.
  ctx.fillStyle = COLOR.frameBg;
  ctx.fillRect(0, 0, WIDTH, laidOut.totalHeight);

  let y = PAD_TOP;

  // Header (centered).
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR.ink;
  ctx.font = `700 ${TITLE_SIZE}px ${FONT_SERIF}`;
  ctx.fillText("This week", WIDTH / 2, y + TITLE_SIZE);
  y += TITLE_BLOCK + SUB_GAP;
  ctx.fillStyle = COLOR.sub;
  ctx.font = `400 ${SUB_SIZE}px ${FONT_SANS}`;
  ctx.fillText(rangeLabel, WIDTH / 2, y + SUB_SIZE);
  y += SUB_BLOCK + HEADER_GAP;
  ctx.textAlign = "left";

  // Ledger panel.
  const panelX = PAD_LEFT;
  const panelY = y;
  const panelW = CONTENT_WIDTH;
  const panelH = laidOut.panelHeight;

  ctx.fillStyle = COLOR.panelBg;
  roundRect(ctx, panelX, panelY, panelW, panelH, PANEL_RADIUS);
  ctx.fill();
  ctx.lineWidth = PANEL_BORDER;
  ctx.strokeStyle = COLOR.panelBorder;
  roundRect(ctx, panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1, PANEL_RADIUS);
  ctx.stroke();

  // Day rows, stacked inside the panel border.
  const railX = panelX + PANEL_BORDER + ROW_PAD_X;
  const valueX = railX + RAIL_WIDTH + COL_GAP + LABEL_WIDTH + LABEL_GAP;
  let rowY = panelY + PANEL_BORDER;

  laidOut.days.forEach((d, i) => {
    const rowH = d.rowHeight;

    // Date rail (left-aligned): weekday tracked uppercase, then the date.
    ctx.fillStyle = COLOR.sub;
    ctx.font = `700 ${WEEKDAY_SIZE}px ${FONT_SANS}`;
    drawTracked(
      ctx,
      d.model.short.toUpperCase(),
      railX,
      rowY + ROW_PAD_Y + WEEKDAY_SIZE,
      WEEKDAY_TRACK,
      WEEKDAY_SIZE,
    );
    ctx.fillStyle = COLOR.ink;
    ctx.font = `600 ${DATE_SIZE}px ${FONT_SERIF}`;
    ctx.fillText(String(d.model.dateNum), railX, rowY + ROW_PAD_Y + WEEKDAY_BLOCK + DATE_SIZE);

    // Meals column.
    let my = rowY + ROW_PAD_Y;
    if (d.skipped) {
      ctx.fillStyle = COLOR.sub;
      ctx.font = `400 ${SKIPPED_SIZE}px ${FONT_SANS}`;
      ctx.fillText("Skipped", railX + RAIL_WIDTH + COL_GAP, my + SKIPPED_SIZE);
    } else {
      d.meals.forEach((meal, mi) => {
        if (mi > 0) my += MEALS_GAP;
        // Label (green, uppercase, tracked, padding-top 3), aligned to the
        // label column; the value sits in its own column to its right.
        ctx.fillStyle = COLOR.green;
        ctx.font = `700 ${LABEL_SIZE}px ${FONT_SANS}`;
        drawTracked(
          ctx,
          meal.label.toUpperCase(),
          railX + RAIL_WIDTH + COL_GAP,
          my + LABEL_PAD_TOP + LABEL_SIZE,
          LABEL_TRACK,
          LABEL_SIZE,
        );
        // Value lines (ink). Wrapped lines hang under the value, not the label.
        ctx.fillStyle = COLOR.ink;
        ctx.font = `400 ${VALUE_SIZE}px ${FONT_SANS}`;
        meal.lines.forEach((line, li) => {
          ctx.fillText(line, valueX, my + li * LINE_ADVANCE + VALUE_SIZE);
        });
        my += meal.height;
      });
    }

    rowY += rowH;

    // Bottom hairline between rows (none on the last).
    if (i < laidOut.days.length - 1) {
      ctx.strokeStyle = COLOR.panelBorder;
      ctx.lineWidth = PANEL_BORDER;
      ctx.beginPath();
      ctx.moveTo(panelX + PANEL_BORDER, rowY + 0.5);
      ctx.lineTo(panelX + panelW - PANEL_BORDER, rowY + 0.5);
      ctx.stroke();
    }
  });

  // Footer wordmark (centered, serif, tracked).
  const footerBaseY = panelY + panelH + FOOTER_GAP + FOOTER_SIZE;
  ctx.fillStyle = COLOR.footer;
  ctx.font = `600 ${FOOTER_SIZE}px ${FONT_SERIF}`;
  const mark = "Plantry";
  const markW = measureTracked(ctx, mark, FOOTER_TRACK, FOOTER_SIZE);
  drawTracked(ctx, mark, WIDTH / 2 - markW / 2, footerBaseY, FOOTER_TRACK, FOOTER_SIZE);
}

// Public API: lay out + draw the menu into the given canvas. Sizes the canvas
// backing store to logical*EXPORT_SCALE for the bitmap. On-screen display is
// governed by CSS (.share__menu-canvas: width:100%; height:auto), which scales
// the canvas to fit the slide frame using the intrinsic aspect ratio from the
// backing-store width/height attributes; we deliberately do not set an inline
// CSS size here, so the preview never overflows the rail. Fonts must be loaded
// first; call ensureMenuShareFonts() and await it before this.
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

  // Size the backing store at EXPORT_SCALE, then scale the context so all
  // drawing math stays in logical pixels. We do not set an inline CSS size:
  // .share__menu-canvas (width:100%; height:auto) sizes the on-screen box from
  // the backing store's intrinsic aspect ratio.
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
