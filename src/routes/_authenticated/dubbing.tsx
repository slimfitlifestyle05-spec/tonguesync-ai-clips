import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createDub, getMyProfile, LIMITS } from "@/lib/video.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, REGIONS, STYLE_TEMPLATES } from "@/lib/premium";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Globe2, Lock } from "lucide-react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";

export const Route = createFileRoute("/_authenticated/dubbing")({
  head: () => ({ meta: [{ title: "Cultural AI Dubbing \u2014 TongueSync AI" }] }),
  component: DubbingPage,
});

function DubbingPage() {
  const { t } = useI18n();
  const getProfile = useServerFn(getMyProfile);
  const dub = useServerFn(createDub);
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  const isPro = profileData?.profile?.tier === "pro";

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("ar");
  const [targetCountry, setTargetCountry] = useState("SA");
  const [style, setStyle] = useState("modern");
  const [duration, setDuration] = useState(20);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const maxDur = isPro ? LIMITS.PRO_DUB_MAX_SECONDS : LIMITS.FREE_DUB_MAX_SECONDS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await dub({ data: { title, sourceUrl: source, targetLanguage, targetCountry, style, durationSeconds: duration } });
      if ((res as any).error === "limit") { setUpgradeOpen(true); return; }
      if ((res as any).error === "duration") { toast.error(`Max ${(res as any).maxDur}s on your plan.`); return; }
      setResult((res as any).video);
      qc.invalidateQueries();
      toast.success("Dubbed!");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 border-b border-white/5">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />{t("back")}</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black"><Globe2 className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold">{t("dubbing")}</h1>
            <p className="text-slate-400 text-sm">{t("dubbing_desc")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <Label>{t("title_placeholder")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className="bg-white/5 border-white/10 mt-1" />
          </div>
          <div>
            <Label>Source video URL</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://..." className="bg-white/5 border-white/10 mt-1" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>{t("target_language")}</Label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("target_country")}</Label>
              <Select value={targetCountry} onValueChange={setTargetCountry}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{REGIONS.map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("style")}</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLE_TEMPLATES.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={!isPro && !s.free}>
                      {s.name}{!isPro && !s.free && " \ud83d\udd12"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Duration (seconds) \u2014 max {maxDur}s</Label>
            <Input type="number" min={5} max={maxDur} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "0"))} className="bg-white/5 border-white/10 mt-1" />
          </div>
          {!isPro && <p className="text-xs text-amber-300/80">{t("watermark_notice")} Free: 1 dub up to {LIMITS.FREE_DUB_MAX_SECONDS}s.</p>}
          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
            {loading ? t("processing") : t("generate")}
          </Button>
        </form>

        {result && <VideoResult videos={[result]} isPro={isPro} />}
      </main>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
