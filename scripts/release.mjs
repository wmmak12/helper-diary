// Build the release package: <out>/server (Next standalone + server.mjs) and <out>/site (static files).
// Run after `pnpm build`. <out> is release/ unless RELEASE_DIR names another folder.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.resolve(root, process.env.RELEASE_DIR || "release");
const server = path.join(out, "server");
const site = path.join(out, "site");
const standalone = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standalone, "server.js"))) throw new Error("run `pnpm build` first");

fs.rmSync(server, { recursive: true, force: true });
fs.rmSync(site, { recursive: true, force: true });
const copy = (a, b) => fs.cpSync(a, b, { recursive: true, dereference: true, verbatimSymlinks: false });
copy(standalone, server);
// local data written by dev runs never ships
fs.rmSync(path.join(server, ".data"), { recursive: true, force: true });
for (const f of [".env", ".env.local"]) fs.rmSync(path.join(server, f), { force: true });
copy(path.join(root, ".next", "static"), path.join(server, ".next", "static"));
copy(path.join(root, "public"), path.join(server, "public"));
// reader for the silent hold records (docs/testing.md): DATA_DIR=<data folder> node hold-records.mjs
fs.copyFileSync(path.join(root, "scripts", "hold-records.mjs"), path.join(server, "hold-records.mjs"));
// the owner's way back in after a forgotten password: DATA_DIR=<data folder> node reset-owner-password.mjs
fs.copyFileSync(path.join(root, "scripts", "reset-owner-password.mjs"), path.join(server, "reset-owner-password.mjs"));
// build-time-only or unused (images are unoptimized) packages stay out of the runtime package
for (const m of ["sharp", "@img", "typescript"]) fs.rmSync(path.join(server, "node_modules", m), { recursive: true, force: true });
fs.writeFileSync(
  path.join(server, "server.mjs"),
  `// Entrypoint: serves the app, its static files and its JSON API.
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
process.env.PORT ||= "8080";
process.env.HOSTNAME = process.env.HOST || "0.0.0.0";
process.env.DATA_DIR ||= path.join(here, ".data");
process.env.NODE_ENV = "production";
process.chdir(here);
await import("./server.js");
`,
);
// static copy for the site directory
copy(path.join(root, "public"), site);
copy(path.join(root, ".next", "static"), path.join(site, "_next", "static"));

// the package holds regular files only, so it can be copied anywhere
let links = 0;
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isSymbolicLink()) links++;
    else if (e.isDirectory()) walk(p);
  }
};
walk(out);
if (links) throw new Error(`${links} symlinks in ${out}`);
const rel = path.relative(root, out) || ".";
console.log(`release package written to ${rel}/server and ${rel}/site`);
