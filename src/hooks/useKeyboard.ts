import { useEffect, useRef } from "react";

type Handlers = Partial<Record<"Space" | "Escape" | "ArrowLeft" | "ArrowRight", (e: KeyboardEvent) => void>>;

const TYPING_INPUTS = new Set(["text", "number", "search", "email", "url", ""]);

/** Global shortcuts, ignored while typing in a text field. */
export function useKeyboard(handlers: Handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
      if (el.tagName === "INPUT" && TYPING_INPUTS.has((el as HTMLInputElement).type)) return;
      const fn = ref.current[e.code as keyof Handlers];
      if (fn) { e.preventDefault(); fn(e); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
