import { useEffect, useRef, useState } from "react";
import { Download, Lock, Sparkles, Loader2, Wand2, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { MagicPreviewModal } from "@/components/MagicPreviewModal";
import { DownloadDubbedButton } from "@/components/DownloadDubbedButton";

const KIT_STAGES = [
  { label: "Reading transcript…", boundary: 30 },
  { label: "Analyzing topic with Gemini…", boundary: 70 },
  { label: "Writing viral copy…", boundary: 100 },
];

function SocialKitPanel({ kit, isPro }: { kit: any; isPro: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "loading" | "ready">("ready" in (kit || {}) ? "idle" : "idle");
  const [pct, setPct] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const announced = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (state !== "loading") return;
    const start = performance.now();
    const duration = 2600;
    const cap = 97;
    const id = setInterval(() => {
      const elapsed = performance.now() - start;
      const p = Math.min(cap, (elapsed / duration) * cap);
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
      if (elapsed >= duration) {
        clearInterval(id);
        setPct(100);
        setState("ready");
        toast.success("AI Social Kit ready");
      }
    }, 80);
    return () => clearInterval(id);
  }, [state]);

  function start() {
    if (!isPro) return;
    announced.current = new Set();
    setPct(0);
    setStageIdx(0);
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
          <div className="text-white/90 font-medium">{kit?.title}</div>
          <div className="text-slate-400">{kit?.description}</div>
          <div className="text-fuchsia-300">{(kit?.hashtags || []).join(" ")}</div>
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
        <div key={v.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="relative">
            <video src={v.output_url} controls className="w-full aspect-[9/16] object-cover bg-black" />
            {v.watermarked && (
              <div className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-xs text-white/80 backdrop-blur">TongueSync AI</div>
            )}
          </div>
          <div className="p-3 space-y-3">
            <div className="font-medium text-sm truncate">{v.title}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => setMagicVideo(v)}
                className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90"
              >
                <Play className="h-4 w-4 mr-1" /> View Magic
              </Button>
              <a href={v.output_url} download>
                <Button size="sm" variant="outline" className="w-full bg-white/5 border-white/10 hover:bg-white/10">
                  <Download className="h-4 w-4 mr-1" />{t("download")}
                </Button>
              </a>
            </div>
            <SocialKitPanel kit={v.social_kit} isPro={isPro} />
            {v.social_kit?.dubbed_audio_url ? (
              <DownloadDubbedButton
                videoUrl={v.source_url || v.output_url}
                audioUrl={v.social_kit.dubbed_audio_url}
                segments={v.social_kit.dubbed_segments ?? null}
                filename={`${(v.title || "dubbed").replace(/[^\w-]+/g, "_")}.mp4`}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
    <MagicPreviewModal open={!!magicVideo} onOpenChange={(o) => !o && setMagicVideo(null)} video={magicVideo} />
    </>
  );
}
