"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m } from "motion/react";
import { Check, Home, Pencil, Sparkles, X } from "lucide-react";
import { langInfo } from "@/lib/languages";
import { fmt, useMe, useT } from "@/lib/client/i18n";
import { api } from "@/lib/client/api";
import { useApi } from "@/lib/client/useApi";
import { tplS } from "@/lib/strings/templates";
import { chatS } from "@/lib/strings/tplchat";
import type { ChatMessage, HouseholdFacts, Proposal, ProposalTask, TaskMark, TemplateTask, TplChatView } from "@/lib/types";
import { LoadError, PageHeader, Skeleton } from "@/components/ui";
import { AskBox, HouseholdLine } from "./AskBox";
import { SaveAsSheet, TaskSheet } from "./TemplateEditor";
import { daysLabel, tplHref } from "./shared";

type CT = Record<keyof (typeof chatS)["en"], string>;
type TT = Record<keyof (typeof tplS)["en"], string>;

/** 4.0: one chat. Opening it reads what was saved (no model call); only Send asks the AI. */
export function ChatScreen({ id }: { id: number }) {
  const { lang } = useMe();
  const t = useT(chatS);
  const tag = langInfo(lang).tag;
  const { data, setData, error, reload } = useApi<TplChatView>(`/api/template-chats/${id}`);
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;
  useEffect(() => {
    if (count || pending) endRef.current?.scrollIntoView({ block: "end" });
  }, [count, pending]);
  if (error && !data) return <LoadError error={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={6} />;
  const { chat, messages, proposal, profile } = data;
  const lastProposalMsg = [...messages].reverse().find((x) => x.kind === "proposal")?.id;
  const showCard = proposal && proposal.state !== "discarded";

  const send = async (text: string) => {
    setPending(text);
    try {
      setData(await api<TplChatView>(`/api/template-chats/${id}/messages`, { body: { text } }));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="mx-auto max-w-[760px] pb-8">
      <PageHeader title={chat.base_name ? fmt(t.about, { name: chat.base_name }) : t.aiTitle} back="/templates" eyebrow={t.chatEyebrow} />
      <div className="-mt-2 mb-3">
        {chat.base_ref && (
          <Link href={tplHref(chat.base_ref)} className="mr-4 inline-flex min-h-[44px] items-center text-[16px] text-primary underline decoration-rule underline-offset-4">
            <span lang={chat.lang}>{chat.base_name}</span>
          </Link>
        )}
        <HouseholdLine profile={profile} />
      </div>

      <ol className="space-y-3">
        {messages.map((x) => (
          <Message key={x.id} msg={x} t={t} chatId={id} onChange={setData} card={showCard && x.id === lastProposalMsg ? <ProposalCard chatId={id} proposal={proposal!} acceptedRef={chat.accepted_ref} onChange={setData} /> : null} />
        ))}
        {pending && (
          <>
            <li className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-[6px] border border-rule bg-desk px-3 py-2" lang={langInfo(/[㐀-鿿]/.test(pending) ? "zh" : "en").tag}>{pending}</p></li>
            <li className="flex items-center gap-2 px-1 text-primary"><span className="ink-dots" aria-hidden><span /><span /><span /></span><span lang={tag} className="sr-only">{t.writing}</span></li>
          </>
        )}
      </ol>
      <div ref={endRef} />

      <div className="mt-5">
        <AskBox id="chat-box" rows={2} label={t.replyHint} placeholder={t.replyHint} onSend={send} />
      </div>
    </div>
  );
}

function Message({ msg, t, card, chatId, onChange }: { msg: ChatMessage; t: CT; card: React.ReactNode; chatId: number; onChange: (v: TplChatView) => void }) {
  const l = langInfo(msg.lang).tag;
  if (msg.role === "user") {
    return (
      <li className="flex justify-end">
        <p lang={l} className="max-w-[85%] whitespace-pre-wrap rounded-[6px] border border-rule bg-desk px-3 py-2">{msg.text}</p>
      </li>
    );
  }
  return (
    <li className="space-y-2">
      <p lang={l} className="flex items-start gap-2 text-[18px]">
        <Sparkles size={18} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0 text-ribbon-ink" />
        <span className="min-w-0 whitespace-pre-wrap">{msg.text || (msg.proposed ? fmt(t.proposed, { name: msg.proposed.name, n: msg.proposed.count }) : "")}</span>
      </p>
      {card ?? (msg.proposed && msg.text && <p lang={l} className="pl-[26px] text-[15px] text-muted">{fmt(t.proposed, { name: msg.proposed.name, n: msg.proposed.count })}</p>)}
      {msg.offer && <SaveToHousehold chatId={chatId} msgId={msg.id} facts={msg.offer.facts} saved={msg.offer.saved} onChange={onChange} />}
    </li>
  );
}

/** "Wife, Grandpa 82, cat, 4 bedrooms": what a Save to Your household button adds. */
function factsLine(f: HouseholdFacts, t: CT, sep: string): string {
  const parts: string[] = f.members.map((m) => (m.age !== null ? fmt(t.ageN, { name: m.name, age: m.age }) : m.name));
  parts.push(...f.pets);
  if (f.bedrooms !== null) parts.push(fmt(t.bedroomsN, { n: f.bedrooms }));
  if (f.bathrooms !== null) parts.push(fmt(t.bathroomsN, { n: f.bathrooms }));
  if (f.floors !== null) parts.push(fmt(t.floorsN, { n: f.floors }));
  if (f.garden !== null) parts.push(f.garden ? t.gardenYes : t.gardenNo);
  return parts.join(sep);
}

/** 5.2: adds what the employer just said about the home to Your household (never overwrites); then reads as saved. */
function SaveToHousehold({ chatId, msgId, facts, saved, onChange }: { chatId: number; msgId: number; facts: HouseholdFacts; saved: boolean; onChange: (v: TplChatView) => void }) {
  const { lang } = useMe();
  const t = useT(chatS);
  const tag = langInfo(lang).tag;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const what = factsLine(facts, t, lang === "zh" ? "、" : ", ");
  if (saved) {
    return (
      <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22 }} lang={tag} role="status" className="ml-[26px] inline-flex min-h-[44px] items-center gap-2 text-[16px] font-medium text-moss">
        <Check size={18} strokeWidth={2} aria-hidden className="shrink-0" />{fmt(t.savedHh, { what })}
      </m.p>
    );
  }
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      onChange(await api<TplChatView>(`/api/template-chats/${chatId}/messages/${msgId}/household`, { method: "POST" }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ml-[26px]">
      <button type="button" className="btn btn-quiet btn-small text-left" disabled={busy} onClick={save}>
        {busy ? <span className="ink-dots" aria-hidden><span /><span /><span /></span> : <Home size={18} strokeWidth={1.75} aria-hidden className="shrink-0" />}
        <span lang={tag} className={failed ? "text-danger" : ""}>{failed ? t.saveHhFailed : fmt(t.saveHh, { what })}</span>
      </button>
    </div>
  );
}

/** The proposal as a template card: marks, the employer's own edits, then Accept, Keep editing or Discard. */
function ProposalCard({ chatId, proposal, acceptedRef, onChange }: { chatId: number; proposal: Proposal; acceptedRef: string | null; onChange: (v: TplChatView) => void }) {
  const { lang, toast } = useMe();
  const t = useT(chatS);
  const tt = useT(tplS);
  const tag = langInfo(lang).tag;
  const pl = langInfo(proposal.lang).tag;
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = proposal.state === "open";

  const saveTasks = async (tasks: ProposalTask[]) => {
    setBusy(true);
    setErr(null);
    try {
      onChange(await api<TplChatView>(`/api/template-chats/${chatId}`, { method: "PATCH", body: { tasks } }));
    } catch {
      setErr(tt.saveFailed);
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    setBusy(true);
    try {
      onChange(await api<TplChatView>(`/api/template-chats/${chatId}/discard`, { method: "POST" }));
    } catch {
      setErr(tt.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="page overflow-hidden"
      data-proposal
    >
      <div className="border-b border-rule px-4 py-3">
        <p lang={pl} className="text-[21px] font-semibold">{proposal.name}</p>
        <p lang={tag} className="text-[15px] text-muted">{fmt(tt.nTasks, { n: proposal.tasks.length })}{open ? ` · ${t.editHint}` : ""}</p>
      </div>
      <ul className="divide-y divide-rule">
        {proposal.tasks.map((x, i) => (
          <li key={`${i}:${x.title}`} className="flex items-start gap-1 py-2 pl-4 pr-2">
            <button type="button" disabled={!open} onClick={() => setEditing(i)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
              <span className="tabular w-[48px] shrink-0 pt-0.5 text-[15px] text-muted">{x.time ?? ""}</span>
              <span className="min-w-0 flex-1">
                <span lang={pl} className="block text-[18px] font-medium">{x.title}</span>
                <span lang={tag} className="block text-[15px] text-primary">{daysLabel(x, tt, tag)}</span>
                {x.note && <span lang={pl} className="block text-[15px] text-muted">{x.note}</span>}
                {proposal.marks && <MarkTag mark={proposal.marks[i]} t={t} tt={tt} tag={tag} />}
              </span>
            </button>
            {open && (
              <>
                <button type="button" onClick={() => setEditing(i)} aria-label={`${tt.editTask}: ${x.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-ink hover:bg-desk">
                  <Pencil size={18} strokeWidth={1.75} aria-hidden />
                </button>
                <button type="button" disabled={busy || proposal.tasks.length <= 1} onClick={() => saveTasks(proposal.tasks.filter((_, j) => j !== i))} aria-label={`${tt.removeTask}: ${x.title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-danger hover:bg-danger-wash disabled:opacity-40">
                  <X size={20} strokeWidth={1.75} aria-hidden />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      {proposal.removed.length > 0 && (
        <div className="border-t border-rule px-4 py-2">
          <p lang={tag} className="text-[15px] font-semibold text-muted">{t.removedHead}</p>
          <ul>
            {proposal.removed.map((x, i) => (
              <li key={i} className="flex items-baseline gap-3 py-1">
                <span className="tabular w-[48px] shrink-0 text-[15px] text-muted">{x.time ?? ""}</span>
                <span className="min-w-0 flex-1">
                  <s lang={pl} className="text-muted">{x.title}</s>{" "}
                  <span lang={tag} className="whitespace-nowrap rounded-[3px] bg-danger-wash px-1.5 text-[14px] text-danger">{t.removed}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {err && <p role="alert" lang={tag} className="px-4 pb-2 text-danger">{err}</p>}
      <div className="border-t border-rule px-4 py-3">
        {open ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setAccepting(true)}><Check size={20} strokeWidth={2} aria-hidden /> <span lang={tag}>{t.accept}</span></button>
            <Link href={`/templates/chat-${chatId}`} className="btn btn-quiet"><Pencil size={18} strokeWidth={1.75} aria-hidden /> <span lang={tag}>{t.keepEditing}</span></Link>
            <button type="button" className="btn btn-quiet" disabled={busy} onClick={discard}><span lang={tag}>{t.discard}</span></button>
          </div>
        ) : (
          <AcceptedLine acceptedRef={acceptedRef} t={t} tag={tag} />
        )}
      </div>

      <TaskSheet
        open={editing !== null}
        task={editing !== null ? proposal.tasks[editing] : null}
        taskLang={pl}
        onClose={() => setEditing(null)}
        onSave={(x: TemplateTask) => {
          const i = editing!;
          setEditing(null);
          saveTasks(proposal.tasks.map((y, j) => (j === i ? { ...x, from: y.from } : y)));
        }}
        onRemove={editing !== null && proposal.tasks.length > 1 ? () => { const i = editing; setEditing(null); saveTasks(proposal.tasks.filter((_, j) => j !== i)); } : undefined}
      />
      <SaveAsSheet
        open={accepting}
        initial={proposal.name}
        title={t.acceptTitle}
        onClose={() => setAccepting(false)}
        onSave={async (name) => {
          try {
            const r = await api<{ template: { ref: string } }>(`/api/template-chats/${chatId}/accept`, { body: { name } });
            toast({ text: tt.savedMine });
            router.push(tplHref(r.template.ref));
          } catch {
            throw new Error(tt.saveFailed);
          }
        }}
      />
    </m.div>
  );
}

function AcceptedLine({ acceptedRef: ref, t, tag }: { acceptedRef: string | null; t: CT; tag: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border-l-[3px] border-ribbon-ink bg-ribbon-wash px-3 py-2">
      <span lang={tag} className="text-ribbon-ink"><Check size={18} strokeWidth={2} aria-hidden className="mr-1.5 inline align-[-3px]" />{t.acceptedLine}</span>
      {ref && <Link href={tplHref(ref)} className="btn btn-quiet btn-small"><span lang={tag}>{t.openTemplate}</span></Link>}
    </div>
  );
}

/** added (ribbon wash), changed with what changed, or nothing when the task is as it was. */
function MarkTag({ mark, t, tt, tag }: { mark: TaskMark | undefined; t: CT; tt: TT; tag: string }) {
  if (!mark || mark.mark === "same") return null;
  if (mark.mark === "added") return <span lang={tag} className="mt-1 inline-block rounded-[3px] bg-ribbon-wash px-1.5 text-[14px] text-ribbon-ink">{t.added}</span>;
  const was = mark.was!;
  const parts = mark.changed.map((c) =>
    c === "time" ? fmt(t.wasTime, { v: was.time ?? "–" }) : c === "days" ? fmt(t.wasDays, { v: daysLabel(was, tt, tag) }) : c === "title" ? fmt(t.wasTitle, { v: was.title }) : t.partNote,
  );
  return <span lang={tag} className="mt-1 inline-block rounded-[3px] bg-ochre-wash px-1.5 text-[14px] text-ochre-ink">{t.changed}: {parts.join("; ")}</span>;
}
