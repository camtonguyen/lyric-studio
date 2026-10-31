/** Turns plain lyric lines into colourful "code". */

export type Token = [text: string, color: string | null];

const CONJUNCTIONS = new Set(["and", "but", "so", "because", "if", "or", "just", "when", "cause", "then"]);

const COLORS = {
  punct: "#767c86",
  conj: "#ff4436",
  i: "#ff3b30",
  you: "#ffb347",
  arg: "#f2c46c",
  method: "#8db5ff",
  word: "#c3cede",
  comment: "#e2b366",
};

/** "the kettle and the city" → "  .the.kettle.and.the(city)" */
export function lyricToCode(raw: string, lastInVerse: boolean) {
  let s = raw.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9() ]/g, " ").replace(/\s+/g, " ").trim() || "_";
  if (!s.includes("(")) {
    const words = s.split(" ");
    if (words.length > 1) {
      const last = words.pop();
      s = `${words.join(" ")} (${last})`;
    }
  }
  s = s.replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")").replace(/ /g, ".");
  const conj = CONJUNCTIONS.has(s.split(/[.(]/)[0]);
  const text = (conj ? "" : "  .") + s + (lastInVerse ? ";" : "");
  return { text, tokens: tokenize(text, conj) };
}

export function commentLine(comment: string) {
  const text = "// " + comment;
  return { text, tokens: [[text, COLORS.comment]] as Token[] };
}

function tokenize(code: string, conj: boolean): Token[] {
  const out: Token[] = [];
  const re = /(\s+)|([a-z0-9_]+)|([.();])/g;
  let depth = 0;
  let firstWord = true;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[1]) { out.push([m[1], null]); continue; }
    if (m[3]) {
      if (m[3] === "(") depth++;
      if (m[3] === ")") depth--;
      out.push([m[3], COLORS.punct]);
      continue;
    }
    const w = m[2];
    const next = code[re.lastIndex];
    let color = COLORS.word;
    if (firstWord && conj) color = COLORS.conj;
    else if (w === "i") color = COLORS.i;
    else if (w === "you" || w === "me") color = COLORS.you;
    else if (depth > 0) color = COLORS.arg;
    else if (next === "(") color = COLORS.method;
    firstWord = false;
    out.push([w, color]);
  }
  return out;
}
