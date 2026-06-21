// Share preview + send. Opened from the Menu's "Share this week" button. Shows
// the shareable image family as a horizontal swipe rail (the menu image, then
// one recipe sheet per dish marked "include recipe when sharing"), the way the
// images arrive on WhatsApp, and a Send button that renders each slide to a PNG
// client-side and hands the set to the OS share sheet. The grocery list is
// internal only and is not part of this family.
//
// Rendering (design-revamp §1.7): the slides on screen and the exported PNGs
// come from the same source, so they cannot drift (the single-source
// discipline).
//   - MENU: a <canvas> rendered by menuShareCanvas.ts. The SAME canvas element
//     is shown in the rail and read for the export blob. The menu used to go
//     through html-to-image, but that froze each element's height and re-wrapped
//     the dish text inside an SVG foreignObject; on real iOS Safari it re-wrapped
//     to more lines than the frozen height allowed and the breakfast list spilled
//     onto the lunch row. The canvas lays text out manually (measureText +
//     manual line-breaking), so overlap is structurally impossible.
//   - RECIPE: still html-to-image. A hidden capture stage holds a 360px-wide
//     render of each; html-to-image walks that node and paints a PNG at
//     pixelRatio 3. Recipe sheets have not shown the foreignObject bug, so
//     converting them is out of scope (the shared risk is noted in the PR
//     diagnosis card).
//
// Delivery: the Web Share API level 2 (files) opens the native share sheet with
// all the PNGs attached, which is how an installed PWA shares into WhatsApp on
// both iOS and Android. When files-sharing is unavailable (desktop, older
// browsers) the fallback downloads every image so the user can attach them by
// hand. No server, no Convex action: the whole family is produced on the phone.

import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import type { Dish } from "@plantry/engine";
import type { CurrentWeek } from "../lib/types.js";
import { dishById } from "../lib/library.js";
import { weekRangeLabel } from "../lib/days.js";
import { Sheet, PrimaryButton } from "./primitives.js";
import { RecipeShareImage } from "./ShareImages.js";
import { drawMenuShareCanvas, ensureMenuShareFonts, menuCanvasToBlob } from "./menuShareCanvas.js";

interface SharePreviewSheetProps {
  week: CurrentWeek;
  onClose: () => void;
}

// A rail slide. The menu slide is the canvas (kind: "menu", no React node); the
// recipe slides are html-to-image capture nodes.
interface Slide {
  id: string;
  label: string;
  fileSlug: string;
  kind: "menu" | "capture";
  node?: React.ReactNode;
}

// The dishes the week has marked "include recipe when sharing", in week order,
// de-duplicated by dish id (the same dish placed twice rides one recipe sheet).
function includedDishes(week: CurrentWeek): Dish[] {
  const seen = new Set<number>();
  const out: Dish[] = [];
  for (const slot of week.slots) {
    for (const pick of slot.dishes) {
      if (!pick.includeRecipe || pick.dishId === null) continue;
      if (seen.has(pick.dishId)) continue;
      const dish = dishById(pick.dishId);
      if (!dish) continue;
      seen.add(pick.dishId);
      out.push(dish);
    }
  }
  return out;
}

function safeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dish"
  );
}

export function SharePreviewSheet({ week, onClose }: SharePreviewSheetProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  // The single canvas that backs both the menu preview slide and the menu PNG.
  const menuCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "working" | "shared" | "downloaded" | "error">(
    "idle",
  );

  const recipes = useMemo(() => includedDishes(week), [week]);
  const rangeLabel = weekRangeLabel(week.weekStart);

  // Render the menu canvas once the fonts are loaded. measureText/fillText fall
  // back silently to a system font if the webfont is not yet ready, which would
  // change wrap points and break the layout->draw contract, so we await the
  // exact faces/weights/sizes first and only then draw. Re-runs if the week
  // changes while the sheet is open.
  useEffect(() => {
    let cancelled = false;
    ensureMenuShareFonts().then(() => {
      if (cancelled) return;
      const canvas = menuCanvasRef.current;
      if (canvas) drawMenuShareCanvas(canvas, week);
    });
    return () => {
      cancelled = true;
    };
  }, [week]);

  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [
      {
        id: "menu",
        label: "Menu",
        fileSlug: "menu",
        kind: "menu",
      },
      ...recipes.map((dish) => ({
        id: `recipe-${dish.id}`,
        label: dish.name,
        fileSlug: `recipe-${safeSlug(dish.name)}`,
        kind: "capture" as const,
        node: <RecipeShareImage dish={dish} />,
      })),
    ];
    return list;
  }, [recipes]);

  // Render each slide to a PNG File, in rail order. Per-slide routing:
  //   - menu   -> the canvas's own toBlob (the same canvas shown in the rail);
  //              no html-to-image, so no foreignObject reflow.
  //   - others -> html-to-image walks the hidden capture node at pixelRatio 3.
  async function renderFiles(): Promise<File[]> {
    const stage = stageRef.current;
    const files: File[] = [];
    const nameFor = (slug: string) =>
      `plantry-${rangeLabel.replace(/\s+/g, "-").toLowerCase()}-${slug}.png`;

    for (const slide of slides) {
      let blob: Blob | null = null;
      if (slide.kind === "menu") {
        const canvas = menuCanvasRef.current;
        if (!canvas) continue;
        // Fonts must be loaded before the canvas is correct. The effect draws on
        // font-ready, but guard here in case Send fires during a cold start.
        await ensureMenuShareFonts();
        drawMenuShareCanvas(canvas, week);
        blob = await menuCanvasToBlob(canvas);
      } else {
        if (!stage) continue;
        const node = stage.querySelector<HTMLElement>(`[data-capture="${slide.id}"]`);
        if (!node) continue;
        // pixelRatio 3 matches the handoff's "exported at 3x" so the PNG is crisp
        // on a phone. cacheBust avoids a stale data-URL when the same node renders
        // twice across share attempts.
        blob = await toBlob(node, { pixelRatio: 3, cacheBust: true });
      }
      if (!blob) continue;
      files.push(new File([blob], nameFor(slide.fileSlug), { type: "image/png" }));
    }
    return files;
  }

  function downloadAll(files: File[]) {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next tick so the click has consumed the URL first.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  async function handleSend() {
    setStatus("working");
    try {
      const files = await renderFiles();
      if (files.length === 0) {
        setStatus("error");
        return;
      }
      // Web Share API level 2: share files into the native sheet when supported.
      // navigator.canShare gates on the actual files (some browsers expose share
      // but not file-sharing), so we only take this path when it will work.
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      const shareData: ShareData = {
        files,
        title: "Plantry",
        text: `This week's menu (${rangeLabel})`,
      };
      if (typeof nav.share === "function" && nav.canShare?.(shareData)) {
        try {
          await nav.share(shareData);
          setStatus("shared");
          return;
        } catch (err) {
          // A user cancel rejects with AbortError; that is not a failure, just
          // close quietly without falling through to a surprise download.
          if (err instanceof DOMException && err.name === "AbortError") {
            setStatus("idle");
            return;
          }
          // Any other share failure falls through to the download fallback.
        }
      }
      downloadAll(files);
      setStatus("downloaded");
    } catch (err) {
      console.error("share render failed", err);
      setStatus("error");
    }
  }

  const sending = status === "working";

  return (
    <Sheet onClose={onClose} tall>
      <div className="share__title">Share this week</div>
      <div className="share__sub">
        {slides.length} {slides.length === 1 ? "image" : "images"}, sent together. Swipe across to
        check them.
      </div>

      <div className={`share__rail${slides.length === 1 ? " share__rail--single" : ""}`}>
        {slides.map((slide, i) => (
          <div key={slide.id} className="share__slide">
            <div className="share__slide-label">
              {i + 1} of {slides.length} &middot; {slide.label}
            </div>
            <div className="share__slide-frame">
              {slide.kind === "menu" ? (
                // The menu canvas: drawn at 3x backing store, displayed at 100%
                // of the frame via .share__menu-canvas (width:100%; height:auto)
                // off the backing store's aspect ratio. This is the exact canvas
                // exported, so the preview and the PNG are one source.
                <canvas ref={menuCanvasRef} className="share__menu-canvas" />
              ) : (
                slide.node
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky footer: the status hints/error sit just above the Send button so
          they stay visible while the rail above scrolls, and Send stays pinned
          to the bottom of the sheet so it is always reachable. */}
      <div className="share__footer">
        {recipes.length === 0 && (
          <div className="share__hint">
            Turn on a dish&rsquo;s &ldquo;include recipe when sharing&rdquo; toggle to add recipe
            sheets.
          </div>
        )}

        {status === "error" && (
          <div className="share__error">Could not build the images. Please try again.</div>
        )}
        {status === "downloaded" && (
          <div className="share__hint">
            Images saved to this phone. Attach them in WhatsApp to send.
          </div>
        )}

        <PrimaryButton className="share__send" onClick={handleSend} disabled={sending}>
          {sending ? "Preparing images..." : "Send images"}
        </PrimaryButton>
      </div>

      {/* Hidden capture stage for the html-to-image slides (the recipe sheets).
          Each node renders at the share images' true 360px width, off-screen, so
          html-to-image can paint a crisp PNG without the giant render ever being
          visible. aria-hidden + off-screen, not display:none, because
          html-to-image needs a laid-out node to walk. The menu is NOT here: it
          is the canvas in the rail above, which exports itself. */}
      <div ref={stageRef} className="share__stage" aria-hidden="true">
        {slides
          .filter((slide) => slide.kind === "capture")
          .map((slide) => (
            <div key={slide.id} data-capture={slide.id} className="share__capture">
              {slide.node}
            </div>
          ))}
      </div>
    </Sheet>
  );
}
