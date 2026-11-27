import type { Strings } from "../client/i18n";

// 5.0 Kitchen: the dish book and a dish's page.
export const kitchen: Strings<
  | "title" | "addDish" | "emptyLine" | "search" | "searchNone" | "addIt" | "all" | "favourites" | "sortNewest" | "sortLongest" | "sortLabel" | "filterLabel"
  | "favEmptyHelper" | "favEmptyEmployer" | "notCooked" | "cookedToday" | "cookedYesterday" | "cookedDays" | "favourite"
  | "addTitle" | "choosePhoto" | "changePhoto" | "nameLabel" | "namePlaceholder" | "saving" | "saveFailed" | "photoFailed" | "addedToast"
  | "show" | "showClose" | "recipe" | "ingredients" | "steps" | "addRecipe" | "editRecipe" | "note" | "addNote" | "editNote" | "notePlaceholder"
  | "cookedButton" | "cookedDone" | "editDish" | "deleteDish" | "confirmDelete" | "addedBy" | "noPhoto" | "removeNote" | "notSaved"
> = {
  en: {
    title: "Kitchen", addDish: "Add a dish", emptyLine: "A photo and a name are enough to add a dish.",
    search: "Search dishes", searchNone: "No dish called “{q}” yet.", addIt: "Add it as a dish",
    all: "All", favourites: "Favourites", sortNewest: "Newest", sortLongest: "Longest since cooked", sortLabel: "Sort", filterLabel: "Show",
    favEmptyHelper: "No favourites yet. Your employers star the dishes the family loves.",
    favEmptyEmployer: "No favourites yet. Tap the star on a dish to add it here.",
    notCooked: "Not cooked yet", cookedToday: "Cooked today", cookedYesterday: "Cooked yesterday", cookedDays: "Cooked {n} days ago",
    favourite: "Favourite",
    addTitle: "Add a dish", choosePhoto: "Take or choose a photo", changePhoto: "Change photo", nameLabel: "Name of the dish", namePlaceholder: "e.g. Chicken rice",
    saving: "Saving…", saveFailed: "The dish didn't save. Your photo and name are still here; try again.",
    photoFailed: "That photo couldn't be used. Try another one.", addedToast: "Added to the Kitchen",
    show: "Show", showClose: "Close", recipe: "Recipe", ingredients: "Ingredients", steps: "Steps",
    addRecipe: "Add ingredients and steps", editRecipe: "Edit ingredients and steps",
    note: "Note", addNote: "Add a note", editNote: "Edit note", notePlaceholder: "e.g. less salt", removeNote: "Remove note",
    cookedButton: "Cooked today", cookedDone: "Cooked today, done",
    editDish: "Edit", deleteDish: "Delete dish", confirmDelete: "Delete this dish from the Kitchen for good?", addedBy: "Added by {name}", noPhoto: "No photo", notSaved: "That didn't save. Try again.",
  },
  zh: {
    title: "厨房", addDish: "添加菜", emptyLine: "一张照片和一个名字就能添加一道菜。",
    search: "搜索菜名", searchNone: "还没有叫“{q}”的菜。", addIt: "把它添加为菜",
    all: "全部", favourites: "最爱", sortNewest: "最新", sortLongest: "最久没做", sortLabel: "排序", filterLabel: "显示",
    favEmptyHelper: "还没有最爱的菜。雇主会给全家喜欢的菜加星。",
    favEmptyEmployer: "还没有最爱的菜。在菜的页面点星标就会出现在这里。",
    notCooked: "还没做过", cookedToday: "今天做过", cookedYesterday: "昨天做过", cookedDays: "{n} 天前做过",
    favourite: "最爱",
    addTitle: "添加菜", choosePhoto: "拍照或选择照片", changePhoto: "换照片", nameLabel: "菜名", namePlaceholder: "例如：海南鸡饭",
    saving: "保存中…", saveFailed: "这道菜没有保存。照片和菜名还在，请重试。",
    photoFailed: "这张照片用不了，请换一张。", addedToast: "已添加到厨房",
    show: "给她看", showClose: "关闭", recipe: "做法", ingredients: "材料", steps: "步骤",
    addRecipe: "添加材料和步骤", editRecipe: "编辑材料和步骤",
    note: "备注", addNote: "添加备注", editNote: "编辑备注", notePlaceholder: "例如：少放盐", removeNote: "删除备注",
    cookedButton: "今天做了", cookedDone: "今天做了，已记下",
    editDish: "编辑", deleteDish: "删除这道菜", confirmDelete: "确定从厨房里永久删除这道菜吗？", addedBy: "{name} 添加", noPhoto: "没有照片", notSaved: "没有保存，请重试。",
  },
  my: {
    title: "မီးဖိုချောင်", addDish: "ဟင်းထည့်ရန်", emptyLine: "ဟင်းတစ်ခုထည့်ရန် ဓာတ်ပုံတစ်ပုံနှင့် နာမည်တစ်ခုသာ လိုပါသည်။",
    search: "ဟင်းနာမည် ရှာရန်", searchNone: "“{q}” ဆိုသည့် ဟင်း မရှိသေးပါ။", addIt: "ဟင်းအဖြစ် ထည့်ရန်",
    all: "အားလုံး", favourites: "အကြိုက်ဆုံး", sortNewest: "အသစ်ဆုံး", sortLongest: "မချက်တာ အကြာဆုံး", sortLabel: "စီရန်", filterLabel: "ပြရန်",
    favEmptyHelper: "အကြိုက်ဆုံး ဟင်း မရှိသေးပါ။ မိသားစုကြိုက်သည့်ဟင်းများကို အိမ်ရှင်က ကြယ်ပွင့် တပ်ပေးပါမည်။",
    favEmptyEmployer: "အကြိုက်ဆုံး ဟင်း မရှိသေးပါ။ ဟင်းတစ်ခုပေါ်ရှိ ကြယ်ပွင့်ကို နှိပ်ပါ။",
    notCooked: "မချက်ရသေးပါ", cookedToday: "ယနေ့ ချက်ခဲ့သည်", cookedYesterday: "မနေ့က ချက်ခဲ့သည်", cookedDays: "လွန်ခဲ့သော {n} ရက်က ချက်ခဲ့သည်",
    favourite: "အကြိုက်ဆုံး",
    addTitle: "ဟင်းထည့်ရန်", choosePhoto: "ဓာတ်ပုံရိုက်ရန် သို့မဟုတ် ရွေးရန်", changePhoto: "ဓာတ်ပုံပြောင်းရန်", nameLabel: "ဟင်းနာမည်", namePlaceholder: "ဥပမာ - ကြက်ဆီထမင်း",
    saving: "သိမ်းနေသည်…", saveFailed: "ဟင်းကို မသိမ်းနိုင်ပါ။ ဓာတ်ပုံနှင့် နာမည် ရှိနေဆဲဖြစ်သည်၊ ထပ်ကြိုးစားပါ။",
    photoFailed: "ဤဓာတ်ပုံကို သုံး၍မရပါ။ နောက်တစ်ပုံ ရွေးပါ။", addedToast: "မီးဖိုချောင်ထဲ ထည့်ပြီးပါပြီ",
    show: "ပြရန်", showClose: "ပိတ်ရန်", recipe: "ချက်နည်း", ingredients: "ပါဝင်ပစ္စည်းများ", steps: "ချက်ပုံအဆင့်များ",
    addRecipe: "ပါဝင်ပစ္စည်းနှင့် ချက်ပုံ ထည့်ရန်", editRecipe: "ပါဝင်ပစ္စည်းနှင့် ချက်ပုံ ပြင်ရန်",
    note: "မှတ်ချက်", addNote: "မှတ်ချက်ထည့်ရန်", editNote: "မှတ်ချက်ပြင်ရန်", notePlaceholder: "ဥပမာ - ဆားနည်းနည်း", removeNote: "မှတ်ချက်ဖျက်ရန်",
    cookedButton: "ယနေ့ ချက်ပြီး", cookedDone: "ယနေ့ ချက်ပြီး မှတ်ထားသည်",
    editDish: "ပြင်ရန်", deleteDish: "ဟင်းကို ဖျက်ရန်", confirmDelete: "ဤဟင်းကို မီးဖိုချောင်မှ အပြီးဖျက်မှာ သေချာပါသလား။", addedBy: "{name} ထည့်ခဲ့သည်", noPhoto: "ဓာတ်ပုံမရှိ", notSaved: "မသိမ်းနိုင်ပါ။ ထပ်ကြိုးစားပါ။",
  },
  id: {
    title: "Dapur", addDish: "Tambah masakan", emptyLine: "Cukup foto dan nama untuk menambah masakan.",
    search: "Cari masakan", searchNone: "Belum ada masakan bernama “{q}”.", addIt: "Tambahkan sebagai masakan",
    all: "Semua", favourites: "Favorit", sortNewest: "Terbaru", sortLongest: "Paling lama tidak dimasak", sortLabel: "Urutkan", filterLabel: "Tampilkan",
    favEmptyHelper: "Belum ada favorit. Majikan Anda memberi bintang pada masakan yang disukai keluarga.",
    favEmptyEmployer: "Belum ada favorit. Ketuk bintang pada masakan untuk menambahkannya di sini.",
    notCooked: "Belum pernah dimasak", cookedToday: "Dimasak hari ini", cookedYesterday: "Dimasak kemarin", cookedDays: "Dimasak {n} hari lalu",
    favourite: "Favorit",
    addTitle: "Tambah masakan", choosePhoto: "Ambil atau pilih foto", changePhoto: "Ganti foto", nameLabel: "Nama masakan", namePlaceholder: "mis. Nasi ayam",
    saving: "Menyimpan…", saveFailed: "Masakan belum tersimpan. Foto dan nama masih ada; coba lagi.",
    photoFailed: "Foto itu tidak bisa dipakai. Coba foto lain.", addedToast: "Ditambahkan ke Dapur",
    show: "Tunjukkan", showClose: "Tutup", recipe: "Resep", ingredients: "Bahan", steps: "Langkah",
    addRecipe: "Tambah bahan dan langkah", editRecipe: "Ubah bahan dan langkah",
    note: "Catatan", addNote: "Tambah catatan", editNote: "Ubah catatan", notePlaceholder: "mis. kurangi garam", removeNote: "Hapus catatan",
    cookedButton: "Dimasak hari ini", cookedDone: "Dimasak hari ini, sudah dicatat",
    editDish: "Ubah", deleteDish: "Hapus masakan", confirmDelete: "Hapus masakan ini dari Dapur selamanya?", addedBy: "Ditambahkan oleh {name}", noPhoto: "Tidak ada foto", notSaved: "Belum tersimpan. Coba lagi.",
  },
  tl: {
    title: "Kusina", addDish: "Magdagdag ng ulam", emptyLine: "Sapat na ang litrato at pangalan para magdagdag ng ulam.",
    search: "Maghanap ng ulam", searchNone: "Wala pang ulam na “{q}”.", addIt: "Idagdag bilang ulam",
    all: "Lahat", favourites: "Mga paborito", sortNewest: "Pinakabago", sortLongest: "Pinakamatagal nang hindi niluluto", sortLabel: "Ayusin", filterLabel: "Ipakita",
    favEmptyHelper: "Wala pang paborito. Lalagyan po ng bituin ng inyong amo ang mga ulam na gusto ng pamilya.",
    favEmptyEmployer: "Wala pang paborito. I-tap po ang bituin sa isang ulam para mailagay ito rito.",
    notCooked: "Hindi pa naluluto", cookedToday: "Niluto ngayon", cookedYesterday: "Niluto kahapon", cookedDays: "Niluto {n} araw na ang nakalipas",
    favourite: "Paborito",
    addTitle: "Magdagdag ng ulam", choosePhoto: "Kumuha o pumili ng litrato", changePhoto: "Palitan ang litrato", nameLabel: "Pangalan ng ulam", namePlaceholder: "hal. Chicken rice",
    saving: "Sine-save…", saveFailed: "Hindi na-save ang ulam. Nandito pa po ang litrato at pangalan; subukan ulit.",
    photoFailed: "Hindi magamit ang litratong iyan. Subukan po ang iba.", addedToast: "Naidagdag sa Kusina",
    show: "Ipakita", showClose: "Isara", recipe: "Resipe", ingredients: "Mga sangkap", steps: "Mga hakbang",
    addRecipe: "Magdagdag ng sangkap at hakbang", editRecipe: "Baguhin ang sangkap at hakbang",
    note: "Paalala", addNote: "Magdagdag ng paalala", editNote: "Baguhin ang paalala", notePlaceholder: "hal. kaunting asin", removeNote: "Burahin ang paalala",
    cookedButton: "Niluto ngayon", cookedDone: "Niluto ngayon, naitala na",
    editDish: "Baguhin", deleteDish: "Burahin ang ulam", confirmDelete: "Burahin po ba nang tuluyan ang ulam na ito sa Kusina?", addedBy: "Idinagdag ni {name}", noPhoto: "Walang litrato", notSaved: "Hindi na-save. Subukan ulit.",
  },
};

/** "Not cooked yet" / "Cooked today" / "Cooked 12 days ago". */
export function cookedLine(s: Record<"notCooked" | "cookedToday" | "cookedYesterday" | "cookedDays", string>, days: number | null): string {
  if (days === null) return s.notCooked;
  if (days === 0) return s.cookedToday;
  if (days === 1) return s.cookedYesterday;
  return s.cookedDays.replace("{n}", String(days));
}
