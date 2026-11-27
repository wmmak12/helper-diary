import { json, route } from "@/lib/server/api";
import * as hh from "@/lib/server/household";

/** Counts for the tab bar: drafts waiting (employers), open questions, and what is new for her. */
export const GET = route(async (_req, user) => {
  const t = hh.todayView(user);
  return json({
    drafts: user.role === "employer" ? hh.waitingDraftCount() : 0,
    questions: t.open_questions.length,
    today: user.role === "helper" ? t.changed.filter((e) => e.is_new).length + t.answers.filter((a) => !a.answer_seen).length : 0,
  });
});
