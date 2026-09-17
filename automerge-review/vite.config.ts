import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  plugins: [wasm()],
  optimizeDeps: {
    // Without this exclusion Vite can initialize two JavaScript wrappers for
    // the same WASM module during development.
    exclude: ["@automerge/automerge-wasm"],
  },
  worker: {
    format: "es",
    plugins: () => [wasm()],
  },
});
