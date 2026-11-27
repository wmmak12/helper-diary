import { route } from "@/lib/server/api";
import { readPhoto } from "@/lib/server/photos";

export const GET = route<{ id: string }>(async (_req, _user, { id }) => {
  const p = readPhoto(id);
  return new Response(new Uint8Array(p.data), {
    headers: { "content-type": p.mime, "cache-control": "private, max-age=31536000, immutable" },
  });
});
