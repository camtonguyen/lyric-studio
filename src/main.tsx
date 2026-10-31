import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// `?headless` = used by scripts/render.mjs for frame-perfect Node rendering.
if (new URLSearchParams(location.search).has("headless")) {
  import("./headless/headless").then((m) => m.startHeadless());
} else {
  import("./App").then(({ default: App }) =>
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );
}
