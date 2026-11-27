import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

export const GET = route(async () => {
  hh.fillMissingTranslations();
  return json({ questions: hh.listQuestions() });
});

export const POST = route(async (req, user) => {
  const b = await body(req);
  const ref = b.ref_type === "entry" || b.ref_type === "task" ? b.ref_type : null;
  return json(
    {
      question: await hh.askQuestion(user, {
        text: str(b.text, 2000),
        lang: isLang(b.lang) ? b.lang : (user.lang ?? "my"),
        ref_type: ref,
        ref_id: ref ? Number(b.ref_id) : null,
      }),
    },
    201,
  );
});
