import { ApiError, intId, json, route } from "@/lib/server/api";
import { now, run, tx } from "@/lib/server/db";
import { syncHouseholdLangs } from "@/lib/server/backfill";

export const DELETE = route<{ id: string }>(
  async (_req, user, { id }) => {
    const uid = intId(id);
    if (uid === user.id) throw new ApiError(400, "cannot_remove_self");
    tx(() => {
      const r = run("UPDATE users SET removed_at = ? WHERE id = ? AND removed_at IS NULL AND is_admin = 0", now(), uid);
      if (!r.changes) throw new ApiError(404, "not_found");
      run("DELETE FROM sessions WHERE user_id = ?", uid);
    });
    syncHouseholdLangs(); // a language nobody reads any more is back-filled again if it returns
    return json({ ok: true });
  },
  { admin: true },
);
