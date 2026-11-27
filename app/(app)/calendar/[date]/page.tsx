import { DayScreen } from "@/components/calendar/DayScreen";

export const metadata = { title: "Day · Helper Diary" };

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <DayScreen date={date} />;
}
