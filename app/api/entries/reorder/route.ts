import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { SECTIONS, type Section } from "@/lib/types";

export const POST = route(async (req) => {
  const b = await body(req);
  if (!SECTIONS.includes(b.section as Section) || !Array.isArray(b.ids)) throw new ApiError(400, "bad_input");
  hh.reorderEntries(b.section as Section, (b.ids as unknown[]).map(Number).filter(Number.isInteger));
  return json({ ok: true });
}, { employer: true });
