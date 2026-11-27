import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { householdOpen, inviteRole, SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join · Helper Diary" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user) redirect("/");
  const { code } = await searchParams;
  const initialCode = typeof code === "string" ? code : "";
  const open = householdOpen();
  return (
    <AuthFrame>
      <SignUpForm open={open} initialCode={initialCode} initialRole={open && initialCode ? inviteRole(initialCode) : null} />
    </AuthFrame>
  );
}
