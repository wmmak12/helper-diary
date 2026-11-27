import { ApiError, intId, json, route } from "@/lib/server/api";
import { makePasswordReset, ResetError } from "@/lib/server/auth";
import type { PasswordResetMade } from "@/lib/types";

/**
 * POST /api/members/[id]/reset → PasswordResetMade (5.5, owner only). A one-time code for a member who forgot their
 * password; they use it at /reset. Their password and sessions stay as they are until the code is used. The owner's
 * own account is 404 here: that password is reset on the server (scripts/reset-owner-password.mjs).
 */
export const POST = route<{ id: string }>(
  async (_req, user, { id }) => {
    try {
      const made: PasswordResetMade = makePasswordReset(intId(id), user.id);
      return json(made, { status: 201, headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof ResetError) throw new ApiError(404, "not_found");
      throw e;
    }
  },
  { admin: true },
);
