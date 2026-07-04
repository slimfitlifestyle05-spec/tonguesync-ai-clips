import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supportChat } from "@/lib/support-chat.functions";
import { MessageCircle, X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "tonguesync_support_chat_v1";
const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hey — I'm **TongueSync AI Coach**, your YouTube Growth & SEO strategist (vidIQ-style, powered by Gemini).\n\nAsk me for a **niche keyword table**, **viral title formulas**, **YouTube algorithm tips**, or **Shorts retention tricks** — I'll give you data-backed answers with search volume, competition, and CTR strategy.\n\n> Free plan: **10 credits/day** &middot; Pro: **50 credits/day** &middot; 1 credit per question.",
};

type CoachMeta = { creditsLeft: number; dailyLimit: number; tier: "free" | "pro" } | null;

export function SupportChat() {
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
          aria-label="Open support chat"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black shadow-2xl shadow-fuchsia-500/40 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-fuchsia-300 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[560px] max-h-[calc(100vh-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl shadow-fuchsia-500/20">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-fuchsia-500/20 to-amber-400/20 px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400">
                <Sparkles className="h-4 w-4 text-black" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">AI Coach &middot; TongueSync</div>
                <div className="text-[11px] text-emerald-300">
                  {meta
                    ? `${meta.tier === "pro" ? "Pro" : "Free"} · ${meta.creditsLeft}/${meta.dailyLimit} credits left today`
                    : "Online · YouTube SEO + Algorithm"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={reset}
                className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Reset conversation"
              >
                Reset
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
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-fuchsia-500 to-amber-400 px-3 py-2 text-black"
                      : "max-w-[85%] rounded-2xl rounded-tl-sm bg-white/5 px-3 py-2 text-slate-100"
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
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-white/5 px-3 py-2 text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">AI Coach is typing…</span>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 bg-slate-900 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Ask for viral ideas, titles, tags, hashtags…"
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
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500">
              Powered by AI &middot; may occasionally be inaccurate
            </p>
          </div>
        </div>
      )}
    </>
  );
}