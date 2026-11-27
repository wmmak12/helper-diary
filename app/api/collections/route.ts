import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

export const GET = route(async (_req, user) => json({ collections: hh.listCollections(user) }));
export const POST = route(async (req, user) => json({ collection: hh.createCollection(user, str((await body(req)).name, 60)) }, 201));
