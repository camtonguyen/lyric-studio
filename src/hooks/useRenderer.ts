import { useEffect, useRef, useState, type RefObject } from "react";
import { Renderer, loadCover, loadFonts, type Model } from "../engine";
import type { Player } from "../player/Player";

/** Mounts the engine on a canvas and redraws whenever time or the model changes. */
export function useRenderer(canvasRef: RefObject<HTMLCanvasElement>, model: Model, player: Player) {
  const rendererRef = useRef<Renderer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modelRef = useRef(model);
  const dirty = useRef(true);

  useEffect(() => {
    modelRef.current = model;
    rendererRef.current?.setModel(model);
    dirty.current = true;
    loadCover(model.settings.cover).then(() => { dirty.current = true; });
  }, [model]);

  useEffect(() => {
    let raf = 0, cancelled = false, lastT = -1;
    loadFonts()
      .then(() => {
        if (cancelled || !canvasRef.current) return;
        const r = new Renderer(canvasRef.current);
        r.setModel(modelRef.current);
        rendererRef.current = r;
        const loop = () => {
          const t = player.time();
          if (t !== lastT || dirty.current) {
            r.render(t);
            lastT = t;
            dirty.current = false;
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch((e: Error) => setError(e.message));
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [canvasRef, player]);

  /** Force a redraw on the next frame (e.g. after a resolution change). */
  const invalidate = () => { dirty.current = true; };
  return { rendererRef, error, invalidate };
}
