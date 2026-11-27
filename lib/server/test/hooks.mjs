// Lets `node --test` run the server modules as they are written for the bundler: "@/…" paths and extensionless
// relative imports. Use: node --import ./lib/server/test/hooks.mjs --test lib/server/test/*.test.ts
import { register } from "node:module";

if (!globalThis.__hooksRegistered) {
  globalThis.__hooksRegistered = true;
  register(new URL("./resolve.mjs", import.meta.url));
}
