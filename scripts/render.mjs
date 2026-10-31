#!/usr/bin/env node
/**
 * Frame-perfect render (optional). Uses the same engine as the editor, in headless Chromium,
 * and encodes with ffmpeg (H.264 + AAC). Slower than the in-browser export, but never drops frames.
 *
 *   npm run render -- project.json song.mp3 out.mp4 [--width=1080] [--from=0 --to=10]
 *
 * Needs: ffmpeg on PATH, and Playwright's Chromium (`npx playwright install chromium`).
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split("=")[1];
const [projectPath, songPath, outPath = "lyric-video.mp4"] = args.filter((a) => !a.startsWith("--"));
if (!projectPath) {
  console.log("Usage: npm run render -- project.json [song.mp3] [out.mp4] [--width=1080] [--from=S --to=S]");
  process.exit(1);
}

const dist = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
if (!existsSync(join(dist, "index.html"))) { console.error("Run `npm run build` first."); process.exit(1); }

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("Playwright is missing: npm i playwright && npx playwright install chromium"); process.exit(1); }

// tiny static server for dist/
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const server = createServer((req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = existsSync(p) && statSync(p).isFile() ? p : join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

// Prefer the real GPU (fast); fall back to software WebGL (slow but works everywhere).
async function launch() {
  for (const args of [["--ignore-gpu-blocklist", "--enable-gpu"], ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]]) {
    const b = await chromium.launch({ args });
    const p = await b.newPage();
    if (await p.evaluate(() => !!document.createElement("canvas").getContext("webgl2"))) { await p.close(); return b; }
    await b.close();
  }
  throw new Error("WebGL2 is not available in headless Chromium.");
}
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://localhost:${port}/?headless`);
  await page.waitForFunction(() => window.lyricStudio, null, { timeout: 30000 });

  const project = JSON.parse(readFileSync(projectPath, "utf8"));
  const { duration, fps } = await page.evaluate(([p, w]) => window.lyricStudio.load(p, w), [project, +flag("width", 1080)]);
  const from = +flag("from", 0), to = Math.min(+flag("to", duration), duration);
  const total = Math.round((to - from) * fps);

  const ffArgs = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-"];
  if (songPath) ffArgs.push("-ss", String(from + (project.settings?.audioStart ?? 0)), "-i", songPath, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "192k", "-shortest");
  ffArgs.push("-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath);
  const ff = spawn("ffmpeg", ffArgs, { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((r, j) => { ff.on("close", (c) => (c === 0 ? r() : j(new Error(`ffmpeg exited with ${c}`)))); ff.on("error", j); });

  const started = Date.now();
  for (let f = 0; f < total; f++) {
    const url = await page.evaluate((t) => window.lyricStudio.frame(t), from + f / fps);
    if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(",") + 1), "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % fps === 0) {
      const eta = ((Date.now() - started) / (f + 1)) * (total - f) / 1000;
      process.stdout.write(`\rframe ${f}/${total}  ~${Math.ceil(eta)}s left   `);
    }
  }
  ff.stdin.end();
  await ffDone;
  console.log(`\nSaved ${outPath}`);
} finally {
  await browser.close();
  server.close();
}
