// Run: npx esbuild src/project/lines.check.ts --bundle --platform=node --packages=external | node
import { isLastInVerse, linesFromSegments, linesFromText, patchLine, removeLine, verseIndexes } from "./lines";

const l = linesFromText("a\nb\n\nc\n\n\nd\ne\r\n");
console.assert(l.length === 5 && l.map((x) => x.text).join() === "a,b,c,d,e", "parse");
console.assert(verseIndexes(l).join() === "0,0,1,2,2", "verses");
console.assert(isLastInVerse(l, 1) && isLastInVerse(l, 2) && !isLastInVerse(l, 3) && isLastInVerse(l, 4), "last in verse");

const t = patchLine(l, 3, { start: 5 });
console.assert(removeLine(t, 3).length === 4 && removeLine(t, 3)[3].newVerse === true, "next line takes the break");
console.assert(removeLine(t, 3).map((x) => x.start).join() === ",,,", "timings travel with their line");
console.assert(verseIndexes(removeLine(l, 2)).join() === "0,0,1,1", "single-line verse removed keeps neighbours apart");
console.assert(verseIndexes(removeLine(l, 3)).join() === "0,0,1,2", "first of verse removed passes the break on");
console.assert(removeLine(l, 0)[0].text === "b", "first line");

const s = linesFromSegments([{ start: 1, text: "x" }, { start: 3, text: "y" }, { start: 12, text: "z" }], 2);
console.assert(s.map((x) => x.start).join() === "1,10" && s.map((x) => x.newVerse).join() === "false,true", "segments");
console.log("lines ok");
console.assert(linesFromSegments([{ start: 1, text: "x" }, { start: 9, text: "y" }], 5).map((x) => `${x.text}${x.start}`).join() === "y4", "phrases before the video start are dropped");
