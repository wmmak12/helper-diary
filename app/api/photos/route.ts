import { ApiError, formBody, json, route } from "@/lib/server/api";
import { savePhoto } from "@/lib/server/photos";

export const POST = route(async (req, user) => {
  const form = await formBody(req);
  const file = form?.get("photo");
  if (!(file instanceof File)) throw new ApiError(400, "photo_required");
  return json({ id: await savePhoto(user.id, file) }, 201);
});
