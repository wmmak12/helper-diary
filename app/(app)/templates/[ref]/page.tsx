import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { TemplateEditor } from "@/components/templates/TemplateEditor";

export const metadata = { title: "Template · Helper Diary" };

/** /templates/sample-baby, /templates/mine-12, or (4.0, Keep editing) /templates/chat-7 */
export default async function TemplatePage({ params }: { params: Promise<{ ref: string }> }) {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user?.role !== "employer") redirect("/today");
  const { ref } = await params;
  const m = /^(sample|mine|chat)-([a-z0-9]+)$/.exec(ref);
  if (!m) redirect("/templates");
  return <TemplateEditor tref={`${m[1]}:${m[2]}`} />;
}
