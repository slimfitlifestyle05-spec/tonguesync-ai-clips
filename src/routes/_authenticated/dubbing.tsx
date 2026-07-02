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
import { ArrowLeft, Globe2, Lock, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";
import { ProcessingProgress } from "@/components/ProcessingProgress";

const DUB_STAGES = [
  "Analyzing transcript…",
  "Detecting tone & context…",
  "Translating with cultural nuance…",
  "Generating natural voice…",
  "Rendering dubbed video…",
];

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
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
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
    setResult(null);
    try {
      const sourceUrl = file ? `upload://${file.name}` : source;
      const [res] = await Promise.all([
        dub({ data: { title, sourceUrl, targetLanguage, targetCountry, style, durationSeconds: duration } }),
        new Promise((r) => setTimeout(r, 4200)),
      ]);
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

  function onFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    const f = files[0];
    if (!f.type.startsWith("video/")) { toast.error("Please upload a video file (.mp4, .mov, .webm)"); return; }
    setFile(f);
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
            <Label>Source video</Label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); onFiles(e.dataTransfer.files); }}
              className={`mt-1 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition ${
                dragActive ? "border-fuchsia-400 bg-fuchsia-500/10" : "border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/10"
              }`}
            >
              {file ? (
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium truncate max-w-[240px]">{file.name}</div>
                    <div className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(1)} MB</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setFile(null); }}
                    className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
                    aria-label="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
                    <UploadCloud className="h-5 w-5 text-fuchsia-300" />
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Drag & drop your video here</span>
                    <span className="text-slate-400"> or </span>
                    <span className="text-fuchsia-300 underline underline-offset-2">browse</span>
                  </div>
                  <div className="text-xs text-slate-500">MP4, MOV, WEBM · up to {maxDur}s</div>
                </>
              )}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
            <div className="mt-3">
              <Label className="text-xs text-slate-400">Or paste a video URL</Label>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="https://..."
                disabled={!!file}
                className="bg-white/5 border-white/10 mt-1 disabled:opacity-50"
              />
            </div>
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
            <Label>Duration (seconds) — Max {maxDur}s</Label>
            <Input type="number" min={5} max={maxDur} value={duration} onChange={(e) => setDuration(parseInt(e.target.value || "0"))} className="bg-white/5 border-white/10 mt-1" />
          </div>
          {!isPro && <p className="text-xs text-amber-300/80">{t("watermark_notice")} Free: 1 dub up to {LIMITS.FREE_DUB_MAX_SECONDS}s.</p>}
          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
            {loading ? t("processing") : t("generate")}
          </Button>
        </form>

        <ProcessingProgress active={loading} stages={DUB_STAGES} duration={4200} skeletonCount={1} />

        {!loading && result && <VideoResult videos={[result]} isPro={isPro} />}
      </main>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
