import { Download, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function VideoResult({ videos, isPro }: { videos: any[]; isPro: boolean }) {
  const { t } = useI18n();
  if (!videos?.length) return null;
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-3">
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
            <a href={v.output_url} download>
              <Button size="sm" className="w-full"><Download className="h-4 w-4 mr-1" />{t("download")}</Button>
            </a>

            <div className="rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="flex items-center gap-1 font-semibold text-amber-300"><Sparkles className="h-3 w-3" />{t("social_kit")}</span>
                {!isPro && <span className="flex items-center gap-1 text-slate-400"><Lock className="h-3 w-3" />{t("premium_locked")}</span>}
              </div>
              {isPro && v.social_kit?.title ? (
                <div className="text-xs space-y-1">
                  <div className="text-white/90 font-medium">{v.social_kit.title}</div>
                  <div className="text-slate-400">{v.social_kit.description}</div>
                  <div className="text-fuchsia-300">{(v.social_kit.hashtags || []).join(" ")}</div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Upgrade to auto-generate viral title, description, and hashtags.</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
