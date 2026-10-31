import { useState } from "react";
import type { Model } from "../engine";
import { round2 } from "../shared/math";
import type { Player } from "../audio/Player";
import type { ProjectActions } from "./useProject";

/**
 * "Tap to sync": while the song plays, each tap sets the start time of the
 * selected line and moves the selection to the next line.
 */
export function useTapSync(model: Model, player: Player, actions: ProjectActions, selected: number, setSelected: (i: number) => void) {
  const [active, setActive] = useState(false);

  function toggle() {
    if (active) { setActive(false); return; }
    player.pause();
    player.seek(Math.max(0, (model.lyrics[selected]?.t0 ?? 0) - 3));
    setActive(true);
  }

  function tap() {
    if (!active || selected >= model.lyrics.length) return;
    if (!player.playing) { player.play(); return; }
    actions.setTiming(selected, { start: round2(player.time()), end: null });
    if (selected + 1 >= model.lyrics.length) setActive(false);
    else setSelected(selected + 1);
  }

  return { active, toggle, tap, stop: () => setActive(false) };
}
