import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

export function createTestVite() {
  return createServer({
    appType: "custom",
    configFile: false,
    root: projectRoot,
    resolve: { alias: { "@": projectRoot } },
    server: { middlewareMode: true },
  });
}
