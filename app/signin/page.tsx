import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { householdOpen, SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { SignInForm } from "@/components/auth/SignInForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in · Helper Diary" };

export default async function SignInPage() {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user) redirect("/");
  return (
    <AuthFrame>
      <SignInForm open={householdOpen()} />
    </AuthFrame>
  );
}
