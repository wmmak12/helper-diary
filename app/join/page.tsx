import { redirect } from "next/navigation";

export default async function Join({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  redirect(`/signup${q.size ? `?${q}` : ""}`);
}
