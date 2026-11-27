import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { householdOpen, passwordResetFor, SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { ResetForm } from "@/components/auth/ResetForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New password · Helper Diary", referrer: "no-referrer" as const };

/** 5.5: where a member who forgot their password uses the one-time code the owner made (Settings › Household). */
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user) redirect("/");
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code : "";
  const open = householdOpen();
  return (
    <AuthFrame>
      <ResetForm open={open} initialCode={initialCode} initialWho={open && initialCode ? passwordResetFor(initialCode) : null} />
    </AuthFrame>
  );
}
