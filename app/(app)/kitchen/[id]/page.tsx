import { DishScreen } from "@/components/kitchen/DishScreen";

export const metadata = { title: "Kitchen · Helper Diary" };

export default async function DishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DishScreen id={Number(id)} />;
}
