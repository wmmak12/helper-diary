import { Suspense } from "react";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";

export const metadata = { title: "Calendar · Helper Diary" };

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarScreen />
    </Suspense>
  );
}
