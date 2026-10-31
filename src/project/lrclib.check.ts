// Run: npx esbuild src/project/lrclib.check.ts --bundle --platform=node --packages=external | node
import { parseLrc, pickSynced } from "./lrclib";

const segs = parseLrc("[00:06.04] Time\n[00:08.12] Touching your hand\n[00:10.00] \n[01:02.50] Hope");
console.assert(segs.length === 3 && segs[2].start === 62.5 && segs[0].text === "time", "parse");
const hits = [{ duration: 250, syncedLyrics: "a" }, { duration: 197, syncedLyrics: "b" }, { duration: 199, syncedLyrics: null }];
console.assert(pickSynced(hits, 198) === "b", "closest synced");
console.assert(pickSynced(hits, 20) === null, "no match for a clip");
console.log("lrclib ok");
