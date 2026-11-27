import type { Strings } from "../client/i18n";

// 5.3: the owner's AI and speech settings (Settings), the owner's setup line on Talk, and the helper's plain reply box.

type K =
  | "title" | "line" | "sourceServer" | "sourceNone" | "textPart" | "speechPart"
  | "address" | "addressHelp" | "speechAddressHelp" | "key" | "keyHelp" | "keySaved" | "replaceKey" | "clearKey" | "keyWillClear" | "undo"
  | "model" | "modelHelp" | "speechModelHelp" | "save" | "checking" | "works" | "saved"
  | "errUnreachable" | "errKey" | "errModel" | "errOther" | "saveFailed"
  | "setupBoth" | "setupText" | "setupSpeech" | "setupLink" | "replyBox";

export const aiS: Strings<K> = {
  en: {
    title: "AI settings", line: "Only you see this. Translation, talk drafts and the template chat use the text AI. Hold to talk uses speech to text.",
    sourceServer: "Translation uses the AI set on the server until you save your own.", sourceNone: "Text AI isn't set up yet. Lines and entries are still saved, in the language they were written in.",
    textPart: "Text AI", speechPart: "Speech to text",
    address: "Address", addressHelp: "An OpenAI-compatible address, such as https://api.example.com/v1", speechAddressHelp: "An address with OpenAI-style audio transcription, such as https://api.example.com/v1",
    key: "Key", keyHelp: "The API key from your provider. Once saved, only its last four characters show.", keySaved: "Key saved ({hint})", replaceKey: "Replace", clearKey: "Clear",
    keyWillClear: "The key will be cleared when you save.", undo: "Undo",
    model: "Model", modelHelp: "The model name from your provider, such as gpt-4o-mini.", speechModelHelp: "The transcription model name, such as whisper-1.",
    save: "Save and check", checking: "Checking…", works: "Saved. It works.", saved: "Saved.",
    errUnreachable: "Saved, but the address couldn't be reached. Check the address.", errKey: "Saved, but the key was refused. Check the key.",
    errModel: "Saved, but that model wasn't found. Check the model name.", errOther: "Saved, but it didn't work. Check the address, key and model.",
    saveFailed: "Couldn't save. Check the connection and try again.",
    setupBoth: "Translation and Hold to talk need the AI settings.", setupText: "Translation needs the text AI settings.", setupSpeech: "Hold to talk appears once speech to text is set up.", setupLink: "Set up",
    replyBox: "Type here",
  },
  zh: {
    title: "AI 设置", line: "只有你能看到这里。翻译、对话草稿和模板助手使用文字 AI；按住说话使用语音转文字。",
    sourceServer: "在你保存自己的设置之前，翻译使用服务器上设置的 AI。", sourceNone: "文字 AI 还没有设置。说的话和条目照样保存，保留原来的语言。",
    textPart: "文字 AI", speechPart: "语音转文字",
    address: "地址", addressHelp: "兼容 OpenAI 的地址，例如 https://api.example.com/v1", speechAddressHelp: "支持 OpenAI 式音频转写的地址，例如 https://api.example.com/v1",
    key: "密钥", keyHelp: "服务商给你的 API 密钥。保存后只显示最后四个字符。", keySaved: "密钥已保存（{hint}）", replaceKey: "更换", clearKey: "清除",
    keyWillClear: "保存时会清除这个密钥。", undo: "撤销",
    model: "模型", modelHelp: "服务商的模型名称，例如 gpt-4o-mini。", speechModelHelp: "转写模型名称，例如 whisper-1。",
    save: "保存并检查", checking: "正在检查…", works: "已保存，可以使用。", saved: "已保存。",
    errUnreachable: "已保存，但无法连接这个地址。请检查地址。", errKey: "已保存，但密钥被拒绝。请检查密钥。",
    errModel: "已保存，但找不到这个模型。请检查模型名称。", errOther: "已保存，但无法使用。请检查地址、密钥和模型。",
    saveFailed: "没能保存。请检查网络后重试。",
    setupBoth: "翻译和按住说话需要先填写 AI 设置。", setupText: "翻译需要先填写文字 AI 设置。", setupSpeech: "设置好语音转文字后，会出现按住说话。", setupLink: "去设置",
    replyBox: "在这里输入",
  },
  my: {
    title: "AI ဆက်တင်", line: "ဤနေရာကို သင်သာ မြင်ရသည်။ ဘာသာပြန်ခြင်း၊ မူကြမ်းနှင့် နမူနာအကူတို့သည် စာသား AI ကို သုံးသည်။ ဖိထားပြီးပြောခြင်းသည် အသံမှစာသို့ ကို သုံးသည်။",
    sourceServer: "သင့်ဆက်တင် မသိမ်းမချင်း ဆာဗာပေါ်ရှိ AI ကို သုံးပါမည်။", sourceNone: "စာသား AI မသတ်မှတ်ရသေးပါ။ စာများကို ရေးသည့်ဘာသာဖြင့် ဆက်သိမ်းထားပါမည်။",
    textPart: "စာသား AI", speechPart: "အသံမှ စာသို့",
    address: "လိပ်စာ", addressHelp: "OpenAI နှင့် ကိုက်ညီသော လိပ်စာ၊ ဥပမာ https://api.example.com/v1", speechAddressHelp: "OpenAI ပုံစံ အသံမှစာပြောင်းနိုင်သော လိပ်စာ၊ ဥပမာ https://api.example.com/v1",
    key: "ကီး", keyHelp: "ဝန်ဆောင်မှုပေးသူ၏ API ကီး။ သိမ်းပြီးလျှင် နောက်ဆုံး စာလုံး လေးလုံးသာ ပြမည်။", keySaved: "ကီး သိမ်းပြီး ({hint})", replaceKey: "အစားထိုးရန်", clearKey: "ဖျက်ရန်",
    keyWillClear: "သိမ်းသည့်အခါ ကီးကို ဖျက်ပါမည်။", undo: "ပြန်ဖျက်ရန်",
    model: "မော်ဒယ်", modelHelp: "ဝန်ဆောင်မှုပေးသူ၏ မော်ဒယ်အမည်၊ ဥပမာ gpt-4o-mini။", speechModelHelp: "အသံမှစာပြောင်း မော်ဒယ်အမည်၊ ဥပမာ whisper-1။",
    save: "သိမ်းပြီး စစ်ရန်", checking: "စစ်နေသည်…", works: "သိမ်းပြီးပါပြီ။ အလုပ်လုပ်ပါသည်။", saved: "သိမ်းပြီးပါပြီ။",
    errUnreachable: "သိမ်းပြီးပါပြီ၊ သို့သော် လိပ်စာကို ဆက်သွယ်မရပါ။ လိပ်စာကို စစ်ပါ။", errKey: "သိမ်းပြီးပါပြီ၊ သို့သော် ကီးကို လက်မခံပါ။ ကီးကို စစ်ပါ။",
    errModel: "သိမ်းပြီးပါပြီ၊ သို့သော် မော်ဒယ်ကို ရှာမတွေ့ပါ။ မော်ဒယ်အမည်ကို စစ်ပါ။", errOther: "သိမ်းပြီးပါပြီ၊ သို့သော် အလုပ်မလုပ်ပါ။ လိပ်စာ၊ ကီးနှင့် မော်ဒယ်ကို စစ်ပါ။",
    saveFailed: "မသိမ်းနိုင်ပါ။ အင်တာနက်ကို စစ်ပြီး ထပ်ကြိုးစားပါ။",
    setupBoth: "ဘာသာပြန်ခြင်းနှင့် ဖိထားပြီးပြောခြင်းအတွက် AI ဆက်တင် လိုသည်။", setupText: "ဘာသာပြန်ခြင်းအတွက် စာသား AI ဆက်တင် လိုသည်။", setupSpeech: "အသံမှစာသို့ သတ်မှတ်ပြီးလျှင် ဖိထားပြီးပြောရန် ခလုတ် ပေါ်လာမည်။", setupLink: "သတ်မှတ်ရန်",
    replyBox: "ဤနေရာတွင် ရိုက်ပါ",
  },
  id: {
    title: "Pengaturan AI", line: "Hanya Anda yang melihat ini. Terjemahan, draf percakapan dan bantuan templat memakai AI teks. Tahan untuk bicara memakai suara ke teks.",
    sourceServer: "Terjemahan memakai AI yang diatur di server, sampai Anda menyimpan milik Anda sendiri.", sourceNone: "AI teks belum diatur. Kalimat dan catatan tetap disimpan dalam bahasa aslinya.",
    textPart: "AI teks", speechPart: "Suara ke teks",
    address: "Alamat", addressHelp: "Alamat yang cocok dengan OpenAI, misalnya https://api.example.com/v1", speechAddressHelp: "Alamat dengan transkripsi suara gaya OpenAI, misalnya https://api.example.com/v1",
    key: "Kunci", keyHelp: "Kunci API dari penyedia Anda. Setelah disimpan, hanya empat huruf terakhir yang terlihat.", keySaved: "Kunci tersimpan ({hint})", replaceKey: "Ganti", clearKey: "Hapus",
    keyWillClear: "Kunci akan dihapus saat Anda menyimpan.", undo: "Urungkan",
    model: "Model", modelHelp: "Nama model dari penyedia Anda, misalnya gpt-4o-mini.", speechModelHelp: "Nama model transkripsi, misalnya whisper-1.",
    save: "Simpan dan periksa", checking: "Memeriksa…", works: "Tersimpan. Sudah berfungsi.", saved: "Tersimpan.",
    errUnreachable: "Tersimpan, tetapi alamat tidak bisa dihubungi. Periksa alamatnya.", errKey: "Tersimpan, tetapi kunci ditolak. Periksa kuncinya.",
    errModel: "Tersimpan, tetapi model tidak ditemukan. Periksa nama modelnya.", errOther: "Tersimpan, tetapi belum berfungsi. Periksa alamat, kunci dan model.",
    saveFailed: "Gagal menyimpan. Periksa koneksi lalu coba lagi.",
    setupBoth: "Terjemahan dan Tahan untuk bicara perlu pengaturan AI.", setupText: "Terjemahan perlu pengaturan AI teks.", setupSpeech: "Tahan untuk bicara muncul setelah suara ke teks diatur.", setupLink: "Atur",
    replyBox: "Ketik di sini",
  },
  tl: {
    title: "Settings ng AI", line: "Ikaw lang ang nakakakita nito. Ang pagsasalin, mga draft at ang tulong sa template ay gumagamit ng text AI. Ang Pindutin para magsalita ay gumagamit ng boses sa teksto.",
    sourceServer: "Ang pagsasalin ay gumagamit ng AI na nakatakda sa server hanggang i-save mo ang sa iyo.", sourceNone: "Wala pang text AI. Nase-save pa rin ang mga sinabi at isinulat, sa wikang ginamit.",
    textPart: "Text AI", speechPart: "Boses sa teksto",
    address: "Address", addressHelp: "Address na tugma sa OpenAI, halimbawa https://api.example.com/v1", speechAddressHelp: "Address na may audio transcription na gaya ng OpenAI, halimbawa https://api.example.com/v1",
    key: "Key", keyHelp: "Ang API key mula sa iyong provider. Kapag na-save, ang huling apat na character lang ang makikita.", keySaved: "Naka-save ang key ({hint})", replaceKey: "Palitan", clearKey: "Burahin",
    keyWillClear: "Mabubura ang key pagka-save mo.", undo: "Ibalik",
    model: "Model", modelHelp: "Ang pangalan ng model mula sa iyong provider, halimbawa gpt-4o-mini.", speechModelHelp: "Ang pangalan ng transcription model, halimbawa whisper-1.",
    save: "I-save at suriin", checking: "Sinusuri…", works: "Na-save. Gumagana na.", saved: "Na-save.",
    errUnreachable: "Na-save, pero hindi maabot ang address. Suriin ang address.", errKey: "Na-save, pero tinanggihan ang key. Suriin ang key.",
    errModel: "Na-save, pero hindi nahanap ang model. Suriin ang pangalan ng model.", errOther: "Na-save, pero hindi gumana. Suriin ang address, key at model.",
    saveFailed: "Hindi na-save. Suriin ang koneksyon at subukan ulit.",
    setupBoth: "Kailangan ng settings ng AI para sa pagsasalin at sa Pindutin para magsalita.", setupText: "Kailangan ng settings ng text AI para sa pagsasalin.", setupSpeech: "Lalabas ang Pindutin para magsalita kapag naitakda na ang boses sa teksto.", setupLink: "Itakda",
    replyBox: "Mag-type dito",
  },
};
