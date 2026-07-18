import { useEffect, useRef, useState } from "react";
import { Download, Lock, Sparkles, Loader2, Wand2, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { MagicPreviewModal } from "@/components/MagicPreviewModal";
import { DownloadDubbedButton } from "@/components/DownloadDubbedButton";
import { generateClipCopy, type ClipCopy } from "@/lib/clip-copy-client";

const KIT_STAGES = [
  { label: "Reading transcript…", boundary: 30 },
  { label: "Analyzing topic with Gemini…", boundary: 70 },
  { label: "Writing viral copy…", boundary: 100 },
];

function extractTranscript(v: any): string {
  const kit = v?.social_kit || {};
  const segs: any[] = Array.isArray(kit.dubbed_segments) ? kit.dubbed_segments : [];
  const fromSegs = segs
    .map((s) => String(s?.original_text || s?.localized_text || s?.text || "").trim())
    .filter(Boolean)
    .join(" ");
  if (fromSegs.length > 40) return fromSegs;
  const flat = String(kit.localized_text || kit.transcript || "").trim();
  if (flat.length > 40) return flat;
  return String(v?.title || "").trim();
}

function SocialKitPanel({ video, kit, isPro }: { video: any; kit: any; isPro: boolean }) {
  const { t } = useI18n();
  const hasExisting = !!(kit?.title && kit?.description);
  const [state, setState] = useState<"idle" | "loading" | "ready">(hasExisting ? "ready" : "idle");
  const [pct, setPct] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [copy, setCopy] = useState<ClipCopy | null>(
    hasExisting ? { title: kit.title, description: kit.description, hashtags: kit.hashtags || [] } : null,
  );
  const [variation, setVariation] = useState(0);
  const announced = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (state !== "loading") return;
    let cancelled = false;
    const start = performance.now();
    const cap = 97;
    const id = setInterval(() => {
      const elapsed = performance.now() - start;
      const p = Math.min(cap, (elapsed / 4000) * cap);
      setPct(p);
      let idx = 0;
      for (let i = 0; i < KIT_STAGES.length; i++) {
        if (p <= KIT_STAGES[i].boundary) { idx = i; break; }
        idx = i;
      }
      setStageIdx(idx);
      if (!announced.current.has(idx)) {
        announced.current.add(idx);
        toast(KIT_STAGES[idx].label, { icon: <Sparkles className="h-4 w-4 text-fuchsia-400" /> });
      }
    }, 80);

    (async () => {
      try {
        const transcript = extractTranscript(video);
        if (!transcript) throw new Error("No transcript found on this video yet. Run dubbing first.");
        const out = await generateClipCopy(transcript, 0, variation);
        if (cancelled) return;
        setCopy(out);
        setPct(100);
        setState("ready");
        toast.success("AI Social Kit ready");
      } catch (e: any) {
        if (cancelled) return;
        setState("idle");
        setPct(0);
        toast.error(e?.message || "Failed to generate copy");
      } finally {
        clearInterval(id);
      }
    })();

    return () => { cancelled = true; clearInterval(id); };
  }, [state]);

  function start() {
    if (!isPro) return;
    announced.current = new Set();
    setPct(0);
    setStageIdx(0);
    setVariation((n) => n + 1);
    setState("loading");
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="flex items-center gap-1 font-semibold text-amber-300"><Sparkles className="h-3 w-3" />{t("social_kit")}</span>
        {!isPro && <span className="flex items-center gap-1 text-slate-400"><Lock className="h-3 w-3" />{t("premium_locked")}</span>}
      </div>

      {!isPro ? (
        <div className="text-xs text-slate-500">Upgrade to auto-generate viral title, description, and hashtags.</div>
      ) : state === "idle" ? (
        <Button
          type="button"
          size="sm"
          onClick={start}
          className="w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90"
        >
          <Wand2 className="h-4 w-4 mr-1.5" />
          Generate AI Titles & Description
        </Button>
      ) : state === "loading" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-fuchsia-200">
              <Loader2 className="h-3 w-3 animate-spin" />
              {KIT_STAGES[stageIdx].label}
            </span>
            <span className="font-mono tabular-nums text-amber-300 font-semibold">{Math.round(pct)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500">Generating: {Math.round(pct)}%…</div>
        </div>
      ) : (
        <div className="text-xs space-y-1.5 animate-fade-in">
          <div className="flex items-center gap-1 text-emerald-300 text-[10px] uppercase tracking-wide">
            <Check className="h-3 w-3" /> AI generated
          </div>
          <div className="text-white/90 font-medium">{copy?.title || kit?.title}</div>
          <div className="text-slate-400">{copy?.description || kit?.description}</div>
          <div className="text-fuchsia-300">{(copy?.hashtags || kit?.hashtags || []).join(" ")}</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={start}
            className="mt-2 h-7 border-white/15 bg-white/5 hover:bg-white/10 text-[11px]"
          >
            <Wand2 className="h-3 w-3 mr-1" /> Regenerate
          </Button>
        </div>
      )}
    </div>
  );
}

export function VideoResult({ videos, isPro, embedded = false }: { videos: any[]; isPro: boolean; embedded?: boolean }) {
  const { t } = useI18n();
  const [magicVideo, setMagicVideo] = useState<any | null>(null);
  if (!videos?.length) return null;
  const cols = embedded
    ? "grid-cols-1"
    : videos.length === 1
    ? "md:grid-cols-1 max-w-sm mx-auto"
    : videos.length === 2
    ? "md:grid-cols-2"
    : "md:grid-cols-3";
  const wrapCls = embedded ? `grid gap-4 ${cols}` : `mt-8 grid gap-4 ${cols}`;
  return (
    <>
    <div className={wrapCls}>
      {videos.map((v) => (
        <VideoCard
          key={v.id}
          video={v}
          isPro={isPro}
          onOpenMagic={() => setMagicVideo(v)}
        />
      ))}
    </div>
    <MagicPreviewModal open={!!magicVideo} onOpenChange={(o) => !o && setMagicVideo(null)} video={magicVideo} />
    </>
  );
}

function VideoCard({ video: v, isPro, onOpenMagic }: { video: any; isPro: boolean; onOpenMagic: () => void }) {
  const { t } = useI18n();
  const [dubbedUrl, setDubbedUrl] = useState<string | null>(null);
  const hasDub = !!v.social_kit?.dubbed_audio_url;
  // Once the browser has muxed the dubbed track, show it as the main preview
  // and route the top Download button to it — so the primary video the user
  // sees and downloads is the dubbed one, not the original source.
  const displayUrl = dubbedUrl || v.output_url;
  const captionText = v.social_kit?.caption_text || v.social_kit?.title || v.social_kit?.localized_text || v.title;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="relative">
        <video src={displayUrl} controls className="w-full aspect-[9/16] object-cover bg-black" />
        {captionText && (
          <div className="pointer-events-none absolute inset-x-3 bottom-4 flex justify-center">
            <div className="max-w-[92%] rounded-lg border border-white/15 bg-black/75 px-3 py-2 text-center shadow-2xl backdrop-blur-sm">
              <div className="text-sm font-extrabold uppercase leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {captionText}
              </div>
            </div>
          </div>
        )}
        {v.watermarked && (
          <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-xs text-white/80 backdrop-blur">TongueSync AI</div>
        )}
        {hasDub && dubbedUrl && (
          <div className="absolute top-2 left-2 rounded bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold text-black">DUBBED</div>
        )}
      </div>
      <div className="p-3 space-y-3">
        <div className="font-medium text-sm truncate">{v.title}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onOpenMagic}
            className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90"
          >
            <Play className="h-4 w-4 mr-1" /> View Magic
          </Button>
          <a
            href={displayUrl}
            download={dubbedUrl ? `${(v.title || "dubbed").replace(/[^\w-]+/g, "_")}.mp4` : undefined}
          >
            <Button size="sm" variant="outline" className="w-full bg-white/5 border-white/10 hover:bg-white/10">
              <Download className="h-4 w-4 mr-1" />{t("download")}
            </Button>
          </a>
        </div>
        <SocialKitPanel video={v} kit={v.social_kit} isPro={isPro} />
        {hasDub ? (
          <DownloadDubbedButton
            videoUrl={v.source_url || v.output_url}
            audioUrl={v.social_kit.dubbed_audio_url}
            segments={v.social_kit.dubbed_segments ?? null}
            clipStart={typeof v.clip_start === "number" ? v.clip_start : null}
            clipEnd={typeof v.clip_end === "number" ? v.clip_end : null}
            filename={`${(v.title || "dubbed").replace(/[^\w-]+/g, "_")}.mp4`}
            captionStyle={v.social_kit.caption_style ?? "none"}
            captionEmojis={!!v.social_kit.caption_emojis}
            onRendered={(url) => setDubbedUrl(url)}
          />
        ) : null}
      </div>
    </div>
  );
}
