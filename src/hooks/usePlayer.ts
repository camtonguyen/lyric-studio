import { useState, useSyncExternalStore } from "react";
import { Player } from "../player/Player";

/** One Player for the app's lifetime. */
export function usePlayer() {
  const [player] = useState(() => new Player());
  return player;
}

/** Re-render when `select(player)` changes (e.g. the time, playing state). */
export function usePlayerValue<T>(player: Player, select: (p: Player) => T): T {
  return useSyncExternalStore(player.subscribe, () => select(player));
}
