import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// assetsDir "app" (instead of Vite's default "assets") deliberately avoids
// colliding with /assets/, which already holds static passthrough files
// (game/, img/) shared with the non-React AutoCode page that stays
// outside this SPA.
export default defineConfig({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    assetsDir: "app",
    emptyOutDir: true,
  },
});
