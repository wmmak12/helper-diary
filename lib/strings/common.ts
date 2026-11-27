import type { Strings } from "../client/i18n";

export const common: Strings<
  | "talk" | "talks" | "kitchen" | "notebook" | "today" | "calendar" | "notes" | "questions" | "settings" | "search"
  | "original" | "showTranslation" | "back" | "save" | "cancel" | "edit" | "remove" | "close"
  | "addPhoto" | "removePhoto" | "loading" | "tryAgain" | "offline" | "loadFailed" | "saved" | "notTranslated" | "you" | "skip" | "menu" | "signOut"
  | "added" | "open" | "confirmRemove" | "autoAdded" | "autoAddedFrom" | "alreadySaved"
> = {
  en: {
    talk: "Talk", talks: "History", kitchen: "Kitchen", notebook: "Notebook", today: "Today", calendar: "Calendar", notes: "My notes", questions: "Questions", settings: "Settings", search: "Search",
    original: "Original", showTranslation: "Translation",
    back: "Back", save: "Save", cancel: "Cancel", edit: "Edit", remove: "Remove", close: "Close", addPhoto: "Add photo", removePhoto: "Remove photo",
    loading: "Loading", tryAgain: "Try again", offline: "No connection. Check the Wi-Fi or data and try again.", loadFailed: "This page didn't load.",
    saved: "Saved", notTranslated: "Translation coming", you: "You", skip: "Skip", menu: "Menu", signOut: "Sign out",
    added: "Added", open: "Open", confirmRemove: "Remove this for good?", autoAdded: "Auto-added", autoAddedFrom: "Auto-added from a talk", alreadySaved: "Already saved in the Notebook",
  },
  zh: {
    talk: "对话", talks: "对话记录", kitchen: "厨房", notebook: "笔记本", today: "今天", calendar: "日历", notes: "我的笔记", questions: "问题", settings: "设置", search: "搜索",
    original: "原文", showTranslation: "译文",
    back: "返回", save: "保存", cancel: "取消", edit: "编辑", remove: "删除", close: "关闭", addPhoto: "添加照片", removePhoto: "移除照片",
    loading: "加载中", tryAgain: "重试", offline: "没有网络。请检查 Wi-Fi 或流量后重试。", loadFailed: "页面没有加载出来。",
    saved: "已保存", notTranslated: "翻译稍后显示", you: "你", skip: "跳过", menu: "菜单", signOut: "退出登录",
    added: "已添加", open: "打开", confirmRemove: "确定永久删除吗？", autoAdded: "自动添加", autoAddedFrom: "从对话中自动添加", alreadySaved: "已保存到笔记本",
  },
  my: {
    talk: "စကားပြော", talks: "ပြောခဲ့သမျှ", kitchen: "မီးဖိုချောင်", notebook: "မှတ်စုစာအုပ်", today: "ယနေ့", calendar: "ပြက္ခဒိန်", notes: "ကျွန်မ၏မှတ်စု", questions: "မေးခွန်းများ", settings: "ဆက်တင်", search: "ရှာရန်",
    original: "မူရင်း", showTranslation: "ဘာသာပြန်",
    back: "နောက်သို့", save: "သိမ်းရန်", cancel: "မလုပ်တော့ပါ", edit: "ပြင်ရန်", remove: "ဖျက်ရန်", close: "ပိတ်ရန်", addPhoto: "ဓာတ်ပုံထည့်ရန်", removePhoto: "ဓာတ်ပုံဖယ်ရန်",
    loading: "ဖွင့်နေသည်", tryAgain: "ထပ်ကြိုးစားရန်", offline: "အင်တာနက်မရှိပါ။ Wi-Fi သို့မဟုတ် ဒေတာကို စစ်ပြီး ထပ်ကြိုးစားပါ။", loadFailed: "ဤစာမျက်နှာ မဖွင့်နိုင်ပါ။",
    saved: "သိမ်းပြီးပါပြီ", notTranslated: "ဘာသာပြန် မကြာမီရောက်မည်", you: "သင်", skip: "ကျော်ရန်", menu: "မီနူး", signOut: "ထွက်ရန်",
    added: "ထည့်ပြီးပါပြီ", open: "ဖွင့်ရန်", autoAdded: "အလိုအလျောက် ထည့်ထားသည်", autoAddedFrom: "စကားပြောမှ အလိုအလျောက် ထည့်ထားသည်", alreadySaved: "မှတ်စုစာအုပ်ထဲ သိမ်းပြီးပါပြီ", confirmRemove: "အပြီးဖျက်မှာ သေချာပါသလား။",
  },
  id: {
    talk: "Bicara", talks: "Riwayat", kitchen: "Dapur", notebook: "Buku catatan", today: "Hari ini", calendar: "Kalender", notes: "Catatan saya", questions: "Pertanyaan", settings: "Pengaturan", search: "Cari",
    original: "Asli", showTranslation: "Terjemahan",
    back: "Kembali", save: "Simpan", cancel: "Batal", edit: "Ubah", remove: "Hapus", close: "Tutup", addPhoto: "Tambah foto", removePhoto: "Hapus foto",
    loading: "Memuat", tryAgain: "Coba lagi", offline: "Tidak ada koneksi. Periksa Wi-Fi atau data, lalu coba lagi.", loadFailed: "Halaman ini tidak terbuka.",
    saved: "Tersimpan", notTranslated: "Terjemahan segera ada", you: "Anda", skip: "Lewati", menu: "Menu", signOut: "Keluar",
    added: "Ditambahkan", open: "Buka", confirmRemove: "Hapus ini selamanya?", autoAdded: "Ditambah otomatis", autoAddedFrom: "Ditambah otomatis dari percakapan", alreadySaved: "Sudah tersimpan di Buku catatan",
  },
  tl: {
    talk: "Usap", talks: "Kasaysayan", kitchen: "Kusina", notebook: "Kuwaderno", today: "Ngayon", calendar: "Kalendaryo", notes: "Aking mga tala", questions: "Mga tanong", settings: "Settings", search: "Hanapin",
    original: "Orihinal", showTranslation: "Salin",
    back: "Bumalik", save: "I-save", cancel: "Kanselahin", edit: "I-edit", remove: "Burahin", close: "Isara", addPhoto: "Magdagdag ng litrato", removePhoto: "Alisin ang litrato",
    loading: "Naglo-load", tryAgain: "Subukan ulit", offline: "Walang koneksyon. Pakitingnan po ang Wi-Fi o data at subukan ulit.", loadFailed: "Hindi nag-load ang pahinang ito.",
    saved: "Na-save na", notTranslated: "Darating ang salin", you: "Ikaw", skip: "Laktawan", menu: "Menu", signOut: "Mag-sign out",
    added: "Naidagdag na", open: "Buksan", confirmRemove: "Burahin po ito nang tuluyan?", autoAdded: "Kusang naidagdag", autoAddedFrom: "Kusang naidagdag mula sa usapan", alreadySaved: "Naka-save na sa Kuwaderno",
  },
};
