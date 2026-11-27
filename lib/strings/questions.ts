import type { Strings } from "../client/i18n";

export const qs: Strings<"ask" | "askAbout" | "askPlaceholder" | "send" | "sent" | "failed" | "askTitle"> = {
  en: { ask: "Ask a question", askAbout: "About: {title}", askPlaceholder: "Type your question", send: "Send question", sent: "Question sent. The family will answer here.", failed: "The question didn't send. Try again.", askTitle: "Ask a question" },
  zh: { ask: "提问", askAbout: "关于：{title}", askPlaceholder: "输入你的问题", send: "发送问题", sent: "问题已发送，家人会在这里回答。", failed: "问题没有发送成功，请重试。", askTitle: "提问" },
  my: { ask: "မေးခွန်းမေးရန်", askAbout: "အကြောင်းအရာ - {title}", askPlaceholder: "သင့်မေးခွန်းကို ရိုက်ပါ", send: "မေးခွန်းပို့ရန်", sent: "မေးခွန်း ပို့ပြီးပါပြီ။ မိသားစုက ဤနေရာတွင် ဖြေပါမည်။", failed: "မေးခွန်း မပို့နိုင်ပါ။ ထပ်ကြိုးစားပါ။", askTitle: "မေးခွန်းမေးရန်" },
  id: { ask: "Ajukan pertanyaan", askAbout: "Tentang: {title}", askPlaceholder: "Ketik pertanyaan Anda", send: "Kirim pertanyaan", sent: "Pertanyaan terkirim. Keluarga akan menjawab di sini.", failed: "Pertanyaan tidak terkirim. Coba lagi.", askTitle: "Ajukan pertanyaan" },
  tl: { ask: "Magtanong", askAbout: "Tungkol sa: {title}", askPlaceholder: "I-type ang iyong tanong", send: "Ipadala ang tanong", sent: "Naipadala na ang tanong. Sasagot ang pamilya dito.", failed: "Hindi naipadala ang tanong. Subukan ulit.", askTitle: "Magtanong" },
};

export const qpage: Strings<
  | "title" | "open" | "answered" | "emptyHelper" | "emptyEmployer" | "noAnswerYet" | "answerPlaceholder" | "sendAnswer"
  | "answeredBy" | "about" | "answerFailed" | "answerSent" | "asked" | "yourQuestions"
> = {
  en: {
    title: "Questions", open: "Waiting for an answer", answered: "Answered", emptyHelper: "Ask anything you are unsure about. The family answers here, in your language.",
    emptyEmployer: "When your helper asks something, it appears here translated, and you answer in your own language.", noAnswerYet: "No answer yet",
    answerPlaceholder: "Type your answer", sendAnswer: "Send answer", answeredBy: "{name} answered", about: "About", answerFailed: "The answer didn't send. Try again.",
    answerSent: "Answer sent. She reads it in her language on Today.", asked: "{name} asked", yourQuestions: "Your questions",
  },
  zh: {
    title: "问题", open: "等待回答", answered: "已回答", emptyHelper: "有不确定的事都可以问，家人会用你的语言在这里回答。",
    emptyEmployer: "帮佣提的问题会翻译后显示在这里，你用自己的语言回答即可。", noAnswerYet: "还没有回答",
    answerPlaceholder: "输入你的回答", sendAnswer: "发送回答", answeredBy: "{name} 回答", about: "关于", answerFailed: "回答没有发送成功，请重试。",
    answerSent: "回答已发送，她会在“今天”页用她的语言看到。", asked: "{name} 问", yourQuestions: "你的问题",
  },
  my: {
    title: "မေးခွန်းများ", open: "အဖြေစောင့်နေသည်", answered: "ဖြေပြီး", emptyHelper: "မသေချာသည့်အရာမှန်သမျှ မေးနိုင်ပါသည်။ မိသားစုက သင့်ဘာသာဖြင့် ဤနေရာတွင် ဖြေပါမည်။",
    emptyEmployer: "အိမ်အကူက မေးသည့်အခါ ဘာသာပြန်ပြီး ဤနေရာတွင် ပေါ်မည်။ သင့်ဘာသာဖြင့် ဖြေနိုင်သည်။", noAnswerYet: "အဖြေ မရသေးပါ",
    answerPlaceholder: "အဖြေကို ရိုက်ပါ", sendAnswer: "အဖြေပို့ရန်", answeredBy: "{name} ဖြေသည်", about: "အကြောင်းအရာ", answerFailed: "အဖြေ မပို့နိုင်ပါ။ ထပ်ကြိုးစားပါ။",
    answerSent: "အဖြေ ပို့ပြီးပါပြီ။", asked: "{name} မေးသည်", yourQuestions: "သင့်မေးခွန်းများ",
  },
  id: {
    title: "Pertanyaan", open: "Menunggu jawaban", answered: "Sudah dijawab", emptyHelper: "Tanyakan apa saja yang Anda belum yakin. Keluarga menjawab di sini, dalam bahasa Anda.",
    emptyEmployer: "Saat asisten rumah tangga Anda bertanya, pertanyaannya muncul di sini sudah diterjemahkan, dan Anda menjawab dalam bahasa Anda sendiri.", noAnswerYet: "Belum ada jawaban",
    answerPlaceholder: "Ketik jawaban Anda", sendAnswer: "Kirim jawaban", answeredBy: "{name} menjawab", about: "Tentang", answerFailed: "Jawaban tidak terkirim. Coba lagi.",
    answerSent: "Jawaban terkirim. Dia membacanya dalam bahasanya di Hari ini.", asked: "{name} bertanya", yourQuestions: "Pertanyaan Anda",
  },
  tl: {
    title: "Mga tanong", open: "Naghihintay ng sagot", answered: "Nasagot na", emptyHelper: "Magtanong ka ng kahit anong hindi ka sigurado. Sasagot ang pamilya dito, sa iyong wika.",
    emptyEmployer: "Kapag nagtanong ang kasambahay mo, lalabas ito dito na naisalin na, at sasagot ka sa sarili mong wika.", noAnswerYet: "Wala pang sagot",
    answerPlaceholder: "I-type ang iyong sagot", sendAnswer: "Ipadala ang sagot", answeredBy: "Sumagot si {name}", about: "Tungkol sa", answerFailed: "Hindi naipadala ang sagot. Subukan ulit.",
    answerSent: "Naipadala na ang sagot. Mababasa niya ito sa kanyang wika sa Ngayon.", asked: "Nagtanong si {name}", yourQuestions: "Iyong mga tanong",
  },
};
