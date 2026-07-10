import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Loader2, RefreshCcw, Scissors, Sparkles, Check, Play } from "lucide-react";
import { toast } from "sonner";
import { loadSession, saveSession } from "@/lib/videoCache";
import { generateClipCopy, type ClipCopy } from "@/lib/clip-copy-client";

const CACHE_KEY = "clipper";

export const Route = createFileRoute("/_authenticated/clipper/results")({
  head: () => ({
    meta: [
      { title: "Your AI Short Clips — TongueSync AI" },
      { name: "description", content: "Auto-generated vertical shorts with AI titles, descriptions and hashtags — powered by Gemini." },
    ],
  }),
  component: ClipperResults,
});

type Clip = any;

function copyFromClip(clip: Clip): ClipCopy | null {
  const kit = clip?.social_kit ?? {};
  const title = String(kit.title ?? "").trim();
  const description = String(kit.description ?? "").trim();
  const hashtags = Array.isArray(kit.hashtags) ? kit.hashtags.map((h: any) => String(h).trim()).filter(Boolean) : [];
  return title && description && hashtags.length ? { title, description, hashtags } : null;
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function ClipCard({ clip, index, topic, cachedCopy, onCopyReady }: {
  clip: Clip;
  index: number;
  topic: string;
  cachedCopy: ClipCopy | null;
  onCopyReady: (i: number, copy: ClipCopy) => void;
}) {
  const [copy, setCopy] = useState<ClipCopy | null>(cachedCopy ?? copyFromClip(clip));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [regenCount, setRegenCount] = useState(0);
  const [justRegenerated, setJustRegenerated] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  async function run(isRegen = false) {
    setLoading(true); setError(null);
    const nextVariation = isRegen ? regenCount + 1 : 0;
    if (isRegen) toast(`Regenerating Short ${index + 1}…`, { icon: "✨" });
    try {
      const c = await generateClipCopy(
        topic || clip.title || "Short clip",
        index,
        nextVariation,
      );
      setCopy(c);
      onCopyReady(index, c);
      if (isRegen) {
        setRegenCount(nextVariation);
        setJustRegenerated(true);
        toast.success(`Short ${index + 1} regenerated`);
        setTimeout(() => setJustRegenerated(false), 1400);
      }
    } catch (e: any) {
      setError(e?.message ?? "Gemini failed");
      if (isRegen) toast.error("Regeneration failed — try again");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!copy) { run(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefer real cut timestamps from the browser slicer; only fall back for old cached sessions.
  const stamp = useMemo(() => {
    const clipStart = Number(clip?.social_kit?.clip_start ?? clip?.clip_start);
    const clipEnd = Number(clip?.social_kit?.clip_end ?? clip?.clip_end);
    if (Number.isFinite(clipStart) && Number.isFinite(clipEnd) && clipEnd > clipStart) {
      return `${fmt(clipStart)} - ${fmt(clipEnd)}`;
    }
    const startBase = 30 + index * 87;
    const dur = 55 + (index * 13) % 40;
    return `${fmt(startBase)} - ${fmt(startBase + dur)}`;
  }, [clip, index]);

  async function copyAll() {
    if (!copy) return;
    const text = `${copy.title}\n\n${copy.description}\n\n${copy.hashtags.join(" ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      toast.success("Copied title, description and hashtags");
      setTimeout(() => setCopiedAll(false), 1600);
    } catch { toast.error("Couldn't copy"); }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  }

  return (
    <div className="group rounded-2xl border border-fuchsia-500/25 bg-gradient-to-b from-white/[0.04] to-black/40 overflow-hidden shadow-[0_0_0_1px_rgba(217,70,239,0.05),0_20px_60px_-30px_rgba(217,70,239,0.35)]">
      {/* Header strip */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-black/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-fuchsia-500 to-amber-400 text-[10px] font-bold text-black shrink-0">
            {index + 1}
          </span>
          <span className="truncate text-sm font-medium text-white/90">
            {copy?.title ?? clip.title ?? `Short ${index + 1}`}
          </span>
          {regenCount > 0 && (
            <span
              className="ml-1 shrink-0 rounded-full bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/25 text-[10px] px-1.5 py-0 font-mono"
              title={`Regenerated ${regenCount} time${regenCount === 1 ? "" : "s"}`}
            >
              v{regenCount + 1}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={loading}
          aria-label="Regenerate AI copy for this short"
          title="Regenerate title, description & hashtags for this short only"
          className={
            "group/regen inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition " +
            (loading
              ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 cursor-wait"
              : "border-fuchsia-500/25 bg-fuchsia-500/5 text-fuchsia-200 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/15 hover:text-white active:scale-95")
          }
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Rewriting…</span>
            </>
          ) : justRegenerated ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-300" />
              <span>Fresh</span>
            </>
          ) : (
            <>
              <RefreshCcw className="h-3.5 w-3.5 transition-transform group-hover/regen:-rotate-90" />
              <span>Regenerate</span>
            </>
          )}
        </button>
      </div>

      {/* Video */}
      <div className="relative bg-black aspect-[9/16] flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={clip.output_url}
          className="w-full h-full object-cover"
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          playsInline
          preload="metadata"
        />
        {/* Timestamp badge */}
        <div className="absolute top-2 right-2 rounded-md bg-black/70 backdrop-blur px-2 py-1 text-[11px] font-mono tabular-nums text-white/90 border border-white/10">
          {stamp}
        </div>
        {(copy?.title || clip?.social_kit?.caption_text) && (
          <div className="pointer-events-none absolute inset-x-3 bottom-4 flex justify-center">
            <div className="max-w-[92%] rounded-lg border border-white/15 bg-black/75 px-3 py-2 text-center shadow-2xl backdrop-blur-sm">
              <div className="text-sm font-extrabold uppercase leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {copy?.title ?? clip.social_kit.caption_text}
              </div>
            </div>
          </div>
        )}
        {/* Play overlay */}
        {!playing && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition"
            aria-label="Play"
          >
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/85 text-black shadow-lg group-hover:scale-105 transition-transform">
              <Play className="h-7 w-7 ml-1" fill="currentColor" />
            </span>
          </button>
        )}
      </div>

      {/* Copy area */}
      <div className="p-4 space-y-2.5 relative">
        {/* When regenerating over an existing copy, keep the old text visible
            with a shimmering fuchsia overlay so the card never blanks out. */}
        {loading && copy && (
          <div className="absolute inset-0 z-10 rounded-b-2xl backdrop-blur-[2px] bg-slate-950/40 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-black/70 px-3 py-1.5 text-xs text-fuchsia-100 shadow-[0_0_20px_rgba(217,70,239,0.35)]">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              Gemini is rewriting this short…
            </div>
            <div className="h-0.5 w-3/4 overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-1/3 bg-gradient-to-r from-fuchsia-500 to-amber-400 animate-[shimmer_1.4s_ease-in-out_infinite]" />
            </div>
          </div>
        )}
        {loading && !copy ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 w-3/4 bg-white/10 rounded" />
            <div className="h-3 w-full bg-white/5 rounded" />
            <div className="h-3 w-5/6 bg-white/5 rounded" />
            <div className="h-3 w-2/3 bg-fuchsia-500/20 rounded" />
            <div className="flex items-center gap-1.5 text-[11px] text-fuchsia-300/80 pt-1">
              <Sparkles className="h-3 w-3" /> Gemini is writing the copy…
            </div>
          </div>
        ) : copy ? (
          <>
            <h3 className="text-base font-semibold text-white leading-snug">{copy.title}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{copy.description}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {copy.hashtags.map((h) => (
                <span key={h} className="text-[11px] px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-200 border border-fuchsia-500/20">
                  {h}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={copyAll}
                className="border-white/15 bg-white/5 hover:bg-white/10 text-white flex-1"
              >
                {copiedAll ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copiedAll ? "Copied" : "Copy caption"}
              </Button>
              <a href={clip.output_url} download={`short-${index + 1}.mp4`}>
                <Button size="sm" className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
                  Download
                </Button>
              </a>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {error && <p className="text-xs text-amber-300">{error}</p>}
            <Button
              size="sm"
              onClick={() => run(false)}
              className="w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold"
            >
              <Sparkles className="h-4 w-4 mr-1" /> Generate AI title & description
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ClipperResults() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [videos, setVideos] = useState<Clip[]>([]);
  const [topic, setTopic] = useState("");
  const [copies, setCopies] = useState<Record<number, ClipCopy>>({});

  useEffect(() => {
    const createdUrls: string[] = [];
    let active = true;
    loadSession(CACHE_KEY).then((s) => {
      const raw = Array.isArray(s?.results) ? (s!.results as Clip[]) : [];
      const v = raw
        .map((clip) => {
          if (clip?.clip_blob instanceof Blob) {
            const url = URL.createObjectURL(clip.clip_blob);
            createdUrls.push(url);
            return { ...clip, output_url: url, is_real_clip: true };
          }
          return clip;
        })
        .filter((clip) => clip?.is_real_clip === true && typeof clip?.output_url === "string" && clip.output_url.startsWith("blob:"));
      if (!active) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      if (v.length !== 3) {
        toast.error("No real local clips found — upload the original video again.");
        navigate({ to: "/clipper" });
        return;
      }
      setVideos(v);
      setTopic(String(s?.form?.title ?? ""));
      const cached = (s?.form as any)?.__aiCopies;
      if (cached && typeof cached === "object") setCopies(cached);
      setReady(true);
    });
    return () => {
      active = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [navigate]);

  function onCopyReady(i: number, c: ClipCopy) {
    setCopies((prev) => {
      const next = { ...prev, [i]: c };
      // Persist so returning to the page doesn't re-hit Gemini.
      loadSession(CACHE_KEY).then((s) => {
        if (!s) return;
        saveSession({ ...s, form: { ...s.form, __aiCopies: next } });
      });
      return next;
    });
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 border-b border-white/5">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link to="/clipper">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />New video
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Your AI Short Clips</h1>
            <p className="text-slate-400 text-sm">
              {topic ? <>From: <span className="text-white/80">"{topic}"</span> — </> : null}
              Gemini analyzed each moment and wrote a bespoke title, description and hashtags.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v, i) => (
            <ClipCard
              key={v.id ?? i}
              clip={v}
              index={i}
              topic={topic}
              cachedCopy={copies[i] ?? null}
              onCopyReady={onCopyReady}
            />
          ))}
        </div>
      </main>
    </div>
  );
}