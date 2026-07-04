import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supportChat } from "@/lib/support-chat.functions";
import { X, Send, Sparkles, Loader2, Bot } from "lucide-react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18n } from "@/lib/i18n";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "tonguesync_support_chat_v1";
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
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [meta, setMeta] = useState<CoachMeta>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const askAi = useServerFn(supportChat);

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
    setHydrated(true);
  }, []);

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

  // Allow external triggers (e.g. top nav) to open the coach
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setOpen(true);
    window.addEventListener("tonguesync:open-ai-coach", handler);
    return () => window.removeEventListener("tonguesync:open-ai-coach", handler);
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setPending(true);
    try {
      const res = await askAi({ data: { messages: next } });
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
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

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
            "fixed bottom-5 z-40 flex h-[560px] max-h-[calc(100vh-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-fuchsia-500/20 " +
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
              <button
                onClick={reset}
                className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Reset conversation"
              >
                {isAr ? "مسح" : "Reset"}
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

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"} dir={dir}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl bg-gradient-to-br from-fuchsia-500 to-amber-400 px-3 py-2 text-black " + (isAr ? "rounded-tl-sm" : "rounded-tr-sm")
                      : "max-w-[85%] rounded-2xl bg-white/5 px-3 py-2 text-slate-100 " + (isAr ? "rounded-tr-sm" : "rounded-tl-sm")
                  }
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-a:text-fuchsia-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
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

          {/* Composer */}
          <div className="border-t border-white/10 bg-slate-900 p-3">
            <div className="flex items-end gap-2">
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