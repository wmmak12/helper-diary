import type { Strings } from "../client/i18n";

export const settingsS: Strings<
  | "title" | "language" | "languageLine" | "yourName" | "saveName" | "account" | "signedInAs" | "signOut"
  | "invite" | "inviteLine" | "forEmployer" | "forHelper" | "makeInvite" | "code" | "link" | "copy" | "copied" | "share" | "invites" | "noInvites"
  | "unused" | "used" | "usedBy" | "revoked" | "revoke" | "members" | "employer" | "helper" | "admin" | "removeMember" | "confirmRemoveMember"
  | "aiOff" | "failed" | "nameSaved"
  | "password" | "currentPassword" | "newPassword" | "savePassword" | "passwordChanged" | "wrongPassword" | "passwordShort" | "tooMany"
  | "resetPassword" | "resetMade"
> = {
  en: {
    title: "Settings", language: "Language", languageLine: "The whole app follows this choice.", yourName: "Your name", saveName: "Save name",
    account: "Account", signedInAs: "Signed in as {login}", signOut: "Sign out",
    invite: "Invite someone", inviteLine: "Each code works once. Send the code or the link to the person you are inviting.",
    forEmployer: "Employer (family)", forHelper: "Helper", makeInvite: "Make an invite", code: "Code", link: "Link", copy: "Copy", copied: "Copied", share: "Share",
    invites: "Invites", noInvites: "No invites yet.", unused: "Unused", used: "Used", usedBy: "Used by {name}", revoked: "Revoked", revoke: "Revoke",
    members: "Household", employer: "Employer", helper: "Helper", admin: "Admin", removeMember: "Remove", confirmRemoveMember: "Remove {name} from the household? They will be signed out.",
    aiOff: "Translation isn't set up yet: the owner adds the AI settings.",
    failed: "That didn't work. Check the connection and try again.", nameSaved: "Name saved",
    password: "Change password", currentPassword: "Current password", newPassword: "New password (at least 8 characters)", savePassword: "Change password",
    passwordChanged: "Password changed. Your other devices are signed out.", wrongPassword: "The current password isn't right.",
    passwordShort: "The new password needs at least 8 characters.", tooMany: "Too many tries. Wait 15 minutes and try again.",
    resetPassword: "Reset password", resetMade: "Send {name} this link or code. It works once, within 24 hours, and lets them choose a new password.",
  },
  zh: {
    title: "设置", language: "语言", languageLine: "整个应用都会使用这个语言。", yourName: "你的名字", saveName: "保存名字",
    account: "账户", signedInAs: "已登录：{login}", signOut: "退出登录",
    invite: "邀请成员", inviteLine: "每个邀请码只能用一次。把邀请码或链接发给你邀请的人。",
    forEmployer: "雇主（家人）", forHelper: "帮佣", makeInvite: "生成邀请", code: "邀请码", link: "链接", copy: "复制", copied: "已复制", share: "分享",
    invites: "邀请", noInvites: "还没有邀请。", unused: "未使用", used: "已使用", usedBy: "{name} 已使用", revoked: "已撤销", revoke: "撤销",
    members: "家庭成员", employer: "雇主", helper: "帮佣", admin: "管理员", removeMember: "移除", confirmRemoveMember: "确定把 {name} 移出家庭吗？对方会被退出登录。",
    aiOff: "翻译尚未设置：需要由所有者填写 AI 设置。",
    failed: "操作失败。请检查网络后重试。", nameSaved: "名字已保存",
    password: "更改密码", currentPassword: "当前密码", newPassword: "新密码（至少 8 个字符）", savePassword: "更改密码",
    passwordChanged: "密码已更改。你的其他设备已退出登录。", wrongPassword: "当前密码不正确。",
    passwordShort: "新密码至少需要 8 个字符。", tooMany: "尝试次数过多。请等 15 分钟后再试。",
    resetPassword: "重置密码", resetMade: "把这个链接或重置码发给 {name}。24 小时内有效，只能用一次，对方可以用它设置新密码。",
  },
  my: {
    title: "ဆက်တင်", language: "ဘာသာစကား", languageLine: "အက်ပ်တစ်ခုလုံး ဤဘာသာစကားဖြင့် ပေါ်ပါမည်။", yourName: "သင့်အမည်", saveName: "အမည်သိမ်းရန်",
    account: "အကောင့်", signedInAs: "{login} ဖြင့် ဝင်ထားသည်", signOut: "ထွက်ရန်",
    invite: "ဖိတ်ခေါ်ရန်", inviteLine: "ကုဒ်တစ်ခုကို တစ်ကြိမ်သာ သုံးနိုင်သည်။ ဖိတ်သူထံ ကုဒ် သို့မဟုတ် လင့်ခ်ကို ပို့ပါ။",
    forEmployer: "အိမ်ရှင် (မိသားစု)", forHelper: "အိမ်အကူ", makeInvite: "ဖိတ်ကုဒ်ပြုလုပ်ရန်", code: "ကုဒ်", link: "လင့်ခ်", copy: "ကူးရန်", copied: "ကူးပြီးပါပြီ", share: "မျှဝေရန်",
    invites: "ဖိတ်ကုဒ်များ", noInvites: "ဖိတ်ကုဒ် မရှိသေးပါ။", unused: "မသုံးရသေး", used: "သုံးပြီး", usedBy: "{name} သုံးပြီး", revoked: "ပယ်ဖျက်ပြီး", revoke: "ပယ်ဖျက်ရန်",
    members: "အိမ်သားများ", employer: "အိမ်ရှင်", helper: "အိမ်အကူ", admin: "စီမံသူ", removeMember: "ဖယ်ရှားရန်", confirmRemoveMember: "{name} ကို အိမ်မှ ဖယ်ရှားမှာ သေချာပါသလား။",
    aiOff: "ဘာသာပြန်ခြင်း မသတ်မှတ်ရသေးပါ။ ပိုင်ရှင်က AI ဆက်တင်များ ထည့်ပေးရပါမည်။",
    failed: "မအောင်မြင်ပါ။ အင်တာနက်ကို စစ်ပြီး ထပ်ကြိုးစားပါ။", nameSaved: "အမည် သိမ်းပြီးပါပြီ",
    password: "စကားဝှက် ပြောင်းရန်", currentPassword: "လက်ရှိ စကားဝှက်", newPassword: "စကားဝှက် အသစ် (အနည်းဆုံး ၈ လုံး)", savePassword: "စကားဝှက် ပြောင်းရန်",
    passwordChanged: "စကားဝှက် ပြောင်းပြီးပါပြီ။ သင့်အခြားစက်များမှ ထွက်သွားပါမည်။", wrongPassword: "လက်ရှိ စကားဝှက် မမှန်ပါ။",
    passwordShort: "စကားဝှက် အသစ်သည် အနည်းဆုံး ၈ လုံး ရှိရပါမည်။", tooMany: "ကြိုးစားမှု များလွန်းပါသည်။ ၁၅ မိနစ် စောင့်ပြီး ထပ်ကြိုးစားပါ။",
    resetPassword: "စကားဝှက် ပြန်သတ်မှတ်ရန်", resetMade: "ဤလင့်ခ် သို့မဟုတ် ကုဒ်ကို {name} ထံ ပို့ပါ။ ၂၄ နာရီအတွင်း တစ်ကြိမ်သာ သုံးနိုင်ပြီး စကားဝှက် အသစ် ရွေးနိုင်ပါမည်။",
  },
  id: {
    title: "Pengaturan", language: "Bahasa", languageLine: "Seluruh aplikasi akan memakai bahasa ini.", yourName: "Nama Anda", saveName: "Simpan nama",
    account: "Akun", signedInAs: "Masuk sebagai {login}", signOut: "Keluar",
    invite: "Undang seseorang", inviteLine: "Setiap kode hanya bisa dipakai sekali. Kirim kode atau tautan ke orang yang Anda undang.",
    forEmployer: "Majikan (keluarga)", forHelper: "Asisten rumah tangga", makeInvite: "Buat undangan", code: "Kode", link: "Tautan", copy: "Salin", copied: "Disalin", share: "Bagikan",
    invites: "Undangan", noInvites: "Belum ada undangan.", unused: "Belum dipakai", used: "Sudah dipakai", usedBy: "Dipakai oleh {name}", revoked: "Dibatalkan", revoke: "Batalkan",
    members: "Anggota rumah", employer: "Majikan", helper: "Asisten", admin: "Admin", removeMember: "Keluarkan", confirmRemoveMember: "Keluarkan {name} dari rumah ini? Dia akan otomatis keluar dari aplikasi.",
    aiOff: "Terjemahan belum diatur: pemilik perlu mengisi pengaturan AI.",
    failed: "Tidak berhasil. Periksa koneksi dan coba lagi.", nameSaved: "Nama disimpan",
    password: "Ganti kata sandi", currentPassword: "Kata sandi sekarang", newPassword: "Kata sandi baru (minimal 8 karakter)", savePassword: "Ganti kata sandi",
    passwordChanged: "Kata sandi sudah diganti. Perangkat Anda yang lain otomatis keluar.", wrongPassword: "Kata sandi sekarang salah.",
    passwordShort: "Kata sandi baru minimal 8 karakter.", tooMany: "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.",
    resetPassword: "Reset kata sandi", resetMade: "Kirim tautan atau kode ini ke {name}. Berlaku sekali dalam 24 jam, untuk memilih kata sandi baru.",
  },
  tl: {
    title: "Mga setting", language: "Wika", languageLine: "Susundin ng buong app ang napili mo.", yourName: "Pangalan mo", saveName: "I-save ang pangalan",
    account: "Account", signedInAs: "Naka-sign in bilang {login}", signOut: "Mag-sign out",
    invite: "Mag-imbita", inviteLine: "Isang beses lang magagamit ang bawat code. Ipadala ang code o link sa taong iniimbita mo.",
    forEmployer: "Amo (pamilya)", forHelper: "Kasambahay", makeInvite: "Gumawa ng imbitasyon", code: "Code", link: "Link", copy: "Kopyahin", copied: "Nakopya na", share: "I-share",
    invites: "Mga imbitasyon", noInvites: "Wala pang imbitasyon.", unused: "Hindi pa nagamit", used: "Nagamit na", usedBy: "Ginamit ni {name}", revoked: "Binawi na", revoke: "Bawiin",
    members: "Sambahayan", employer: "Amo", helper: "Kasambahay", admin: "Admin", removeMember: "Alisin", confirmRemoveMember: "Alisin si {name} sa sambahayan? Masa-sign out siya.",
    aiOff: "Hindi pa naka-set up ang pagsasalin: ang may-ari ang maglalagay ng AI settings.",
    failed: "Hindi gumana. Tingnan ang koneksyon at subukan ulit.", nameSaved: "Na-save ang pangalan",
    password: "Palitan ang password", currentPassword: "Kasalukuyang password", newPassword: "Bagong password (hindi bababa sa 8 character)", savePassword: "Palitan ang password",
    passwordChanged: "Napalitan na ang password. Na-sign out ang iba mong device.", wrongPassword: "Mali ang kasalukuyang password.",
    passwordShort: "Kailangang hindi bababa sa 8 character ang bagong password.", tooMany: "Masyadong maraming subok. Maghintay ng 15 minuto at subukan ulit.",
    resetPassword: "I-reset ang password", resetMade: "Ipadala kay {name} ang link o code na ito. Isang beses lang ito magagamit, sa loob ng 24 oras, para makapili siya ng bagong password.",
  },
};
