import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { photoExists } from "@/lib/server/photos";

export const POST = route<{ id: string }>(async (req, user, { id }) => {
  const b = await body(req);
  if (!photoExists(b.photo)) throw new ApiError(400, "bad_photo");
  const speaker = b.speaker === "helper" ? "helper" : "employer";
  return json({ line: hh.addPhotoLine(user, intId(id), b.photo as string, speaker) }, 201);
}, { employer: true });
