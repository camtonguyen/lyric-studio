// Run: npx esbuild src/project/transcribe.check.ts --bundle --platform=node --packages=external | node
import { splitSegment } from "./transcribe";

const lines = [
  "remember when i told you no matter where i go",
  "i'll never leave your side, you will never be alone",
  "even when it goes through changes, even when we roll",
  "remember that i told you i'll find my way back home",
].flatMap((t, i) => splitSegment(t, i * 4.5, i * 4.5 + 4.5));
console.assert(lines.length === 8, "8 lines");
console.assert(lines[0].text === "remember when i told you" && lines[7].text === "i'll find my way back home", "split in the right place");
console.assert(lines.every((l, i) => !i || l.start > lines[i - 1].start), "starts increase");
console.log(lines.map((l) => `${l.start.toFixed(2)} ${l.text}`).join("\n"));
