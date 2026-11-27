import { json, route } from "@/lib/server/api";
import * as hh from "@/lib/server/household";

export const GET = route(async (_req, user) => {
  const talk = hh.latestTalk(user);
  if (user.role !== "employer") return json({ talk: talk ? hh.forHelper(talk) : null, waiting: 0 });
  return json({ talk, waiting: hh.waitingDraftCount() });
});
