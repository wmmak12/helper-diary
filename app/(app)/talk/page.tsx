import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { TalkScreen } from "@/components/talk/TalkScreen";

export const dynamic = "force-dynamic";

/** Talk is the employers' screen; the helper's home is Today. */
export default async function TalkPage() {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/signin");
  if (user.role === "helper") redirect("/today");
  return <TalkScreen />;
}
