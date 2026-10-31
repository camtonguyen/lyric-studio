# Lyric Studio

Make vertical (9:16) lyric videos in which the lyrics are typed out as code in a 3D editor, with a film-style title card at the end. You can load an MP3, edit the lyrics, sync the timing to the song and export an MP4.

## Quick start

```bash
npm install
npm run dev        # open http://localhost:5173 in Chrome or Edge
```

1. **Song:** load your MP3 (max 2 minutes); its lyrics are extracted automatically. The video length matches the song. **Trim song to lyrics** lines the first lyric up with where the song gets loud, ends the video with the song and re-spreads the lyrics (replaces line timings).
2. **Lyrics & timing:** edit any extracted line, or who types it (main cursor or one of 5+ collaborators; every 3rd line is a collaborator by default). Remove wrong lines with ×.
3. **Sync:** click **Tap to sync**, press play, then press **Space** each time a line starts. You can fine-tune times in the table or by dragging blocks on the timeline. Dragging a block's right edge changes when it finishes typing.
4. **Export video:** records in real time with the song. Keep the tab visible while it runs.

Shortcuts: `Space` plays/pauses (or taps while tap-sync is on), `←`/`→` seek 1s (hold Shift for 5s), `Esc` stops tapping.

## Frame-perfect render with Node (optional)

The in-browser export is quick but records in real time, so a slow machine can drop frames. For a final render, save the project (**Project → Save project**) and run:

```bash
npx playwright install chromium     # once
npm run render -- my-project.json song.mp3 out.mp4
# options: --width=720   --from=10 --to=20  (render just one part)
```

This needs `ffmpeg` on your PATH. The output is H.264 + AAC MP4.

## Architecture

Layers, lowest first; each may import only itself and the layers below it. `npm run lint` enforces this ([eslint-plugin-boundaries](https://www.jsboundaries.dev/docs/overview/), rules in `eslint.config.js`).

```
src/
  shared/            Pure helpers with no imports: math.ts, lyrics.ts (lyric → coloured code tokens), template.ts
  audio/             Song import and playback
    song.ts          Import an MP3 once (length, decode, waveform) + find lyrics (lrclib, else Whisper)
    lrclib.ts, transcribe.ts   The two lyric sources
    Player.ts        Playback clock + MP3 (Web Audio), subscribable store
  project/           Project data and the rules on it (pure):
    lines.ts         Lyric lines: one record per line (text, verse break, name, timing)
    timing.ts        Timeline rules: line times, even spread, fit to song, trim
    types.ts, defaults.ts, storage.ts
  engine/            Framework-free renderer (no React). Same code in the browser and in Node.
    model.ts         Project → Model: code lines, typing times, camera shots
    camera.ts        Camera path: follows the cursor, cuts, pulls back for the ending
    surface.ts       Draws the flat editor (Canvas 2D), redrawing only rows that changed
    plane.ts         WebGL2: the editor as a 3D plane with depth-of-field + motion blur
    stage.ts         Ending title card, vignette, grain
    renderer.ts      Puts it together: new Renderer(canvas).setModel(m).render(t)
  export/            Real-time MediaRecorder export (video + song)
  hooks/             React glue: useProject, usePlayer, useRenderer, useExporter, useTapSync, useKeyboard
  components/        UI: Transport, Timeline, sidebar panels, form fields
  headless/          Page used by scripts/render.mjs (?headless)
  App.tsx, main.tsx  App shell
scripts/render.mjs   Node: headless Chromium → frames → ffmpeg (+ song)
```

Checks: `npx esbuild src/<dir>/<name>.check.ts --bundle --platform=node --format=esm --packages=external | node --input-type=module` (silent = pass, or prints `… ok`).

How data flows: `Project` (React state) → `buildModel()` (memoized) → `Renderer.setModel()`. The render loop draws `Renderer.render(player.time())` every frame. UI components subscribe to the `Player` for the time and playing state.

**Changing the look:**
- Colors of code words: `shared/lyrics.ts`
- Camera shots: `SHOT_PRESETS` in `engine/model.ts`
- Layout sizes: `engine/constants.ts`
- Ending title card: `engine/stage.ts`
