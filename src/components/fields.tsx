import { useEffect, useState, type ReactNode } from "react";

export function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open}>
      <summary>{title}</summary>
      <div className="sec">{children}</div>
    </details>
  );
}

/** Text input that commits on blur/Enter; `onCommit` returns false to reject (input reverts). */
export function BlurInput({ value, onCommit, list, title }: { value: string; onCommit(v: string): void; list?: string; title?: string }) {
  return (
    <input
      type="text" key={value} defaultValue={value} list={list} title={title}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={(e) => (e.target.value.trim() ? onCommit(e.target.value) : (e.target.value = value))}
    />
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label>
      {label}
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Number input that lets you type freely ("1.", "") and only commits valid numbers. */
export function NumberInput({ value, onChange, step = 0.1, min, max, placeholder, title }: {
  value: number | null; onChange(v: number | null): void; step?: number; min?: number; max?: number; placeholder?: string; title?: string;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(value === null ? "" : String(+value.toFixed(3))); }, [value, focused]);
  return (
    <input
      type="number" step={step} min={min} max={max} placeholder={placeholder} title={title} value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value === "") { if (placeholder) onChange(null); return; }
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

export function NumberField({ label, ...rest }: { label: string; value: number; onChange(v: number): void; step?: number; min?: number; max?: number }) {
  return (
    <label>
      {label}
      <NumberInput {...rest} onChange={(v) => v !== null && rest.onChange(v)} />
    </label>
  );
}

export function Slider({ label, value, onChange, min, max, step }: { label: string; value: number; onChange(v: number): void; min: number; max: number; step: number }) {
  return (
    <label>
      <span className="between">{label}<b>{value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

export function Check({ label, value, onChange }: { label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <label className="inline">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label className="inline">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} /> {label}
    </label>
  );
}
