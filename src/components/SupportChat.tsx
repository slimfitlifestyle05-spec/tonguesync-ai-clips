import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supportChat } from "@/lib/support-chat.functions";
import { getChannelContext, saveChannelContext, clearChannelContext } from "@/lib/channel-context.functions";
import {
  listCoachConversations,
  getCoachConversation,
  upsertCoachConversation,
  deleteCoachConversation,
  type ConversationSummary,
} from "@/lib/ai-coach-history.functions";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Sparkles, Loader2, Bot, Youtube, Pencil, History, Plus, Trash2, MessageCircle, Maximize2, Minimize2 } from "lucide-react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "tonguesync_support_chat_v1";
const CHANNEL_KEY = "tonguesync_ai_coach_channel_v1";
const FULLSCREEN_KEY = "tonguesync_ai_coach_fullscreen_v1";

type ChannelCtx = {
  channelUrl?: string;
  niche?: string;
  topics?: string;
  audience?: string;
  language?: string;
  country?: string;
  skipped?: boolean;
};

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hey — I'm **TongueSync AI Coach**, your YouTube Growth & SEO strategist (vidIQ-style, powered by Gemini).\n\nAsk me for a **niche keyword table**, **viral title formulas**, **YouTube algorithm tips**, or **Shorts retention tricks** — I'll give you data-backed answers with search volume, competition, and CTR strategy.\n\n> Free plan: **10 credits/day** &middot; Pro: **50 credits/day** &middot; 1 credit per question.",
};

type CoachMeta = { creditsLeft: number; dailyLimit: number; tier: "free" | "pro" } | null;

export function SupportChat() {
  const { dir, lang } = useI18n();
  const isAr = lang === "ar";
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [meta, setMeta] = useState<CoachMeta>(null);
  const [channel, setChannel] = useState<ChannelCtx | null>(null);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [chDraft, setChDraft] = useState<ChannelCtx>({});
  const [seededFromIdeas, setSeededFromIdeas] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askAi = useServerFn(supportChat);
  const loadChannel = useServerFn(getChannelContext);
  const saveChannelFn = useServerFn(saveChannelContext);
  const clearChannelFn = useServerFn(clearChannelContext);
  const listConvsFn = useServerFn(listCoachConversations);
  const getConvFn = useServerFn(getCoachConversation);
  const upsertConvFn = useServerFn(upsertCoachConversation);
  const deleteConvFn = useServerFn(deleteCoachConversation);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch { /* ignore */ }
    try {
      const fs = window.localStorage.getItem(FULLSCREEN_KEY);
      if (fs === "1") setFullscreen(true);
    } catch { /* ignore */ }
    try {
      const rawC = window.localStorage.getItem(CHANNEL_KEY);
      if (rawC) {
        const parsed = JSON.parse(rawC) as ChannelCtx;
        if (parsed && typeof parsed === "object") {
          setChannel(parsed);
          setChDraft(parsed);
        }
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persist fullscreen preference (per browser/user)
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(FULLSCREEN_KEY, fullscreen ? "1" : "0");
    } catch { /* ignore */ }
  }, [fullscreen, hydrated]);

  // If signed in, prefer server-stored channel context (survives across devices/visits)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        setSignedIn(Boolean(sess.session));
        if (!sess.session) return;
        const remote = await loadChannel({});
        if (cancelled) return;
        if (remote) {
          const val: ChannelCtx = {
            channelUrl: remote.channelUrl ?? undefined,
            niche: remote.niche ?? undefined,
            topics: remote.topics ?? undefined,
            audience: remote.audience ?? undefined,
            language: remote.language ?? undefined,
              country: remote.country ?? undefined,
            skipped: false,
          };
          setChannel(val);
          setChDraft(val);
          try { window.localStorage.setItem(CHANNEL_KEY, JSON.stringify(val)); } catch { /* ignore */ }
        }
      } catch { /* ignore — anonymous or offline */ }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session));
    });
    return () => { cancelled = true; };
    // NOTE: onAuthStateChange sub is intentionally not cleaned to keep signedIn state fresh; parent-level listener also runs.
    void sub;
  }, [loadChannel]);

  // Load saved conversations list when signed-in + panel opens
  async function refreshConversations() {
    if (!signedIn) { setConversations([]); return; }
    try {
      setLoadingHistory(true);
      const rows = await listConvsFn();
      setConversations(rows);
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  }
  useEffect(() => {
    if (open && signedIn) void refreshConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, signedIn]);

  // Auto-save current conversation (debounced) whenever messages change and the
  // conversation has at least one real user turn.
  useEffect(() => {
    if (!signedIn || !hydrated) return;
    const hasUserTurn = messages.some((m) => m.role === "user");
    if (!hasUserTurn) return;
    if (pending) return; // wait for round-trip to finish
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const firstUser = messages.find((m) => m.role === "user");
        const title = (channel?.niche || channel?.topics || firstUser?.content || "AI Coach chat")
          .toString()
          .slice(0, 90);
        const res = await upsertConvFn({
          data: {
            id: currentConvId ?? undefined,
            title,
            niche: channel?.niche ?? null,
            topics: channel?.topics ?? null,
            messages: messages.slice(-40).map((m) => ({ role: m.role, content: m.content })),
          },
        });
        if (!currentConvId) setCurrentConvId(res.id);
        // Refresh sidebar list (updated_at ordering)
        void refreshConversations();
      } catch { /* silent — best effort */ }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, pending, signedIn, hydrated, channel?.niche, channel?.topics]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch { /* ignore quota */ }
  }, [messages, hydrated]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, pending]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Allow external triggers (e.g. top nav, viral-ideas page) to open the coach.
  // Payload can seed a niche + prefill the first user message.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (ev: Event) => {
      setOpen(true);
      const detail = (ev as CustomEvent).detail as
        | { niche?: string; topics?: string; prefill?: string }
        | undefined;
      if (!detail) return;
      if (detail.niche || detail.topics) {
        const seeded: ChannelCtx = {
          ...(channel && !channel.skipped ? channel : {}),
          niche: detail.niche || channel?.niche,
          topics: detail.topics || channel?.topics,
          skipped: false,
        };
        setChDraft(seeded);
        // Do NOT save yet — surface the form so the user reviews / edits / confirms first.
        setShowChannelForm(true);
        setSeededFromIdeas(true);
      }
      if (detail.prefill) {
        setInput(detail.prefill);
      }
    };
    window.addEventListener("tonguesync:open-ai-coach", handler as EventListener);
    return () => window.removeEventListener("tonguesync:open-ai-coach", handler as EventListener);
  }, [channel]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const channelPayload = channel && !channel.skipped
        ? {
            channelUrl: channel.channelUrl || null,
            niche: channel.niche || null,
            topics: channel.topics || null,
            audience: channel.audience || null,
            language: channel.language || null,
            country: channel.country || null,
          }
        : null;
      const res = await askAi({ data: { messages: next, channelContext: channelPayload, uiLanguage: isAr ? "ar" : "en" } });
      const { reply, creditsLeft, dailyLimit, tier } = res;
      setMeta({ creditsLeft, dailyLimit, tier });
      setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      const isAuth = /unauthorized|authorization|token/i.test(raw);
      const msg = isAuth
        ? "You need to **sign in** to use AI Coach. 👉 [Sign in / Create free account](/auth) — Free plan gets 10 AI Coach credits/day."
        : `_${raw}_`;
      setMessages((cur) => [...cur, { role: "assistant", content: msg }]);
    } finally {
      setPending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function reset() {
    setMessages([WELCOME]);
    setCurrentConvId(null);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  function newConversation() {
    setMessages([WELCOME]);
    setCurrentConvId(null);
    setHistoryOpen(false);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setTimeout(() => inputRef.current?.focus(), 60);
  }

  async function loadConversation(id: string) {
    try {
      setLoadingHistory(true);
      const conv = await getConvFn({ data: { id } });
      if (!conv) return;
      setMessages(
        conv.messages.length > 0
          ? conv.messages.map((m) => ({ role: m.role, content: m.content }))
          : [WELCOME],
      );
      setCurrentConvId(conv.id);
      if (conv.niche || conv.topics) {
        const restored: ChannelCtx = {
          ...(channel && !channel.skipped ? channel : {}),
          niche: conv.niche ?? channel?.niche,
          topics: conv.topics ?? channel?.topics,
          skipped: false,
        };
        setChannel(restored);
        setChDraft(restored);
        try { window.localStorage.setItem(CHANNEL_KEY, JSON.stringify(restored)); } catch { /* ignore */ }
      }
      setHistoryOpen(false);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        inputRef.current?.focus();
      }, 60);
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  }

  async function removeConversation(id: string) {
    try {
      await deleteConvFn({ data: { id } });
      setConversations((cur) => cur.filter((c) => c.id !== id));
      if (currentConvId === id) {
        setCurrentConvId(null);
        setMessages([WELCOME]);
      }
    } catch { /* ignore */ }
  }

  async function saveChannel() {
    const cleaned: ChannelCtx = {
      channelUrl: chDraft.channelUrl?.trim() || undefined,
      niche: chDraft.niche?.trim() || undefined,
      topics: chDraft.topics?.trim() || undefined,
      audience: chDraft.audience?.trim() || undefined,
      language: chDraft.language?.trim() || undefined,
      country: chDraft.country?.trim() || undefined,
      skipped: false,
    };
    setChannel(cleaned);
    try { window.localStorage.setItem(CHANNEL_KEY, JSON.stringify(cleaned)); } catch { /* ignore */ }
    setShowChannelForm(false);
    setSeededFromIdeas(false);
    setTimeout(() => inputRef.current?.focus(), 80);
    // Persist to server for signed-in users (best-effort)
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) {
        await saveChannelFn({
          data: {
            channelUrl: cleaned.channelUrl ?? null,
            niche: cleaned.niche ?? null,
            topics: cleaned.topics ?? null,
            audience: cleaned.audience ?? null,
            language: cleaned.language ?? null,
            country: cleaned.country ?? null,
          },
        });
      }
    } catch { /* ignore — will retry next save */ }
  }
  function skipChannel() {
    const val: ChannelCtx = { skipped: true };
    setChannel(val);
    try { window.localStorage.setItem(CHANNEL_KEY, JSON.stringify(val)); } catch { /* ignore */ }
    setShowChannelForm(false);
    setSeededFromIdeas(false);
  }
  async function clearChannel() {
    setChannel(null);
    setChDraft({});
    try { window.localStorage.removeItem(CHANNEL_KEY); } catch { /* ignore */ }
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (sess.session) await clearChannelFn({});
    } catch { /* ignore */ }
  }

  const needsChannelPrompt = !channel; // never asked yet
  const hasNiche = !!(channel && !channel.skipped && (channel.niche || channel.topics));

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open AI Coach"
          dir={dir}
          className={
            "group fixed bottom-5 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 py-2 shadow-2xl shadow-fuchsia-500/30 backdrop-blur transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:ring-offset-2 focus:ring-offset-slate-950 " +
            (isAr ? "left-5 pr-2 pl-4 flex-row-reverse" : "right-5 pl-2 pr-4")
          }
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-amber-400 text-black">
            <Bot className="h-5 w-5" strokeWidth={2.25} />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
          </span>
          <span className={"flex flex-col leading-tight " + (isAr ? "items-end text-right" : "items-start text-left")}>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fuchsia-300">AI Coach</span>
            <span className="text-[11px] text-slate-300 group-hover:text-white">
              {isAr ? "اسأل عن سيو يوتيوب" : "Ask about YouTube SEO"}
            </span>
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          dir={dir}
          className={
            fullscreen
              ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-950 shadow-2xl"
              : "fixed bottom-5 z-40 flex h-[560px] max-h-[calc(100vh-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-fuchsia-500/20 " +
                (isAr ? "left-5" : "right-5")
          }
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-fuchsia-500/20 to-amber-400/20 px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400">
                <Sparkles className="h-4 w-4 text-black" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">AI Coach {isAr ? "•" : "·"} TongueSync</div>
                <div className="text-[11px] text-emerald-300">
                  {meta
                    ? (isAr
                        ? `${meta.tier === "pro" ? "احترافي" : "مجاني"} · باقي ${meta.creditsLeft}/${meta.dailyLimit} كريدت اليوم`
                        : `${meta.tier === "pro" ? "Pro" : "Free"} · ${meta.creditsLeft}/${meta.dailyLimit} credits left today`)
                    : (isAr ? "متصل · سيو يوتيوب + الخوارزميات" : "Online · YouTube SEO + Algorithm")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {signedIn && (
                <>
                  <button
                    onClick={newConversation}
                    className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label={isAr ? "محادثة جديدة" : "New conversation"}
                    title={isAr ? "محادثة جديدة" : "New conversation"}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setHistoryOpen((v) => !v); if (!historyOpen) void refreshConversations(); }}
                    className={
                      "relative rounded p-1.5 hover:bg-white/10 " +
                      (historyOpen ? "text-fuchsia-300" : "text-slate-400 hover:text-white")
                    }
                    aria-label={isAr ? "سجل المحادثات" : "Conversation history"}
                    title={isAr ? "سجل المحادثات" : "Conversation history"}
                  >
                    <History className="h-4 w-4" />
                    {conversations.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold text-black">
                        {conversations.length > 99 ? "99+" : conversations.length}
                      </span>
                    )}
                  </button>
                </>
              )}
              <button
                onClick={reset}
                className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Reset conversation"
              >
                {isAr ? "مسح" : "Reset"}
              </button>
              <button
                onClick={() => setFullscreen((v) => !v)}
                className={
                  "flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-white/10 " +
                  (fullscreen ? "text-fuchsia-200" : "text-slate-400 hover:text-white")
                }
                aria-label={fullscreen ? (isAr ? "تصغير" : "Exit fullscreen") : (isAr ? "ملء الشاشة" : "Fullscreen")}
                title={fullscreen ? (isAr ? "تصغير" : "Exit fullscreen") : (isAr ? "ملء الشاشة" : "Fullscreen")}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {fullscreen && (
                  <span className="hidden sm:inline">{isAr ? "خروج" : "Exit"}</span>
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close support chat"
                className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* History panel (in-panel overlay) */}
          {historyOpen && (
            <div dir={dir} className="absolute inset-x-0 top-[60px] bottom-0 z-10 flex flex-col overflow-hidden border-t border-white/10 bg-slate-950/98 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="flex items-center gap-2 text-white">
                  <History className="h-4 w-4 text-fuchsia-300" />
                  <span className="text-sm font-semibold">
                    {isAr ? "خططك المحفوظة" : "Your saved plans"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({conversations.length})
                  </span>
                </div>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label="Close history"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {!signedIn ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs text-slate-300">
                    {isAr ? "سجّل الدخول عشان تحفظ خططك وترجع لها بعدين." : "Sign in to save your plans and resume them later."}
                    <div className="mt-3">
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        <Button size="sm" className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black">
                          {isAr ? "سجّل الدخول" : "Sign in"}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : loadingHistory ? (
                  <div className="flex items-center justify-center py-8 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-xs text-slate-400">
                    {isAr
                      ? "لسه مفيش خطط محفوظة. ابدأ محادثة مع المدرب وهنحفظها تلقائيًا."
                      : "No saved plans yet. Start chatting with the coach and we'll auto-save this thread."}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {conversations.map((c) => {
                      const active = c.id === currentConvId;
                      const date = new Date(c.updated_at).toLocaleDateString(isAr ? "ar-EG" : "en-US", { month: "short", day: "numeric" });
                      return (
                        <li
                          key={c.id}
                          className={
                            "group rounded-xl border p-3 transition " +
                            (active
                              ? "border-fuchsia-400/60 bg-fuchsia-500/10"
                              : "border-white/10 bg-white/5 hover:border-fuchsia-400/40 hover:bg-white/10")
                          }
                        >
                          <div className="flex items-start gap-2">
                            <button
                              onClick={() => void loadConversation(c.id)}
                              className="flex-1 min-w-0 text-start"
                            >
                              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fuchsia-300">
                                <MessageCircle className="h-3 w-3" />
                                <span className="truncate">{c.niche || (isAr ? "بدون نيتش" : "No niche")}</span>
                                <span className="text-slate-500">·</span>
                                <span className="text-slate-400">{date}</span>
                                <span className="text-slate-500">·</span>
                                <span className="text-slate-400">{c.message_count} {isAr ? "رسالة" : "msgs"}</span>
                              </div>
                              <div className="mt-1 text-[13px] font-medium text-white line-clamp-2">
                                {c.title}
                              </div>
                              {c.topics && (
                                <div className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">
                                  {c.topics}
                                </div>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(isAr ? "حذف الخطة؟" : "Delete this plan?")) void removeConversation(c.id);
                              }}
                              className="shrink-0 rounded p-1 text-slate-500 opacity-0 transition hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className={"flex-1 space-y-3 overflow-y-auto py-4 text-sm " + (fullscreen ? "px-4 md:px-8" : "px-4")}>
            <div className={fullscreen ? "mx-auto w-full max-w-3xl space-y-3" : "contents"}>
            {/* Channel-linking onboarding card */}
            {(needsChannelPrompt || showChannelForm) && (
              <div dir={dir} className="rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 via-slate-900 to-amber-400/10 p-3">
                {seededFromIdeas && showChannelForm && (
                  <div className="mb-2 flex items-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1.5 text-[11px] text-emerald-100">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="flex-1">
                      {isAr
                        ? "اخترنا النيتش من فكرة Viral Ideas اللي دُست عليها — راجعه أو عدّله ثم اضغط حفظ وتفعيل."
                        : "We pre-filled the niche from the Viral Idea you tapped — review or edit it, then hit Save & activate."}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white">
                    <Youtube className="h-4 w-4" />
                  </div>
                  <div className="text-[13px] font-semibold text-white">
                    {isAr ? "اربط قناتك يوتيوب" : "Connect your YouTube channel"}
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 mb-3">
                  {isAr
                    ? "لما تربط قناتك، المدرب يفهم النيتش بتاعك ويديك كلمات مفتاحية وأفكار وعناوين مخصوصة لقناتك بس. تقدر تتخطى الخطوة دي، بس النتايج بتبقى عامة."
                    : "Linking your channel lets the coach understand your niche and reply with keywords, titles and ideas tailored to YOUR channel only. You can skip, but replies will stay generic."}
                </p>
                {!showChannelForm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => { setChDraft(channel ?? {}); setShowChannelForm(true); }} className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold h-8">
                      <Youtube className="h-3.5 w-3.5 mr-1" /> {isAr ? "اربط قناتي" : "Connect my channel"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={skipChannel} className="h-8 text-slate-300 hover:text-white">
                      {isAr ? "تخطي الخطوة" : "Skip for now"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      dir={dir}
                      value={chDraft.channelUrl ?? ""}
                      onChange={(e) => setChDraft((d) => ({ ...d, channelUrl: e.target.value }))}
                      placeholder={isAr ? "رابط القناة (اختياري) — https://youtube.com/@…" : "Channel URL (optional) — https://youtube.com/@…"}
                      className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-[12px] text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
                    />
                    <input
                      dir={dir}
                      value={chDraft.niche ?? ""}
                      onChange={(e) => setChDraft((d) => ({ ...d, niche: e.target.value }))}
                      placeholder={isAr ? "النيتش (مثال: تكنولوجيا، طبخ، ألعاب، تسويق…)" : "Your niche (e.g. tech, cooking, gaming, marketing…)"}
                      className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-[12px] text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
                    />
                    <input
                      dir={dir}
                      value={chDraft.topics ?? ""}
                      onChange={(e) => setChDraft((d) => ({ ...d, topics: e.target.value }))}
                      placeholder={isAr ? "كلمات مفتاحية أساسية / مواضيع (فصل بينهم بفاصلة)" : "Seed keywords / main topics (comma separated)"}
                      className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-[12px] text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
                    />
                    <input
                      dir={dir}
                      value={chDraft.audience ?? ""}
                      onChange={(e) => setChDraft((d) => ({ ...d, audience: e.target.value }))}
                      placeholder={isAr ? "الجمهور المستهدف (اختياري)" : "Target audience (optional)"}
                      className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-[12px] text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        dir={dir}
                        value={chDraft.country ?? ""}
                        onChange={(e) => setChDraft((d) => ({ ...d, country: e.target.value }))}
                        placeholder={isAr ? "بلد القناة (مثال: مصر، USA)" : "Channel country (e.g. USA, Egypt)"}
                        className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-[12px] text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
                      />
                      <select
                        dir={dir}
                        value={chDraft.language ?? ""}
                        onChange={(e) => setChDraft((d) => ({ ...d, language: e.target.value || undefined }))}
                        className="rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-[12px] text-white focus:border-fuchsia-400 focus:outline-none"
                      >
                        <option value="">{isAr ? "لغة المحتوى (تلقائي)" : "Content language (auto)"}</option>
                        <option value="English">English</option>
                        <option value="Arabic">Arabic / العربية</option>
                        <option value="Spanish">Spanish / Español</option>
                        <option value="French">French / Français</option>
                        <option value="Portuguese">Portuguese / Português</option>
                        <option value="German">German / Deutsch</option>
                        <option value="Hindi">Hindi / हिन्दी</option>
                        <option value="Turkish">Turkish / Türkçe</option>
                        <option value="Indonesian">Indonesian</option>
                        <option value="Russian">Russian / Русский</option>
                        <option value="Japanese">Japanese / 日本語</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={saveChannel} className="h-8 bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
                        {isAr ? "حفظ وتفعيل" : "Save & activate"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowChannelForm(false)} className="h-8 text-slate-300 hover:text-white">
                        {isAr ? "إلغاء" : "Cancel"}
                      </Button>
                      {!needsChannelPrompt && (
                        <Button size="sm" variant="ghost" onClick={skipChannel} className="h-8 text-slate-400 hover:text-white">
                          {isAr ? "تخطي" : "Skip"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active niche chip */}
            {hasNiche && !showChannelForm && (
              <div dir={dir} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1.5 text-[11px] text-emerald-200">
                <div className="truncate">
                  <span className="font-semibold">{isAr ? "النيتش:" : "Niche:"}</span>{" "}
                  <span className="text-emerald-100">{channel?.niche || channel?.topics}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setChDraft(channel ?? {}); setShowChannelForm(true); }} className="rounded p-1 text-emerald-200 hover:bg-white/10" aria-label="Edit niche">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={clearChannel} className="rounded px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/10">
                    {isAr ? "مسح" : "Clear"}
                  </button>
                </div>
              </div>
            )}
            {channel?.skipped && !showChannelForm && (
              <div dir={dir} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300">
                <span>{isAr ? "لسة مربطتش قناتك — الردود عامة" : "Channel not linked — replies are generic"}</span>
                <button onClick={() => { setChDraft({}); setShowChannelForm(true); }} className="rounded px-1.5 py-0.5 text-[10px] text-fuchsia-300 hover:bg-white/10">
                  {isAr ? "اربط الآن" : "Connect now"}
                </button>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"} dir={dir}>
                <div
                  className={
                    m.role === "user"
                      ? "min-w-0 max-w-[80%] break-words rounded-2xl bg-gradient-to-br from-fuchsia-500 to-amber-400 px-3 py-2 text-black " + (isAr ? "rounded-tl-sm" : "rounded-tr-sm")
                      : "min-w-0 max-w-[85%] break-words rounded-2xl bg-white/5 px-3 py-2 text-slate-100 " + (isAr ? "rounded-tr-sm" : "rounded-tl-sm")
                  }
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none break-words prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-a:text-fuchsia-300 prose-pre:overflow-x-auto prose-code:break-words [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {pending && (
              <div className="flex justify-start" dir={dir}>
                <div className={"flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-slate-300 " + (isAr ? "rounded-tr-sm" : "rounded-tl-sm")}>
                  <span className="flex items-center gap-1" aria-hidden>
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300 animate-bounce" />
                  </span>
                  <span className="text-xs">{isAr ? "المدرب بيكتب…" : "AI Coach is typing…"}</span>
                </div>
              </div>
            )}

            {meta && meta.creditsLeft <= 0 ? (
              <div className="rounded-xl border border-amber-400/30 bg-gradient-to-r from-fuchsia-500/15 to-amber-400/15 p-3 text-xs" dir={dir}>
                <div className="font-semibold text-amber-200 mb-1">
                  {isAr ? "خلص الكريدت اليومي 🎯" : "You're out of daily credits 🎯"}
                </div>
                <div className="text-slate-300 mb-2">
                  {isAr
                    ? `الترقية للاحترافي بتديك 50 سؤال/يوم + 30 فيديو/شهر + كل ستايلات الكابشن.`
                    : `Upgrade to Pro for 50 questions/day + 30 videos/month + all caption styles.`}
                </div>
                <Link to="/pricing" onClick={() => setOpen(false)} className="inline-block">
                  <Button size="sm" className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
                    <Crown className="h-3.5 w-3.5 mr-1" /> {isAr ? "ترقية إلى Pro" : "Upgrade to Pro"}
                  </Button>
                </Link>
              </div>
            ) : null}
            </div>
          </div>

          {/* Composer */}
          <div className={"border-t border-white/10 bg-slate-900 p-3 " + (fullscreen ? "px-4 md:px-8" : "")}>
            <div className={"flex items-end gap-2 " + (fullscreen ? "mx-auto w-full max-w-3xl" : "")}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                dir={dir}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={isAr ? "اسأل عن أفكار فيروسية، عناوين، تاجات، هاشتاجات…" : "Ask for viral ideas, titles, tags, hashtags…"}
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none"
                disabled={pending}
              />
              <Button
                onClick={send}
                disabled={pending || !input.trim()}
                size="icon"
                className="h-10 w-10 shrink-0 bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black hover:opacity-90"
                aria-label="Send message"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className={"h-4 w-4 " + (isAr ? "scale-x-[-1]" : "")} />}
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500">
              {isAr ? "مدعوم بالذكاء الاصطناعي · قد يخطئ أحيانًا" : "Powered by AI · may occasionally be inaccurate"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}