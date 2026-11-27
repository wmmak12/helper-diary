import { EntryScreen } from "@/components/notebook/EntryScreen";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EntryScreen id={Number(id)} />;
}
