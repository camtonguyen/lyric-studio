// Run: npx esbuild src/project/song.check.ts --bundle --platform=node --packages=external | node
import { findLyrics, type LyricSource, type Song } from "./song";

const song = { file: { name: "x.mp3" }, duration: 10 } as Song;
const seg = [{ start: 1, text: "hi" }];
const calls: string[] = [];
const none: LyricSource = async () => { calls.push("none"); return null; };
const some: LyricSource = async () => { calls.push("some"); return seg; };
const never: LyricSource = async () => { calls.push("never"); return seg; };

console.assert((await findLyrics(song, () => {}, [none, some, never])) === seg && calls.join() === "none,some", "first source with lyrics wins, later ones aren't asked");
let err = "";
await findLyrics(song, () => {}, [none, async () => []]).catch((e) => (err = e.message));
console.assert(err === "no singing found", "nothing found → error");
console.log("song ok");
