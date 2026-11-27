import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { meOf } from "@/lib/server/session";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect("/signin");
  return <AppShell me={meOf(user)}>{children}</AppShell>;
}
