import type { Strings } from "../client/i18n";

export const ss: Strings<"title" | "placeholder" | "none" | "hint" | "entry" | "note" | "talk" | "task" | "question"> = {
  en: { title: "Search", placeholder: "Search everything, in any language", none: "Nothing found for “{q}”.", hint: "Search the Notebook, notes, History, tasks and questions in English, 中文 or မြန်မာ.", entry: "Notebook", note: "Notes", talk: "History", task: "Tasks", question: "Questions" },
  zh: { title: "搜索", placeholder: "用任何语言搜索全部内容", none: "没有找到“{q}”。", hint: "可用英文、中文或缅甸文搜索笔记本、笔记、对话、任务和问题。", entry: "笔记本", note: "笔记", talk: "对话", task: "任务", question: "问题" },
  my: { title: "ရှာရန်", placeholder: "မည်သည့်ဘာသာစကားဖြင့်မဆို ရှာပါ", none: "“{q}” ကို မတွေ့ပါ။", hint: "မှတ်စုစာအုပ်၊ မှတ်စု၊ စကားပြောမှတ်တမ်း၊ အလုပ်နှင့် မေးခွန်းများကို ရှာနိုင်သည်။", entry: "မှတ်စုစာအုပ်", note: "မှတ်စုများ", talk: "စကားပြော", task: "အလုပ်များ", question: "မေးခွန်းများ" },
  id: { title: "Cari", placeholder: "Cari semua, dalam bahasa apa saja", none: "Tidak ada hasil untuk “{q}”.", hint: "Cari di Buku catatan, catatan, Riwayat, tugas, dan pertanyaan dalam bahasa apa saja.", entry: "Buku catatan", note: "Catatan", talk: "Riwayat", task: "Tugas", question: "Pertanyaan" },
  tl: { title: "Hanapin", placeholder: "Hanapin lahat, sa kahit anong wika", none: "Walang nakita para sa “{q}”.", hint: "Hanapin sa Kuwaderno, mga tala, Kasaysayan, mga gawain at mga tanong sa kahit anong wika.", entry: "Kuwaderno", note: "Mga tala", talk: "Kasaysayan", task: "Mga gawain", question: "Mga tanong" },
};
