export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
/** 0→1 progress of t between a and b. */
export const prog = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1));
export const round2 = (v: number) => +v.toFixed(2);
/** File name without its extension. */
export const baseName = (f: string) => f.replace(/\.\w+$/, "");
export const DEG = Math.PI / 180;

/** Small deterministic random generator (same video every render). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export function hashStr(str: string) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function formatTime(t: number) {
  t = Math.max(0, t);
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
}

// ---- 4×4 matrices, row-major, matching CSS transform functions ----
export type Mat4 = number[];
export const mul = (a: Mat4, b: Mat4): Mat4 => {
  const r = new Array(16).fill(0);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j];
      r[i * 4 + j] = s;
    }
  return r;
};
export const translate = (x: number, y: number): Mat4 => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, 0, 0, 0, 0, 1];
export const scale = (s: number): Mat4 => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
export const perspective = (d: number): Mat4 => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / d, 1];
export const rotX = (a: number): Mat4 => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; };
export const rotY = (a: number): Mat4 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; };
export const rotZ = (a: number): Mat4 => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
/** Row-major → column-major Float32Array for WebGL. */
export const toGL = (m: Mat4) => {
  const t = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) t[j * 4 + i] = m[i * 4 + j];
  return t;
};
