import { FONT, FONT_SIZE } from "./constants";

/** Monospace character width, measured once the font has loaded. */
export const metrics = { charWidth: 33.6 };

export async function loadFonts() {
  await document.fonts.load(`800 ${FONT_SIZE}px ${FONT}`);
  await document.fonts.load(`500 30px ${FONT}`);
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = `800 ${FONT_SIZE}px ${FONT}`;
  metrics.charWidth = ctx.measureText("M".repeat(10)).width / 10;
}
