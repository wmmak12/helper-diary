import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, userForToken } from "@/lib/server/auth";
import { ChatScreen } from "@/components/templates/ChatScreen";

export const metadata = { title: "AI routine chat · Helper Diary" };

/** 4.0: /templates/chats/12, employers only. Opening it makes no model call. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const user = userForToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (user?.role !== "employer") redirect("/today");
  const { id } = await params;
  if (!/^\d+$/.test(id)) redirect("/templates");
  return <ChatScreen id={Number(id)} />;
}
