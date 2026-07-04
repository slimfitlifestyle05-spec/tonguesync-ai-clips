import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, listMyVideos, LIMITS } from "@/lib/video.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, Crown, Video, ChevronRight, Languages, Search } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FeatureCard, ClipperVisual, DubbingVisual } from "@/components/FeatureShowcase";
import { OnboardingTour } from "@/components/OnboardingTour";
import { CommunityIdeasManager } from "@/components/CommunityIdeasManager";
import { ShowcaseVideosAdmin } from "@/components/ShowcaseVideosAdmin";

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
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "clip" | "dub">("all");
  const [langFilter, setLangFilter] = useState<string>("all");

  const profile = profileData?.profile;
  const tier = profile?.tier ?? "free";
  const isPro = tier === "pro";
  const usedTotal = isPro ? profile?.monthly_used ?? 0 : (profile?.clips_used ?? 0) + (profile?.dubs_used ?? 0);
  const cap = isPro ? LIMITS.PRO_MONTHLY : LIMITS.FREE_CLIPS + LIMITS.FREE_DUBS;

  const languageOptions = useMemo(() => {
    const set = new Set<string>();
    (videos ?? []).forEach((v: any) => {
      const l = v.target_language || v.language;
      if (l) set.add(l);
    });
    return Array.from(set).sort();
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (videos ?? []).filter((v: any) => {
      if (kindFilter !== "all" && v.kind !== kindFilter) return false;
      if (langFilter !== "all") {
        const l = v.target_language || v.language;
        if (l !== langFilter) return false;
      }
      if (!q) return true;
      return (
        (v.title || "").toLowerCase().includes(q) ||
        (v.style || "").toLowerCase().includes(q) ||
        (v.target_country || "").toLowerCase().includes(q)
      );
    });
  }, [videos, query, kindFilter, langFilter]);

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

        <OnboardingTour profile={profile} />

        <ShowcaseVideosAdmin />

        <CommunityIdeasManager />

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
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Video className="h-5 w-5" />Recent generations</h2>
            {(videos && videos.length > 0) && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search title, style, region…"
                    className="pl-8 h-9 w-56 bg-white/5 border-white/10"
                  />
                </div>
                <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
                  <SelectTrigger className="h-9 w-28 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="clip">Clips</SelectItem>
                    <SelectItem value="dub">Dubs</SelectItem>
                  </SelectContent>
                </Select>
                {languageOptions.length > 0 && (
                  <Select value={langFilter} onValueChange={setLangFilter}>
                    <SelectTrigger className="h-9 w-32 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All languages</SelectItem>
                      {languageOptions.map((l) => (
                        <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          {(!videos || videos.length === 0) ? (
            <div className="text-slate-400 text-sm">No videos yet. Start with the Clipper or Dubbing card above.</div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-slate-400 text-sm">No matches. Try clearing the filters.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {filteredVideos.slice(0, 12).map((v: any) => (
                <div
                  key={v.id}
                  className="group relative rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-fuchsia-400/40 transition"
                >
                  <button type="button" onClick={() => setSelectedVideo(v)} className="block w-full text-left">
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
                  {v.kind === "dub" && (v.source_url || v.output_url) ? (
                    <div className="px-3 pb-3">
                      <Link
                        to="/dubbing"
                        search={{ source: v.source_url || v.output_url, title: v.title } as any}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-gradient-to-r from-fuchsia-500/20 to-amber-400/20 hover:from-fuchsia-500/30 hover:to-amber-400/30 border border-white/10 px-2.5 py-1.5 text-xs font-medium text-fuchsia-200"
                      >
                        <Languages className="h-3 w-3" /> Re-dub in new language
                      </Link>
                    </div>
                  ) : null}
                </div>
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

