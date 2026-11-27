import type { Strings } from "../client/i18n";

export const shell: Strings<"pickTitle" | "pickLine" | "showOriginal" | "hideOriginal" | "draftsWaiting" | "nav" | "continue"> = {
  en: {
    pickTitle: "Choose your language",
    pickLine: "Everything in the app, and everything anyone writes, appears in it. You can change it later in Settings.",
    showOriginal: "Show originals", hideOriginal: "Show translations", draftsWaiting: "{n} drafts to review", nav: "Main", continue: "Continue",
  },
  zh: { pickTitle: "选择你的语言", pickLine: "应用里的一切，以及大家写下的内容，都会以这种语言显示。之后可以在设置中更改。", showOriginal: "显示原文", hideOriginal: "显示译文", draftsWaiting: "{n} 条草稿待审核", nav: "主菜单", continue: "继续" },
  my: { pickTitle: "သင့်ဘာသာစကား ရွေးပါ", pickLine: "အက်ပ်ထဲရှိ အရာအားလုံးနှင့် မည်သူရေးသည့်စာမဆို ဤဘာသာစကားဖြင့် ပေါ်ပါမည်။ နောက်မှ ဆက်တင်တွင် ပြောင်းနိုင်သည်။", showOriginal: "မူရင်းပြရန်", hideOriginal: "ဘာသာပြန်ပြရန်", draftsWaiting: "စစ်ရန် မူကြမ်း {n} ခု", nav: "မီနူး", continue: "ဆက်သွားရန်" },
  id: { pickTitle: "Pilih bahasa Anda", pickLine: "Semua yang ada di aplikasi, dan semua yang ditulis orang, akan muncul dalam bahasa ini. Bisa diubah nanti di Pengaturan.", showOriginal: "Tampilkan asli", hideOriginal: "Tampilkan terjemahan", draftsWaiting: "{n} draf perlu diperiksa", nav: "Menu utama", continue: "Lanjut" },
  tl: { pickTitle: "Piliin ang iyong wika", pickLine: "Lahat ng nasa app, at lahat ng isinusulat ng kahit sino, ay lalabas sa wikang ito. Puwede mo itong palitan mamaya sa Settings.", showOriginal: "Ipakita ang orihinal", hideOriginal: "Ipakita ang salin", draftsWaiting: "{n} draft na susuriin", nav: "Pangunahing menu", continue: "Magpatuloy" },
};
