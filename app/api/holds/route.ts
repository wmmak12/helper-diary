import { ApiError, body, json, route } from "@/lib/server/api";
import { cleanRecord, saveHoldRecord } from "@/lib/server/holds";

/**
 * POST /api/holds — the phone's silent record of a hold, a New talk or a load of Talk (shape: HoldRecordInput in
 * lib/types.ts). Employers only (they are the ones who hold). The team reads the full set from the server
 * (scripts/hold-records.mjs); the app's screens never read them.
 */
export const POST = route(async (req, user) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 64_000) throw new ApiError(413, "too_large");
  const rec = cleanRecord(await body(req));
  if (!rec) throw new ApiError(400, "bad_record");
  saveHoldRecord(user, rec);
  return json({ ok: true }, 201);
}, { employer: true });

