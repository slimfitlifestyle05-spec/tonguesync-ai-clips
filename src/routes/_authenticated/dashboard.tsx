import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, listMyVideos, LIMITS } from "@/lib/video.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Crown, Video, ChevronRight, Volume2, Scissors as ScissorsIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard \u2014 TongueSync AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const listVideos = useServerFn(listMyVideos);
  const { data: profileData } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  const { data: videos } = useQuery({ queryKey: ["my-videos"], queryFn: () => listVideos() });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);

  const profile = profileData?.profile;
  const tier = profile?.tier ?? "free";
  const isPro = tier === "pro";
  const usedTotal = isPro ? profile?.monthly_used ?? 0 : (profile?.clips_used ?? 0) + (profile?.dubs_used ?? 0);
  const cap = isPro ? LIMITS.PRO_MONTHLY : LIMITS.FREE_CLIPS + LIMITS.FREE_DUBS;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 border-b border-white/5">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          {!isPro && (
            <Button onClick={() => setUpgradeOpen(true)} className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
              <Crown className="h-4 w-4 mr-1" /> {t("upgrade")}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" />{t("sign_out")}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-slate-400 text-sm">{tier === "pro" ? "Pro plan" : "Free plan"}</div>
              <div className="text-2xl font-semibold">{profile?.email}</div>
            </div>
            <div className="min-w-[220px] flex-1 max-w-xs">
              <div className="flex justify-between text-xs mb-1"><span>{t("quota_used")}</span><span>{usedTotal}/{cap}</span></div>
              <Progress value={(usedTotal / cap) * 100} />
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FeatureCard
            to="/clipper"
            title="AI Video Clipper"
            desc="Automatically split long videos into highly engaging vertical shorts with animated captions."
            visual={<ClipperVisual />}
          />
          <FeatureCard
            to="/dubbing"
            title="Cultural AI Dubbing"
            desc="Translate, rewrite, and re-voice your video into localized regional dialects and accents instantly."
            visual={<DubbingVisual />}
          />
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Video className="h-5 w-5" />Recent generations</h2>
          {(!videos || videos.length === 0) ? (
            <div className="text-slate-400 text-sm">No videos yet. Start with the Clipper or Dubbing card above.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {videos.slice(0, 6).map((v: any) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setSelectedVideo(v)}
                  className="group text-left rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-fuchsia-400/40 transition"
                >
                  <div className="relative">
                    <video src={v.output_url} className="w-full aspect-[9/16] object-cover bg-black pointer-events-none" />
                    <div className="absolute inset-0 flex items-end justify-start bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 backdrop-blur px-2.5 py-1 text-xs text-white">
                        Open <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm truncate">{v.title}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {v.kind} \u00b7 {v.style}
                      {v.watermarked && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Watermark</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      <Dialog open={!!selectedVideo} onOpenChange={(o) => !o && setSelectedVideo(null)}>
        <DialogContent className="max-w-md bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          {selectedVideo && <VideoResult videos={[selectedVideo]} isPro={isPro} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureCard({
  to,
  title,
  desc,
  visual,
}: {
  to: string;
  title: string;
  desc: string;
  visual: React.ReactNode;
}) {
  return (
    <Link
      to={to as any}
      className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.015] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_60px_-30px_rgba(0,0,0,0.8)] transition hover:border-fuchsia-400/40 hover:from-white/[0.06]"
    >
      {/* Visual section */}
      <div className="relative h-52 overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-950/80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(217,70,239,0.12),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(251,191,36,0.10),transparent_55%)]" />
        <div className="relative h-full w-full">{visual}</div>
      </div>
      {/* Text section */}
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-slate-400 line-clamp-2">{desc}</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-fuchsia-200 transition group-hover:border-fuchsia-400/50 group-hover:bg-fuchsia-500/10 group-hover:text-white">
          Try Now
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function ClipperVisual() {
  return (
    <div className="flex h-full w-full items-center justify-between gap-4 px-6 py-5">
      {/* Long horizontal video → 3 vertical clips */}
      <div className="flex flex-1 items-center gap-3">
        {/* Source horizontal video */}
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-slate-700 to-slate-900 ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.15),transparent_40%)]" />
          <div className="absolute inset-x-2 bottom-2 h-1 rounded-full bg-white/20">
            <div className="h-full w-2/3 rounded-full bg-fuchsia-400/80" />
          </div>
          <ScissorsIcon className="absolute right-1.5 top-1.5 h-3 w-3 text-white/70" />
        </div>
        {/* Arrow */}
        <svg width="26" height="20" viewBox="0 0 26 20" fill="none" className="shrink-0 text-fuchsia-300/80">
          <path d="M2 10 C 8 2, 18 2, 24 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M20 6 L24 10 L20 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        {/* 3 vertical 9:16 clips fanned */}
        <div className="relative flex h-28 flex-1 items-center justify-center">
          {[0, 1, 2].map((i) => {
            const rot = [-10, 0, 10][i];
            const tx = [-22, 0, 22][i];
            const grads = [
              "from-amber-300/40 to-fuchsia-500/40",
              "from-fuchsia-400/50 to-indigo-500/40",
              "from-emerald-300/40 to-cyan-500/40",
            ][i];
            return (
              <div
                key={i}
                className={`absolute h-24 w-[52px] rounded-md ring-1 ring-white/15 shadow-lg bg-gradient-to-br ${grads}`}
                style={{ transform: `translateX(${tx}px) rotate(${rot}deg)` }}
              >
                <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-white/40" />
                <div className="absolute inset-x-1 top-1 h-1 rounded-full bg-white/20" />
              </div>
            );
          })}
        </div>
      </div>
      {/* Selector */}
      <div className="hidden shrink-0 rounded-lg border border-white/10 bg-slate-950/70 p-2.5 backdrop-blur sm:block">
        <div className="text-[10px] text-slate-400">How many viral clips?</div>
        <div className="mt-1.5 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={
                "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium " +
                (n === 3
                  ? "bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black"
                  : "border border-white/10 bg-white/5 text-slate-300")
              }
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DubbingVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-4 px-6 py-5">
      {/* Character crop */}
      <div className="relative h-28 w-[86px] shrink-0 overflow-hidden rounded-md ring-1 ring-white/15 bg-gradient-to-br from-slate-600 to-slate-900">
        <div className="absolute inset-x-3 top-3 h-6 w-6 rounded-full bg-amber-200/70" />
        <div className="absolute inset-x-2 bottom-2 h-8 rounded bg-white/15" />
        <div className="absolute inset-1 rounded border border-dashed border-fuchsia-300/70" />
      </div>
      {/* Global flag → soundwave → local flag */}
      <div className="flex flex-1 items-center gap-2">
        <FlagBadge kind="global" />
        <Soundwave />
        <FlagBadge kind="local" />
      </div>
      <Volume2 className="h-4 w-4 shrink-0 text-fuchsia-300/80" />
    </div>
  );
}

function FlagBadge({ kind }: { kind: "global" | "local" }) {
  if (kind === "global") {
    return (
      <div className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/70 to-cyan-400/70 ring-1 ring-white/20">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white/95">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
    );
  }
  return (
    <div className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-amber-400/80 ring-1 ring-white/20">
      <span className="text-[10px] font-bold text-black">SA</span>
      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
    </div>
  );
}

function Soundwave() {
  const bars = [4, 8, 14, 10, 18, 22, 16, 10, 14, 8, 4];
  return (
    <div className="flex flex-1 items-center justify-center gap-[3px]">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-b from-fuchsia-400 to-amber-300"
          style={{ height: `${h}px`, opacity: 0.5 + (h / 22) * 0.5 }}
        />
      ))}
    </div>
  );
}
