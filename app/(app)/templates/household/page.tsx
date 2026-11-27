import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { HouseholdScreen } from "@/components/templates/HouseholdScreen";

export const metadata = { title: "Your household · Helper Diary" };

/** 4.0: the household profile, employers only (the helper never sees it). */
export default async function HouseholdPage() {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user?.role !== "employer") redirect("/today");
  return <HouseholdScreen />;
}
