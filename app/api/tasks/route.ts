import { ApiError, body, json, route, today } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { taskInput } from "@/lib/server/inputs";

export const GET = route(async () => json({ tasks: hh.allTasks() }));

export const POST = route(async (req, user) => {
  const i = taskInput(await body(req));
  if (!i.lang) throw new ApiError(400, "lang_required");
  // 2.0: tasks go on today or later, never onto a past date
  if (i.date && i.date < today()) throw new ApiError(400, "past_date");
  return json(
    {
      task: await hh.createTask(user, {
        title: i.title ?? "",
        note: i.note ?? "",
        lang: i.lang,
        kind: i.kind ?? "once",
        repeat: i.repeat,
        weekdays: i.weekdays ?? [],
        date: i.date ?? null,
        time: i.time ?? null,
        photo: i.photo ?? null,
      }),
    },
    201,
  );
}, { employer: true });
