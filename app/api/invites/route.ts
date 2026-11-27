import { ApiError, body, json, route } from "@/lib/server/api";
import { all, now, run } from "@/lib/server/db";
import { makeInviteCode } from "@/lib/server/auth";
import type { Invite } from "@/lib/types";

function list(): Invite[] {
  return all<Record<string, unknown>>(
    "SELECT i.*, u.name AS used_by_name FROM invites i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.created_at DESC",
  ).map((r) => ({
    code: r.code as string,
    role: (r.role as Invite["role"]) ?? null,
    created_at: r.created_at as number,
    status: r.used_by ? "used" : r.revoked_at ? "revoked" : "unused",
    used_by_name: (r.used_by_name as string) ?? null,
  }));
}

export const GET = route(async () => json({ invites: list() }), { admin: true });

export const POST = route(
  async (req, user) => {
    const b = await body(req);
    const role = b.role === "helper" || b.role === "employer" ? b.role : null;
    if (!role) throw new ApiError(400, "role_required");
    const code = makeInviteCode();
    run("INSERT INTO invites (code, role, created_by, created_at) VALUES (?,?,?,?)", code, role, user.id, now());
    return json({ code, invites: list() }, 201);
  },
  { admin: true },
);
