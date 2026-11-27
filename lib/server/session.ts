import { helperLang, helperName, type User } from "./auth";
import { aiConfigured } from "./ai";
import { listenConfigured } from "./listen";
import type { Me } from "../types";

export function meOf(u: User): Me {
  return {
    id: u.id,
    name: u.name,
    login: u.login,
    role: u.role,
    is_admin: !!u.is_admin,
    lang: u.lang,
    helper_lang: helperLang(),
    helper_name: helperName(),
    ai: aiConfigured(),
    speech: listenConfigured(),
  };
}

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}
