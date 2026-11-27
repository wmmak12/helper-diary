import { NoteScreen } from "@/components/notes/NoteScreen";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NoteScreen id={Number(id)} />;
}
