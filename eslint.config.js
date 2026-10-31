import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

// Layers, lowest first. Each may import itself and the layers listed.
const layers = {
  shared: [],
  audio: ["shared"],
  project: ["shared", "audio"], // audio: types only (Segment)
  engine: ["shared", "project"],
  export: ["shared", "engine", "audio"],
  hooks: ["shared", "audio", "project", "engine", "export"],
  components: ["shared", "audio", "project", "engine", "hooks"],
  headless: ["shared", "project", "engine"],
  app: ["shared", "audio", "project", "engine", "hooks", "components"],
};

export default [
  { files: ["src/**/*.{ts,tsx}"], languageOptions: { parser: tseslint.parser } },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { alwaysTryTypes: true } },
      "boundaries/elements": [
        ...Object.keys(layers).filter((t) => t !== "app").map((type) => ({ type, partialMatch: false, pattern: `src/${type}/**` })),
        { type: "app", partialMatch: false, pattern: "src/*.{ts,tsx}" },
      ],
    },
    rules: {
      "boundaries/dependencies": [2, {
        default: "disallow",
        policies: Object.entries(layers).map(([type, deps]) => ({
          from: { element: { type } },
          allow: { to: { element: { types: { anyOf: [type, ...deps] } } } },
        })),
      }],
    },
  },
];
