import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** A fresh DATA_DIR and no server AI, before any server module opens the database. Deleted when the test file ends. */
export function freshDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hd-test-"));
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
  process.env.DATA_DIR = dir;
  delete process.env.AI_BASE_URL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.APP_ADMIN_EMAIL;
  delete process.env.APP_ADMIN_PASSWORD;
  return dir;
}
