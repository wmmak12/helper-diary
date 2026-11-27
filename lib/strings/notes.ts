import type { Strings } from "../client/i18n";

export const ns: Strings<
  | "title" | "sharedTitle" | "newNote" | "all" | "noCollection" | "collections" | "newCollection" | "collectionName" | "rename" | "deleteCollection"
  | "private" | "shared" | "shareLine" | "privateLine" | "share" | "unshare" | "noteTitle" | "noteBody" | "collection"
  | "emptyTitle" | "emptyLine" | "emptyShared" | "emptySharedLine" | "by" | "saveFailed" | "deleted" | "deleteNote" | "editNote" | "createCollection" | "deleteCollectionConfirm"
> = {
  en: {
    title: "My notes", sharedTitle: "Shared notes", newNote: "New note", all: "All", noCollection: "No collection", collections: "Collections",
    newCollection: "New collection", collectionName: "Collection name (recipes, cleaning, diary…)", rename: "Rename", deleteCollection: "Delete collection",
    private: "Private · only you", shared: "Shared with the family", shareLine: "The family can read this note, translated into their language.",
    privateLine: "Only you can see this note. Share it when you want the family to read it.", share: "Share with the family", unshare: "Make private",
    noteTitle: "Title", noteBody: "Write your note", collection: "Collection",
    emptyTitle: "No notes yet", emptyLine: "Keep your own recipes, cleaning tips or a diary. Notes stay private until you share them.",
    emptyShared: "Nothing shared yet", emptySharedLine: "Notes she shares with the family will appear here, translated.",
    by: "by {name}", saveFailed: "That didn't save. Check the connection and try again.", deleted: "Note deleted", deleteNote: "Delete note", editNote: "Edit note",
    createCollection: "Add", deleteCollectionConfirm: "Delete this collection? Its notes stay, without a collection.",
  },
  zh: {
    title: "我的笔记", sharedTitle: "共享的笔记", newNote: "新笔记", all: "全部", noCollection: "未分类", collections: "分类",
    newCollection: "新分类", collectionName: "分类名称（菜谱、打扫、日记…）", rename: "重命名", deleteCollection: "删除分类",
    private: "私人 · 仅自己可见", shared: "已与家人共享", shareLine: "家人可以阅读这条笔记，并以他们的语言显示。",
    privateLine: "只有你能看到。想让家人看时再共享。", share: "与家人共享", unshare: "设为私人",
    noteTitle: "标题", noteBody: "写下你的笔记", collection: "分类",
    emptyTitle: "还没有笔记", emptyLine: "记下菜谱、打扫方法或日记。笔记在共享前都是私人的。",
    emptyShared: "还没有共享的笔记", emptySharedLine: "她共享给家人的笔记会翻译后显示在这里。",
    by: "来自 {name}", saveFailed: "没有保存成功，请检查网络后重试。", deleted: "笔记已删除", deleteNote: "删除笔记", editNote: "编辑笔记",
    createCollection: "添加", deleteCollectionConfirm: "删除这个分类？里面的笔记会保留。",
  },
  my: {
    title: "ကျွန်မ၏မှတ်စု", sharedTitle: "မျှဝေထားသောမှတ်စု", newNote: "မှတ်စုအသစ်", all: "အားလုံး", noCollection: "အုပ်စုမရှိ", collections: "အုပ်စုများ",
    newCollection: "အုပ်စုအသစ်", collectionName: "အုပ်စုအမည် (ဟင်းချက်နည်း၊ သန့်ရှင်းရေး၊ နေ့စဉ်မှတ်တမ်း…)", rename: "အမည်ပြောင်းရန်", deleteCollection: "အုပ်စုဖျက်ရန်",
    private: "ကိုယ်ပိုင် · သင်သာမြင်ရသည်", shared: "မိသားစုနှင့် မျှဝေထားသည်", shareLine: "မိသားစုက ဤမှတ်စုကို သူတို့ဘာသာစကားဖြင့် ဖတ်နိုင်သည်။",
    privateLine: "ဤမှတ်စုကို သင်သာ မြင်ရသည်။ မိသားစုဖတ်စေချင်မှ မျှဝေပါ။", share: "မိသားစုနှင့် မျှဝေရန်", unshare: "ကိုယ်ပိုင်ပြန်လုပ်ရန်",
    noteTitle: "ခေါင်းစဉ်", noteBody: "မှတ်စုရေးပါ", collection: "အုပ်စု",
    emptyTitle: "မှတ်စု မရှိသေးပါ", emptyLine: "ဟင်းချက်နည်း၊ သန့်ရှင်းရေးနည်း သို့မဟုတ် နေ့စဉ်မှတ်တမ်း ရေးထားပါ။ မျှဝေမှသာ အခြားသူမြင်ရမည်။",
    emptyShared: "မျှဝေထားခြင်း မရှိသေးပါ", emptySharedLine: "မိသားစုနှင့်မျှဝေသော မှတ်စုများ ဤနေရာတွင် ပေါ်မည်။",
    by: "{name} ရေးသည်", saveFailed: "မသိမ်းနိုင်ပါ။ အင်တာနက်စစ်ပြီး ထပ်ကြိုးစားပါ။", deleted: "မှတ်စု ဖျက်ပြီးပါပြီ", deleteNote: "မှတ်စုဖျက်ရန်", editNote: "မှတ်စုပြင်ရန်",
    createCollection: "ထည့်ရန်", deleteCollectionConfirm: "ဤအုပ်စုကို ဖျက်မလား။ မှတ်စုများ ကျန်ရှိနေမည်။",
  },
  id: {
    title: "Catatan saya", sharedTitle: "Catatan bersama", newNote: "Catatan baru", all: "Semua", noCollection: "Tanpa kelompok", collections: "Kelompok",
    newCollection: "Kelompok baru", collectionName: "Nama kelompok (resep, bersih-bersih, buku harian…)", rename: "Ganti nama", deleteCollection: "Hapus kelompok",
    private: "Pribadi · hanya Anda", shared: "Dibagikan ke keluarga", shareLine: "Keluarga bisa membaca catatan ini, diterjemahkan ke bahasa mereka.",
    privateLine: "Hanya Anda yang bisa melihat catatan ini. Bagikan jika Anda ingin keluarga membacanya.", share: "Bagikan ke keluarga", unshare: "Jadikan pribadi",
    noteTitle: "Judul", noteBody: "Tulis catatan Anda", collection: "Kelompok",
    emptyTitle: "Belum ada catatan", emptyLine: "Simpan resep, tips bersih-bersih, atau buku harian Anda sendiri. Catatan tetap pribadi sampai Anda membagikannya.",
    emptyShared: "Belum ada yang dibagikan", emptySharedLine: "Catatan yang dia bagikan ke keluarga akan muncul di sini, sudah diterjemahkan.",
    by: "oleh {name}", saveFailed: "Gagal menyimpan. Periksa koneksi dan coba lagi.", deleted: "Catatan dihapus", deleteNote: "Hapus catatan", editNote: "Ubah catatan",
    createCollection: "Tambah", deleteCollectionConfirm: "Hapus kelompok ini? Catatannya tetap ada, tanpa kelompok.",
  },
  tl: {
    title: "Mga tala ko", sharedTitle: "Mga ibinahaging tala", newNote: "Bagong tala", all: "Lahat", noCollection: "Walang grupo", collections: "Mga grupo",
    newCollection: "Bagong grupo", collectionName: "Pangalan ng grupo (recipe, paglilinis, diary…)", rename: "Palitan ang pangalan", deleteCollection: "Burahin ang grupo",
    private: "Pribado · ikaw lang", shared: "Ibinahagi sa pamilya", shareLine: "Mababasa ng pamilya ang talang ito, isinalin sa kanilang wika.",
    privateLine: "Ikaw lang ang nakakakita ng talang ito. I-share kapag gusto mong mabasa ito ng pamilya.", share: "I-share sa pamilya", unshare: "Gawing pribado",
    noteTitle: "Pamagat", noteBody: "Isulat ang iyong tala", collection: "Grupo",
    emptyTitle: "Wala pang tala", emptyLine: "Itago rito ang sarili mong mga recipe, tips sa paglilinis o diary. Pribado ang mga tala hangga't hindi mo sine-share.",
    emptyShared: "Wala pang ibinahagi", emptySharedLine: "Dito lalabas ang mga talang ibinahagi niya sa pamilya, isinalin na.",
    by: "ni {name}", saveFailed: "Hindi na-save. Tingnan ang koneksyon at subukan ulit.", deleted: "Nabura na ang tala", deleteNote: "Burahin ang tala", editNote: "I-edit ang tala",
    createCollection: "Idagdag", deleteCollectionConfirm: "Burahin ang grupong ito? Mananatili ang mga tala, pero walang grupo.",
  },
};
