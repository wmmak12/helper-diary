import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Employers land on Talk; the helper lands on Today. */
export default async function Home() {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/signin");
  redirect(user.role === "helper" ? "/today" : "/talk");
}
