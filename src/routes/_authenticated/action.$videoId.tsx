import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getVideoById } from "@/lib/video.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Volume2, Loader2, Download, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/action/$videoId")({
  head: () => ({ meta: [{ title: "Magic in Action \u2014 TongueSync AI" }] }),
  component: ActionPreview,
});

function ActionPreview() {
  const { t } = useI18n();
  const { videoId } = useParams({ from: "/_authenticated/action/$videoId" });
  const fetchVideo = useServerFn(getVideoById);
  const { data: video, isLoading } = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => fetchVideo({ data: { id: videoId } }),
  });

  const [isLocalized, setIsLocalized] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const originalUrl = video?.source_url || video?.output_url || "";
  const dubbedUrl = video?.output_url || originalUrl;
  const activeUrl = isLocalized ? dubbedUrl : originalUrl;

  // Preserve playback position across source swap
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden sm:inline text-sm text-slate-400">/ Magic Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link to="/dashboard">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-1.5 rtl:rotate-180" /> {t("back")}
            </Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="text-center mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
            <Sparkles className="h-3 w-3" /> Action Preview
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            {t("ba_h2_a")}{" "}
            <span className="bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
              {t("ba_h2_b")}
            </span>
          </h1>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">{t("ba_sub")}</p>
          {video?.title && (
            <div className="mt-4 text-sm text-slate-300">
              <span className="text-slate-500">Now playing:</span> <span className="font-medium">{video.title}</span>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-4 md:p-8 shadow-2xl">
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/5">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading your video…
              </div>
            )}
            {!isLoading && activeUrl && (
              <video
                ref={videoRef}
                key={activeUrl}
                src={activeUrl}
                controls
                autoPlay
                className="h-full w-full object-contain bg-black"
              />
            )}
            {!isLoading && !activeUrl && (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                No video source available.
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
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
              <a href={activeUrl} download className="mt-2">
                <Button size="sm" variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">
                  <Download className="h-4 w-4 mr-1.5" /> {t("download")}
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}