import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Sparkles, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function MagicPreviewModal({
  open,
  onOpenChange,
  video,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  video: any | null;
}) {
  const { t } = useI18n();
  const [isLocalized, setIsLocalized] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const originalUrl = video?.source_url || video?.output_url || "";
  const dubbedUrl = video?.output_url || originalUrl;
  const activeUrl = isLocalized ? dubbedUrl : originalUrl;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const currentTime = el.currentTime;
    const wasPlaying = !el.paused;
    el.load();
    const onLoaded = () => {
      try { el.currentTime = currentTime; } catch {}
      if (wasPlaying) el.play().catch(() => {});
      el.removeEventListener("loadedmetadata", onLoaded);
    };
    el.addEventListener("loadedmetadata", onLoaded);
  }, [activeUrl]);

  if (!video) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white p-0 overflow-hidden">
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
            <Sparkles className="h-3 w-3" /> Action Preview
          </div>
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight">
            {t("ba_h2_a")}{" "}
            <span className="bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
              {t("ba_h2_b")}
            </span>
          </h1>
          <p className="mt-3 text-slate-400 text-sm max-w-xl mx-auto">{t("ba_sub")}</p>
          {video?.title && (
            <div className="mt-3 text-xs text-slate-300">
              <span className="text-slate-500">Now playing:</span>{" "}
              <span className="font-medium">{video.title}</span>
            </div>
          )}
        </div>

        <div className="px-4 md:px-8 pb-8">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 md:p-5 shadow-2xl">
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-white/5">
              {activeUrl ? (
                <video
                  ref={videoRef}
                  key={activeUrl}
                  src={activeUrl}
                  controls
                  autoPlay
                  className="h-full w-full object-contain bg-black"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                  No video source available.
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/80 p-1 backdrop-blur">
                <button
                  onClick={() => setIsLocalized(false)}
                  disabled={!originalUrl}
                  className={`px-5 py-2 text-sm font-medium rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed ${!isLocalized ? "bg-white text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"}`}
                >
                  {t("toggle_original")}
                </button>
                <button
                  onClick={() => setIsLocalized(true)}
                  disabled={!dubbedUrl}
                  className={`px-5 py-2 text-sm font-medium rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isLocalized ? "bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black shadow-lg" : "text-slate-400 hover:text-white"}`}
                >
                  {t("toggle_localized")}
                </button>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5" />
                {isLocalized ? t("ba_lang_local") : t("ba_lang_orig")}
              </div>
              {activeUrl && (
                <a href={activeUrl} download className="mt-1">
                  <Button size="sm" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                    <Download className="h-4 w-4 mr-1.5" /> {t("download")}
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}