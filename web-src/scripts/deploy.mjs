// Builds the SPA and publishes it into the repo root, which is what GitHub
// Pages actually serves. Only the SPA's own output is touched: /index.html,
// /404.html (same shell, so deep links boot the router) and /app/. Every
// other top-level folder (/assets, /autocode, /oxidized, ...) is left alone.
import { execSync } from "node:child_process";
import { cpSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const here = fileURLToPath(new URL("..", import.meta.url));
const root = join(here, "..");
const dist = join(here, "dist");

execSync("npx vite build", { cwd: here, stdio: "inherit" });

const appDir = join(root, "app");
for (const f of readdirSync(appDir)) rmSync(join(appDir, f), { recursive: true });
cpSync(join(dist, "app"), appDir, { recursive: true });
cpSync(join(dist, "index.html"), join(root, "index.html"));
cpSync(join(dist, "index.html"), join(root, "404.html"));

console.log("deployed dist/ -> repo root (index.html, 404.html, app/)");
