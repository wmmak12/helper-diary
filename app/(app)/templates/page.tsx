import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { TemplatesScreen } from "@/components/templates/TemplatesScreen";

export const metadata = { title: "Templates · Helper Diary" };

// 3.0: employers only; the helper is sent to her Today (the API refuses her too).
export default async function TemplatesPage() {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user?.role !== "employer") redirect("/today");
  return <TemplatesScreen />;
}
