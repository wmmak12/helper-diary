import { ApiError, json, route } from "@/lib/server/api";
import { now, run } from "@/lib/server/db";

export const DELETE = route<{ code: string }>(
  async (_req, _user, { code }) => {
    const r = run("UPDATE invites SET revoked_at = ? WHERE code = ? AND used_by IS NULL AND revoked_at IS NULL", now(), code);
    if (!r.changes) throw new ApiError(409, "not_unused");
    return json({ ok: true });
  },
  { admin: true },
);
