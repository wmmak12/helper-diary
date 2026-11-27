import type { Strings } from "../client/i18n";

export const todayS: Strings<
  | "title" | "whatsNew" | "readConfirm" | "answers" | "answeredBy" | "tasks" | "done" | "progress" | "openQuestions" | "openQuestionsLine"
  | "emptyHelperTitle" | "emptyHelperLine" | "emptyTitle" | "emptyLine" | "addTask" | "editTask" | "allTasks" | "routine" | "once"
  | "everyDay" | "taskTitle" | "note" | "time" | "date" | "repeat" | "days" | "askAbout" | "tick" | "untick" | "removeTask" | "noTasksYet"
  | "saveFailed" | "tickFailed" | "anyTime" | "updated"
> = {
  en: {
    title: "Today", whatsNew: "New in the Notebook", readConfirm: "Please read and confirm", answers: "Answers to your questions", answeredBy: "{name} answered",
    tasks: "Today's tasks", done: "Done", progress: "{done} of {total} done", openQuestions: "Questions from {name}", openQuestionsLine: "{n} waiting for an answer",
    emptyHelperTitle: "Nothing on your list today", emptyHelperLine: "When the family adds tasks, they appear here.",
    emptyTitle: "No tasks for today yet", emptyLine: "Add a routine she does every day, or a one-off task for today.",
    addTask: "Add a task", editTask: "Edit task", allTasks: "All routines and tasks", routine: "Routine", once: "One-off",
    everyDay: "Every day", taskTitle: "What to do", note: "Note (optional)", time: "Time (optional)", date: "Day", repeat: "How often", days: "On these days (none = every day)",
    askAbout: "Ask about this", tick: "Mark done", untick: "Mark not done", removeTask: "Remove task", noTasksYet: "No routines or tasks yet.",
    saveFailed: "That didn't save. Check the connection and try again.", tickFailed: "That didn't save. Try again.", anyTime: "Any time", updated: "Changed",
  },
  zh: {
    title: "今天", whatsNew: "笔记本新内容", readConfirm: "请阅读并确认", answers: "你的问题的回答", answeredBy: "{name} 回答了",
    tasks: "今天的任务", done: "已完成", progress: "已完成 {done}/{total}", openQuestions: "{name} 的问题", openQuestionsLine: "{n} 个问题等待回答",
    emptyHelperTitle: "今天没有任务", emptyHelperLine: "家人添加任务后会显示在这里。",
    emptyTitle: "今天还没有任务", emptyLine: "添加她每天做的日常事项，或今天的一次性任务。",
    addTask: "添加任务", editTask: "编辑任务", allTasks: "所有日常事项和任务", routine: "日常", once: "一次性",
    everyDay: "每天", taskTitle: "要做的事", note: "备注（可选）", time: "时间（可选）", date: "日期", repeat: "频率", days: "在这些日子（不选 = 每天）",
    askAbout: "就此提问", tick: "标记完成", untick: "标记未完成", removeTask: "删除任务", noTasksYet: "还没有日常事项或任务。",
    saveFailed: "没有保存成功。请检查网络后重试。", tickFailed: "没有保存成功，请重试。", anyTime: "任何时间", updated: "已更改",
  },
  my: {
    title: "ယနေ့", whatsNew: "မှတ်စုစာအုပ်တွင် အသစ်", readConfirm: "ဖတ်ပြီး အတည်ပြုပေးပါ", answers: "သင့်မေးခွန်းများအတွက် အဖြေ", answeredBy: "{name} ဖြေထားသည်",
    tasks: "ယနေ့ အလုပ်များ", done: "ပြီးပါပြီ", progress: "{total} ခုတွင် {done} ခု ပြီးပါပြီ", openQuestions: "{name} ၏ မေးခွန်းများ", openQuestionsLine: "ဖြေရန် {n} ခု ကျန်သည်",
    emptyHelperTitle: "ယနေ့ အလုပ်မရှိပါ", emptyHelperLine: "မိသားစုက အလုပ်ထည့်သောအခါ ဤနေရာတွင် ပေါ်ပါမည်။",
    emptyTitle: "ယနေ့အတွက် အလုပ်မရှိသေးပါ", emptyLine: "နေ့စဉ်လုပ်ရမည့်အလုပ် သို့မဟုတ် ယနေ့အတွက် တစ်ကြိမ်အလုပ် ထည့်ပါ။",
    addTask: "အလုပ်ထည့်ရန်", editTask: "အလုပ်ပြင်ရန်", allTasks: "နေ့စဉ်အလုပ်နှင့် အလုပ်အားလုံး", routine: "နေ့စဉ်", once: "တစ်ကြိမ်",
    everyDay: "နေ့တိုင်း", taskTitle: "လုပ်ရမည့်အရာ", note: "မှတ်ချက် (မဖြစ်မနေမဟုတ်)", time: "အချိန် (မဖြစ်မနေမဟုတ်)", date: "နေ့", repeat: "ဘယ်နှစ်ကြိမ်", days: "ဤနေ့များတွင် (မရွေးလျှင် နေ့တိုင်း)",
    askAbout: "ဒီအကြောင်း မေးရန်", tick: "ပြီးကြောင်းမှတ်ရန်", untick: "မပြီးသေးကြောင်းမှတ်ရန်", removeTask: "အလုပ်ဖျက်ရန်", noTasksYet: "နေ့စဉ်အလုပ် သို့မဟုတ် အလုပ် မရှိသေးပါ။",
    saveFailed: "မသိမ်းနိုင်ပါ။ အင်တာနက်ကို စစ်ပြီး ထပ်ကြိုးစားပါ။", tickFailed: "မသိမ်းနိုင်ပါ။ ထပ်ကြိုးစားပါ။", anyTime: "အချိန်မရွေး", updated: "ပြောင်းထားသည်",
  },
  id: {
    title: "Hari ini", whatsNew: "Baru di Buku catatan", readConfirm: "Mohon baca dan konfirmasi", answers: "Jawaban untuk pertanyaan Anda", answeredBy: "{name} menjawab",
    tasks: "Tugas hari ini", done: "Selesai", progress: "{done} dari {total} selesai", openQuestions: "Pertanyaan dari {name}", openQuestionsLine: "{n} menunggu jawaban",
    emptyHelperTitle: "Tidak ada tugas hari ini", emptyHelperLine: "Saat keluarga menambah tugas, tugas muncul di sini.",
    emptyTitle: "Belum ada tugas hari ini", emptyLine: "Tambah tugas rutin yang dia kerjakan setiap hari, atau tugas sekali untuk hari ini.",
    addTask: "Tambah tugas", editTask: "Ubah tugas", allTasks: "Semua rutinitas dan tugas", routine: "Rutin", once: "Sekali",
    everyDay: "Setiap hari", taskTitle: "Yang harus dikerjakan", note: "Catatan (tidak wajib)", time: "Jam (tidak wajib)", date: "Hari", repeat: "Seberapa sering", days: "Pada hari ini (kosong = setiap hari)",
    askAbout: "Tanya soal ini", tick: "Tandai selesai", untick: "Tandai belum selesai", removeTask: "Hapus tugas", noTasksYet: "Belum ada rutinitas atau tugas.",
    saveFailed: "Tidak tersimpan. Periksa koneksi dan coba lagi.", tickFailed: "Tidak tersimpan. Coba lagi.", anyTime: "Kapan saja", updated: "Diubah",
  },
  tl: {
    title: "Ngayon", whatsNew: "Bago sa Kuwaderno", readConfirm: "Pakibasa po at kumpirmahin", answers: "Mga sagot sa iyong tanong", answeredBy: "Sumagot si {name}",
    tasks: "Mga gawain ngayon", done: "Tapos na", progress: "{done} sa {total} ang tapos", openQuestions: "Mga tanong ni {name}", openQuestionsLine: "{n} ang naghihintay ng sagot",
    emptyHelperTitle: "Walang gawain ngayon", emptyHelperLine: "Kapag nagdagdag ng gawain ang pamilya, lalabas ito dito.",
    emptyTitle: "Wala pang gawain ngayon", emptyLine: "Magdagdag ng gawaing ginagawa niya araw-araw, o isang beses na gawain para ngayon.",
    addTask: "Magdagdag ng gawain", editTask: "I-edit ang gawain", allTasks: "Lahat ng araw-araw na gawain at iba pa", routine: "Araw-araw", once: "Isang beses",
    everyDay: "Araw-araw", taskTitle: "Ang gagawin", note: "Tala (hindi kailangan)", time: "Oras (hindi kailangan)", date: "Araw", repeat: "Gaano kadalas", days: "Sa mga araw na ito (wala = araw-araw)",
    askAbout: "Magtanong tungkol dito", tick: "Markahang tapos", untick: "Markahang hindi pa tapos", removeTask: "Burahin ang gawain", noTasksYet: "Wala pang gawain.",
    saveFailed: "Hindi na-save. Pakitingnan ang koneksyon at subukan ulit.", tickFailed: "Hindi na-save. Subukan ulit.", anyTime: "Kahit anong oras", updated: "Binago",
  },
};
