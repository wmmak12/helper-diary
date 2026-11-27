import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { SECTIONS, type Section } from "@/lib/types";

export const POST = route<{ id: string }>(async (req, user, { id }) => {
  const b = await body(req);
  const as = b.as === "merge" || b.as === "replace" || b.as === "new" ? b.as : undefined;
  return json(
    await hh.approveDraft(user, intId(id), {
      as,
      title: typeof b.title === "string" ? str(b.title, 200) : undefined,
      body: typeof b.body === "string" ? str(b.body, 8000) : undefined,
      section: SECTIONS.includes(b.section as Section) ? (b.section as Section) : undefined,
    }),
  );
}, { employer: true });
