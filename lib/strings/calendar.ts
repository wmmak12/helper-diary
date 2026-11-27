import type { Strings } from "../client/i18n";

export const calS: Strings<
  | "title" | "month" | "week" | "prevMonth" | "nextMonth" | "prevWeek" | "nextWeek" | "today" | "tasks" | "event" | "dayOff" | "nTasks"
  | "noTasks" | "talks" | "noTalks" | "notes" | "noNotes" | "nothing" | "done" | "shared" | "private" | "notebook" | "lines"
  | "add" | "addTask" | "addEvent" | "addDayOff" | "taskTitle" | "eventTitle" | "time" | "note" | "repeat" | "rNone" | "rDaily" | "rWeekly" | "rMonthly"
  | "onDays" | "monthlyLine" | "move" | "moveTo" | "movedTo" | "saveFailed" | "alreadyThere" | "delete" | "dayOffFor" | "pickDays"
  | "tomorrow" | "backToToday" | "tomorrowTasks" | "noTomorrow" | "movedFrom" | "anyTime"
> = {
  en: {
    title: "Calendar", month: "Month", week: "Week", prevMonth: "Previous month", nextMonth: "Next month", prevWeek: "Previous week", nextWeek: "Next week",
    today: "Today", tasks: "Tasks", event: "Family event", dayOff: "Day off", nTasks: "{n} tasks",
    noTasks: "No tasks on this day.", talks: "Talks that day", noTalks: "No talks that day.", notes: "Notes written that day", noNotes: "No notes written that day.",
    nothing: "Nothing was planned, said or noted on this day.", done: "Done", shared: "Shared", private: "Only you", notebook: "Notebook", lines: "{n} lines",
    add: "Add", addTask: "Task", addEvent: "Family event", addDayOff: "Her day off", taskTitle: "What to do", eventTitle: "What's happening",
    time: "Time (optional)", note: "Note (optional)", repeat: "Repeat", rNone: "Does not repeat", rDaily: "Daily", rWeekly: "Weekly", rMonthly: "Monthly",
    onDays: "On these days", monthlyLine: "On the {d} of each month, or the month's last day when it is shorter.", pickDays: "Pick at least one day.",
    move: "Move", moveTo: "Move to which day?", movedTo: "Moved to {date}", saveFailed: "That didn't save. Check the connection and try again.",
    alreadyThere: "It is already on that day. Pick another day.", delete: "Delete", dayOffFor: "{name}'s day off",
    tomorrow: "Tomorrow", backToToday: "Back to today", tomorrowTasks: "Tomorrow's tasks", noTomorrow: "No tasks tomorrow.", movedFrom: "Moved from {date}", anyTime: "Any time",
  },
  zh: {
    title: "日历", month: "月", week: "周", prevMonth: "上个月", nextMonth: "下个月", prevWeek: "上一周", nextWeek: "下一周",
    today: "今天", tasks: "任务", event: "家庭活动", dayOff: "休息日", nTasks: "{n} 个任务",
    noTasks: "这天没有任务。", talks: "这天的对话", noTalks: "这天没有对话。", notes: "这天写的笔记", noNotes: "这天没有写笔记。",
    nothing: "这天没有计划、对话或笔记。", done: "已完成", shared: "已分享", private: "仅自己可见", notebook: "笔记本", lines: "{n} 句",
    add: "添加", addTask: "任务", addEvent: "家庭活动", addDayOff: "她的休息日", taskTitle: "要做的事", eventTitle: "什么活动",
    time: "时间（可选）", note: "备注（可选）", repeat: "重复", rNone: "不重复", rDaily: "每天", rWeekly: "每周", rMonthly: "每月",
    onDays: "在这些日子", monthlyLine: "每月 {d} 日；月份较短时在当月最后一天。", pickDays: "请至少选一天。",
    move: "移动", moveTo: "移到哪一天？", movedTo: "已移到 {date}", saveFailed: "没有保存成功。请检查网络后重试。",
    alreadyThere: "这天已经有这项任务了，请选别的日期。", delete: "删除", dayOffFor: "{name} 的休息日",
    tomorrow: "明天", backToToday: "回到今天", tomorrowTasks: "明天的任务", noTomorrow: "明天没有任务。", movedFrom: "从 {date} 移来", anyTime: "任何时间",
  },
  my: {
    title: "ပြက္ခဒိန်", month: "လ", week: "ပတ်", prevMonth: "ယခင်လ", nextMonth: "နောက်လ", prevWeek: "ယခင်ပတ်", nextWeek: "နောက်ပတ်",
    today: "ယနေ့", tasks: "အလုပ်များ", event: "မိသားစုပွဲ", dayOff: "အားလပ်ရက်", nTasks: "အလုပ် {n} ခု",
    noTasks: "ဤနေ့တွင် အလုပ်မရှိပါ။", talks: "ထိုနေ့က စကားပြောခဲ့သည်များ", noTalks: "ထိုနေ့က စကားမပြောခဲ့ပါ။", notes: "ထိုနေ့က ရေးခဲ့သော မှတ်စုများ", noNotes: "ထိုနေ့က မှတ်စုမရေးခဲ့ပါ။",
    nothing: "ဤနေ့တွင် စီစဉ်ထားခြင်း၊ ပြောခဲ့ခြင်း၊ မှတ်ထားခြင်း မရှိပါ။", done: "ပြီးပါပြီ", shared: "မျှဝေထားသည်", private: "သင်သာမြင်ရသည်", notebook: "မှတ်စုစာအုပ်", lines: "{n} ကြောင်း",
    add: "ထည့်ရန်", addTask: "အလုပ်", addEvent: "မိသားစုပွဲ", addDayOff: "အားလပ်ရက်", taskTitle: "လုပ်ရမည့်အရာ", eventTitle: "ဘာပွဲလဲ",
    time: "အချိန် (မဖြစ်မနေမဟုတ်)", note: "မှတ်ချက် (မဖြစ်မနေမဟုတ်)", repeat: "ထပ်လုပ်ရန်", rNone: "တစ်ကြိမ်သာ", rDaily: "နေ့တိုင်း", rWeekly: "အပတ်တိုင်း", rMonthly: "လတိုင်း",
    onDays: "ဤနေ့များတွင်", monthlyLine: "လတိုင်း {d} ရက်နေ့၊ လတိုလျှင် လ၏နောက်ဆုံးနေ့။", pickDays: "အနည်းဆုံး တစ်ရက် ရွေးပါ။",
    move: "ရွှေ့ရန်", moveTo: "ဘယ်နေ့ကို ရွှေ့မလဲ။", movedTo: "{date} သို့ ရွှေ့ပြီးပါပြီ", saveFailed: "မသိမ်းနိုင်ပါ။ အင်တာနက်ကို စစ်ပြီး ထပ်ကြိုးစားပါ။",
    alreadyThere: "ထိုနေ့တွင် ရှိပြီးသားပါ။ အခြားနေ့ ရွေးပါ။", delete: "ဖျက်ရန်", dayOffFor: "{name} ၏ အားလပ်ရက်",
    tomorrow: "မနက်ဖြန်", backToToday: "ယနေ့သို့ ပြန်သွားရန်", tomorrowTasks: "မနက်ဖြန် အလုပ်များ", noTomorrow: "မနက်ဖြန် အလုပ်မရှိပါ။", movedFrom: "{date} မှ ရွှေ့ထားသည်", anyTime: "အချိန်မရွေး",
  },
  id: {
    title: "Kalender", month: "Bulan", week: "Minggu", prevMonth: "Bulan lalu", nextMonth: "Bulan depan", prevWeek: "Minggu lalu", nextWeek: "Minggu depan",
    today: "Hari ini", tasks: "Tugas", event: "Acara keluarga", dayOff: "Hari libur", nTasks: "{n} tugas",
    noTasks: "Tidak ada tugas pada hari ini.", talks: "Percakapan hari itu", noTalks: "Tidak ada percakapan hari itu.", notes: "Catatan yang ditulis hari itu", noNotes: "Tidak ada catatan yang ditulis hari itu.",
    nothing: "Tidak ada rencana, percakapan, atau catatan pada hari ini.", done: "Selesai", shared: "Dibagikan", private: "Hanya Anda", notebook: "Buku catatan", lines: "{n} kalimat",
    add: "Tambah", addTask: "Tugas", addEvent: "Acara keluarga", addDayOff: "Hari liburnya", taskTitle: "Apa yang dikerjakan", eventTitle: "Acara apa",
    time: "Jam (tidak wajib)", note: "Catatan (tidak wajib)", repeat: "Ulangi", rNone: "Tidak diulang", rDaily: "Setiap hari", rWeekly: "Setiap minggu", rMonthly: "Setiap bulan",
    onDays: "Pada hari-hari ini", monthlyLine: "Setiap tanggal {d}, atau hari terakhir bulan itu jika bulannya lebih pendek.", pickDays: "Pilih minimal satu hari.",
    move: "Pindahkan", moveTo: "Pindah ke hari apa?", movedTo: "Dipindah ke {date}", saveFailed: "Gagal menyimpan. Periksa koneksi dan coba lagi.",
    alreadyThere: "Sudah ada di hari itu. Pilih hari lain.", delete: "Hapus", dayOffFor: "Hari libur {name}",
    tomorrow: "Besok", backToToday: "Kembali ke hari ini", tomorrowTasks: "Tugas besok", noTomorrow: "Tidak ada tugas besok.", movedFrom: "Dipindah dari {date}", anyTime: "Kapan saja",
  },
  tl: {
    title: "Kalendaryo", month: "Buwan", week: "Linggo", prevMonth: "Nakaraang buwan", nextMonth: "Susunod na buwan", prevWeek: "Nakaraang linggo", nextWeek: "Susunod na linggo",
    today: "Ngayon", tasks: "Mga gawain", event: "Okasyon ng pamilya", dayOff: "Day off", nTasks: "{n} gawain",
    noTasks: "Walang gawain sa araw na ito.", talks: "Mga usapan sa araw na iyon", noTalks: "Walang usapan sa araw na iyon.", notes: "Mga talang isinulat sa araw na iyon", noNotes: "Walang talang isinulat sa araw na iyon.",
    nothing: "Walang plano, usapan o tala sa araw na ito.", done: "Tapos na", shared: "Ibinahagi", private: "Ikaw lang", notebook: "Kuwaderno", lines: "{n} linya",
    add: "Magdagdag", addTask: "Gawain", addEvent: "Okasyon ng pamilya", addDayOff: "Day off niya", taskTitle: "Ano ang gagawin", eventTitle: "Ano ang mangyayari",
    time: "Oras (hindi kailangan)", note: "Tala (hindi kailangan)", repeat: "Ulitin", rNone: "Hindi inuulit", rDaily: "Araw-araw", rWeekly: "Linggu-linggo", rMonthly: "Buwan-buwan",
    onDays: "Sa mga araw na ito", monthlyLine: "Tuwing ika-{d} ng bawat buwan, o sa huling araw ng buwan kung mas maikli ito.", pickDays: "Pumili ng kahit isang araw.",
    move: "Ilipat", moveTo: "Ilipat sa anong araw?", movedTo: "Inilipat sa {date}", saveFailed: "Hindi na-save. Tingnan ang koneksyon at subukan ulit.",
    alreadyThere: "Nasa araw na iyon na ito. Pumili ng ibang araw.", delete: "Burahin", dayOffFor: "Day off ni {name}",
    tomorrow: "Bukas", backToToday: "Bumalik sa ngayon", tomorrowTasks: "Mga gawain bukas", noTomorrow: "Walang gawain bukas.", movedFrom: "Inilipat mula {date}", anyTime: "Kahit anong oras",
  },
};
