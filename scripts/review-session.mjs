// The whole way in for a browser review or a flow check.
// start(): runs the built app (release/server, or $RELEASE_DIR/server) on a temporary data directory with fixture admin values,
// seeds it, and resolves to { origin, stop }. signIn(page, who?) signs a Playwright page in through the real form.
// Run directly: starts the app, prints the origin and the demo sign-ins, and stays up.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const FIXTURE = { email: "admin@example.test", password: "review-password-123" };
export const PEOPLE = {
  admin: { login: FIXTURE.email, password: FIXTURE.password },
  mei: { login: "mei", password: "mei-review-123" },
  mya: { login: "mya", password: "mya-review-123" },
};

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}

export async function start() {
  const entry = path.join(root, process.env.RELEASE_DIR || "release", "server/server.mjs");
  if (!fs.existsSync(entry)) throw new Error("build first: pnpm build && pnpm release");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "helper-diary-"));
  const env = { ...process.env, DATA_DIR: dataDir, APP_ADMIN_EMAIL: FIXTURE.email, APP_ADMIN_PASSWORD: FIXTURE.password, NODE_ENV: "development" };
  const seedOut = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", path.join(root, "scripts/seed-review.ts")], { env, cwd: root }).toString();
  const port = await freePort();
  const child = spawn(process.execPath, [entry], { env: { ...env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const origin = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${origin}/api/session`);
      if (r.ok) break;
    } catch {
      /* starting */
    }
    if (child.exitCode !== null) throw new Error("app exited:\n" + log);
    await new Promise((r) => setTimeout(r, 200));
  }
  const stop = async () => {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
  };
  return { origin, stop, seedOut, dataDir, log: () => log };
}

/** Sign a Playwright page in through the real form. `who` is admin (default), mei or mya. */
export async function signIn(page, who = "admin", origin) {
  const p = PEOPLE[who];
  const base = origin ?? new URL(page.url()).origin;
  await page.goto(`${base}/signin`);
  await page.fill('input[name="login"]', p.login);
  await page.fill('input[name="password"]', p.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 15000 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await start();
  console.log(s.seedOut.trim());
  console.log(`Open ${s.origin}`);
  process.on("SIGINT", async () => {
    await s.stop();
    process.exit(0);
  });
}
