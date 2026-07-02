import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClips, getMyProfile, LIMITS } from "@/lib/video.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STYLE_TEMPLATES, LANGUAGES } from "@/lib/premium";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Lock, Scissors } from "lucide-react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";
import { ProcessingProgress } from "@/components/ProcessingProgress";

const CLIP_STAGES = [
  "Analyzing transcript…",
  "Detecting viral moments…",
  "Generating 3 shorts…",
  "Applying style & captions…",
  "Finalizing your clips…",
];

export const Route = createFileRoute("/_authenticated/clipper")({
  head: () => ({ meta: [{ title: "AI Video Clipper \u2014 TongueSync AI" }] }),
  component: Clipper,
});

function Clipper() {
  const { t } = useI18n();
  const getProfile = useServerFn(getMyProfile);
  const create = useServerFn(createClips);
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  const isPro = profileData?.profile?.tier === "pro";

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [style, setStyle] = useState("modern");
  const [language, setLanguage] = useState("en");
  const [autoEmojis, setAutoEmojis] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    setLoading(true);
    setResults(null);
    try {
      // Keep the fake pipeline visible for a beat even if the mock backend replies instantly.
      const [res] = await Promise.all([
        create({ data: { title, sourceUrl: source, style, language, autoEmojis, highlight } }),
        new Promise((r) => setTimeout(r, 4200)),
      ]);
      if ((res as any).error === "limit") {
        setUpgradeOpen(true);
        return;
      }
      setResults((res as any).videos);
      qc.invalidateQueries();
      toast.success("Generated 3 shorts!");
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
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black"><Scissors className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold">{t("clipper")}</h1>
            <p className="text-slate-400 text-sm">{t("clipper_desc")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div>
            <Label>{t("title_placeholder")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className="bg-white/5 border-white/10 mt-1" />
          </div>
          <div>
            <Label>{t("source_placeholder")}</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://youtube.com/..." className="bg-white/5 border-white/10 mt-1" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t("language")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("style")}</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger className="bg-white/5 border-white/10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STYLE_TEMPLATES.map((s) => (
                    <SelectItem key={s.id} value={s.id} disabled={!isPro && !s.free}>
                      <span className="flex items-center gap-2">
                        <span className={"inline-block h-3 w-6 rounded " + s.preview} />
                        {s.name}
                        {!isPro && !s.free && <Lock className="h-3 w-3 text-slate-400" />}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className={"flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3 " + (!isPro ? "opacity-50" : "")}>
              <span className="text-sm">{t("auto_emojis")} {!isPro && <Lock className="inline h-3 w-3 ml-1" />}</span>
              <Switch checked={autoEmojis && isPro} disabled={!isPro} onCheckedChange={setAutoEmojis} />
            </label>
            <label className={"flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3 " + (!isPro ? "opacity-50" : "")}>
              <span className="text-sm">{t("highlight_keywords")} {!isPro && <Lock className="inline h-3 w-3 ml-1" />}</span>
              <Switch checked={highlight && isPro} disabled={!isPro} onCheckedChange={setHighlight} />
            </label>
          </div>

          {!isPro && <p className="text-xs text-amber-300/80">{t("watermark_notice")} Free tier: up to {LIMITS.FREE_CLIPS} generations.</p>}

          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
            {loading ? t("processing") : t("generate")}
          </Button>
        </form>

        <ProcessingProgress active={loading} stages={CLIP_STAGES} duration={4200} skeletonCount={3} />

        {!loading && results && <VideoResult videos={results} isPro={isPro} />}
      </main>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
