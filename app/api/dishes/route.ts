import { body, json, route } from "@/lib/server/api";
import { createDish, listDishes } from "@/lib/server/kitchen";

// 5.0 Kitchen. GET: the household's dish book, newest first. POST {name, photo, lang}: add a dish (anyone).
export const GET = route(async (_req, user) => json({ dishes: listDishes(user) }));

export const POST = route(async (req, user) => {
  const b = await body(req);
  return json({ dish: createDish(user, { name: b.name, photo: b.photo, lang: b.lang }) }, 201);
});
