import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile, listMyVideos, LIMITS } from "@/lib/video.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Scissors, Globe2, LogOut, Crown, Video } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { UpgradeModal } from "@/components/UpgradeModal";

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
          <ServiceCard to="/clipper" icon={<Scissors className="h-6 w-6" />} title={t("clipper")} desc={t("clipper_desc")} />
          <ServiceCard to="/dubbing" icon={<Globe2 className="h-6 w-6" />} title={t("dubbing")} desc={t("dubbing_desc")} />
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Video className="h-5 w-5" />Recent generations</h2>
          {(!videos || videos.length === 0) ? (
            <div className="text-slate-400 text-sm">No videos yet. Start with the Clipper or Dubbing card above.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {videos.slice(0, 6).map((v: any) => (
                <div key={v.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <video src={v.output_url} controls className="w-full aspect-[9/16] object-cover bg-black" />
                  <div className="p-3">
                    <div className="font-medium text-sm truncate">{v.title}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {v.kind} \u00b7 {v.style}
                      {v.watermarked && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Watermark</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}

function ServiceCard({ to, icon, title, desc }: { to: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link to={to as any} className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6 hover:border-fuchsia-500/40 hover:from-fuchsia-500/10 transition">
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
        {icon}
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-slate-300 text-sm">{desc}</p>
      <div className="mt-4 text-fuchsia-300 text-sm group-hover:translate-x-1 transition">Open \u2192</div>
    </Link>
  );
}
