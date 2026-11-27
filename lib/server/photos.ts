import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir, now, one, run } from "./db";
import { ApiError } from "./api";

// Photos live as files under DATA_DIR/photos and are only served to signed-in household members.
const MAX = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function dir() {
  const d = path.join(dataDir(), "photos");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export async function savePhoto(userId: number, file: File): Promise<string> {
  if (!TYPES[file.type]) throw new ApiError(415, "unsupported_image");
  if (file.size > MAX) throw new ApiError(413, "too_large");
  const id = crypto.randomBytes(12).toString("base64url");
  fs.writeFileSync(path.join(dir(), id), Buffer.from(await file.arrayBuffer()));
  run("INSERT INTO photos (id, uploader, mime, created_at) VALUES (?,?,?,?)", id, userId, file.type, now());
  return id;
}

export function readPhoto(id: string): { data: Buffer; mime: string } {
  if (!/^[A-Za-z0-9_-]{16}$/.test(id)) throw new ApiError(404, "not_found");
  const p = one<{ mime: string }>("SELECT mime FROM photos WHERE id = ?", id);
  if (!p) throw new ApiError(404, "not_found");
  return { data: fs.readFileSync(path.join(dir(), id)), mime: p.mime };
}

export function photoExists(id: unknown): id is string {
  return typeof id === "string" && !!one("SELECT id FROM photos WHERE id = ?", id);
}
