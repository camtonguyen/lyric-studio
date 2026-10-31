import { useRef, useState, type RefObject } from "react";
import type { Renderer } from "../engine";
import { recordVideo } from "../export/recordVideo";
import type { Player } from "../audio/Player";
import { downloadBlob } from "../project/storage";

export type ExportStatus =
  | { state: "idle" }
  | { state: "recording"; progress: number }
  | { state: "done"; url: string; name: string }
  | { state: "error"; message: string };

export function useExporter(canvasRef: RefObject<HTMLCanvasElement>, rendererRef: RefObject<Renderer | null>, player: Player) {
  const [status, setStatus] = useState<ExportStatus>({ state: "idle" });
  const abort = useRef<AbortController | null>(null);

  async function start(width: number, baseName: string) {
    if (!canvasRef.current || !rendererRef.current) return;
    abort.current = new AbortController();
    setStatus({ state: "recording", progress: 0 });
    try {
      const result = await recordVideo({
        canvas: canvasRef.current,
        renderer: rendererRef.current,
        player,
        width,
        signal: abort.current.signal,
        onProgress: (progress) => setStatus({ state: "recording", progress }),
      });
      if (!result) { setStatus({ state: "idle" }); return; }
      const name = `${baseName || "lyric-video"}.${result.ext}`;
      setStatus({ state: "done", url: downloadBlob(result.blob, name), name });
    } catch (e) {
      setStatus({ state: "error", message: (e as Error).message });
    }
  }

  const cancel = () => abort.current?.abort();
  return { status, start, cancel, exporting: status.state === "recording" };
}
