import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

export const PATCH = route<{ id: string }>(async (req, _user, { id }) => {
  const b = await body(req);
  return json({
    draft: hh.editDraft(intId(id), {
      title: typeof b.title === "string" ? str(b.title, 200) : undefined,
      body: typeof b.body === "string" ? str(b.body, 8000) : undefined,
      merged_body: typeof b.merged_body === "string" ? str(b.merged_body, 8000) : undefined,
    }),
  });
}, { employer: true });
