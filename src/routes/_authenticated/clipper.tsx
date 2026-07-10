import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { ArrowLeft, Lock, RotateCcw, Scissors, CheckCircle2, Loader2, AlertCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";
import { loadSession, saveSession, clearSession } from "@/lib/videoCache";
import { extractAnalysisAudio, fetchVideoBlobFromUrl, sliceIntoClips, DEFAULT_QUALITY, type ClipQuality } from "@/lib/video-clip-client";
import { Upload } from "lucide-react";
import { generateClipPlanFromAudio, type ClipPlan } from "@/lib/clip-copy-client";

const CACHE_KEY = "clipper";

type StageKey = "fetch" | "analyze" | "plan" | "cut" | "output";
type StageStatus = "pending" | "active" | "done" | "error";
const STAGE_ORDER: { key: StageKey; label: string; range: [number, number] }[] = [
  { key: "fetch", label: "Fetching video", range: [0, 15] },
  { key: "analyze", label: "Analyzing audio", range: [15, 45] },
  { key: "plan", label: "Gemini picking moments", range: [45, 70] },
  { key: "cut", label: "Cutting clips", range: [70, 95] },
  { key: "output", label: "Preparing output", range: [95, 100] },
];

type PlanPreview = {
  plans: ClipPlan[];
  sourceBlob: Blob;
  sourceName: string;
  sourceUrl: string;
  previewObjectUrl: string;
};

function StageList({
  statuses,
  errorStage,
}: {
  statuses: Record<StageKey, StageStatus>;
  errorStage: StageKey | null;
}) {
  return (
    <ul className="space-y-1.5">
      {STAGE_ORDER.map((s) => {
        const st = errorStage === s.key ? "error" : statuses[s.key];
        return (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {st === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
            {st === "active" && <Loader2 className="h-4 w-4 animate-spin text-fuchsia-300" />}
            {st === "pending" && <div className="h-4 w-4 rounded-full border border-white/20" />}
            {st === "error" && <AlertCircle className="h-4 w-4 text-rose-400" />}
            <span className={st === "done" ? "text-slate-300" : st === "active" ? "text-white" : st === "error" ? "text-rose-300" : "text-slate-500"}>
              {s.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PreviewCard({
  plan,
  srcUrl,
  index,
  quality,
  onQualityChange,
}: {
  plan: ClipPlan;
  srcUrl: string;
  index: number;
  quality: ClipQuality;
  onQualityChange: (q: ClipQuality) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  function play() {
    const v = ref.current;
    if (!v) return;
    v.currentTime = plan.start;
    v.play().catch(() => {});
  }
  function onTime() {
    const v = ref.current;
    if (!v) return;
    if (v.currentTime >= plan.end) {
      v.pause();
      v.currentTime = plan.start;
    }
  }
  const dur = Math.max(1, Math.round(plan.end - plan.start));
  const resValue = String(quality.height ?? 1080);
  const fpsValue = String(quality.fps ?? 30);
  const brValue = String(quality.videoBitrateKbps ?? 0);
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      <div className="relative aspect-[9/16] bg-black">
        <video
          ref={ref}
          src={srcUrl}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={() => { if (ref.current) ref.current.currentTime = plan.start; }}
          onTimeUpdate={onTime}
        />
        <button
          type="button"
          onClick={play}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/10 transition"
          aria-label="Preview clip"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
            <Play className="h-5 w-5" />
          </span>
        </button>
        <div className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs">
          Short {index + 1} · {dur}s
        </div>
        <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-slate-200">
          {plan.start.toFixed(1)}s → {plan.end.toFixed(1)}s
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div className="text-sm font-medium line-clamp-1">{plan.title}</div>
        <div className="text-xs text-slate-400 line-clamp-2">{plan.description}</div>
        <div className="pt-2 border-t border-white/5 grid grid-cols-3 gap-1.5">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Res</div>
            <Select value={resValue} onValueChange={(v) => onQualityChange({ ...quality, height: Number(v) as ClipQuality["height"] })}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2160">4K</SelectItem>
                <SelectItem value="1440">1440p</SelectItem>
                <SelectItem value="1080">1080p</SelectItem>
                <SelectItem value="720">720p</SelectItem>
                <SelectItem value="480">480p</SelectItem>
                <SelectItem value="0">Source</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">FPS</div>
            <Select value={fpsValue} onValueChange={(v) => onQualityChange({ ...quality, fps: Number(v) as ClipQuality["fps"] })}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="60">60</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="24">24</SelectItem>
                <SelectItem value="0">Source</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Bitrate</div>
            <Select value={brValue} onValueChange={(v) => onQualityChange({ ...quality, videoBitrateKbps: Number(v) as ClipQuality["videoBitrateKbps"] })}>
              <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Auto</SelectItem>
                <SelectItem value="12000">12 Mbps</SelectItem>
                <SelectItem value="8000">8 Mbps</SelectItem>
                <SelectItem value="5000">5 Mbps</SelectItem>
                <SelectItem value="3000">3 Mbps</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/clipper")({
  head: () => ({ meta: [{ title: "AI Video Clipper \u2014 TongueSync AI" }] }),
  component: Clipper,
});

function Clipper() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const create = useServerFn(createClips);
  const qc = useQueryClient();
  const { data: profileData } = useQuery({ queryKey: ["me"], queryFn: () => getProfile() });
  const isPro = profileData?.profile?.tier === "pro";

  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [style, setStyle] = useState("modern");
  const [language, setLanguage] = useState("en");
  const [autoEmojis, setAutoEmojis] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const hydrated = useRef(false);

  const [phase, setPhase] = useState<"idle" | "analyzing" | "preview" | "exporting">("idle");
  const [statuses, setStatuses] = useState<Record<StageKey, StageStatus>>({
    fetch: "pending", analyze: "pending", plan: "pending", cut: "pending", output: "pending",
  });
  const [percent, setPercent] = useState(0);
  const [detail, setDetail] = useState("");
  const [errorStage, setErrorStage] = useState<StageKey | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [qualities, setQualities] = useState<ClipQuality[]>([]);
  const busy = phase === "analyzing" || phase === "exporting";

  useEffect(() => {
    return () => { if (preview?.previewObjectUrl) URL.revokeObjectURL(preview.previewObjectUrl); };
  }, [preview?.previewObjectUrl]);

  function resetProgress() {
    setStatuses({ fetch: "pending", analyze: "pending", plan: "pending", cut: "pending", output: "pending" });
    setPercent(0);
    setDetail("");
    setErrorStage(null);
    setErrorMsg(null);
  }

  function setStageActive(key: StageKey) {
    setStatuses((s) => ({ ...s, [key]: "active" }));
    const [lo] = STAGE_ORDER.find((x) => x.key === key)!.range;
    setPercent(lo);
  }
  function setStageDone(key: StageKey) {
    setStatuses((s) => ({ ...s, [key]: "done" }));
    const [, hi] = STAGE_ORDER.find((x) => x.key === key)!.range;
    setPercent(hi);
  }
  function setStageProgress(key: StageKey, ratio: number) {
    const [lo, hi] = STAGE_ORDER.find((x) => x.key === key)!.range;
    const r = Math.max(0, Math.min(1, ratio));
    setPercent(Math.round(lo + (hi - lo) * r));
  }

  // Restore cached session on mount
  useEffect(() => {
    loadSession(CACHE_KEY).then((s) => {
      if (s) {
        const f = s.form || {};
        if (typeof f.title === "string") setTitle(f.title);
        if (typeof f.source === "string") setSource(f.source);
        if (typeof f.style === "string") setStyle(f.style);
        if (typeof f.language === "string") setLanguage(f.language);
        if (typeof f.autoEmojis === "boolean") setAutoEmojis(f.autoEmojis);
        if (typeof f.highlight === "boolean") setHighlight(f.highlight);
        if (s.file && s.file.blob) {
          try {
            const restored = new File([s.file.blob], s.file.name, { type: s.file.type });
            setFile(restored);
            setFileName(s.file.name);
          } catch {}
        }
        if (s.results) {
          setResults(s.results);
          toast.success("Restored your last session");
        }
      }
      hydrated.current = true;
    });
  }, []);

  // Persist form + results whenever they change (after initial hydration)
  useEffect(() => {
    if (!hydrated.current) return;
    saveSession({
      key: CACHE_KEY,
      updatedAt: Date.now(),
      form: { title, source, style, language, autoEmojis, highlight },
      results,
      file: file ? { name: file.name, type: file.type, size: file.size, blob: file } : null,
    });
  }, [title, source, style, language, autoEmojis, highlight, results, file]);

  function resetAll() {
    setTitle("");
    setSource("");
    setStyle("modern");
    setLanguage("en");
    setAutoEmojis(false);
    setHighlight(false);
    setFile(null);
    setFileName("");
    setResults(null);
    setPreview(null);
    setPhase("idle");
    resetProgress();
    clearSession(CACHE_KEY);
    toast.success("Cleared — ready for a new video");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    if (!file && !source.trim()) {
      toast.error("Upload a video or paste a link");
      return;
    }
    setPhase("analyzing");
    setResults(null);
    setPreview(null);
    resetProgress();
    let stage: StageKey = "fetch";
    try {
      // Stage 1 — fetch
      stage = "fetch";
      setStageActive("fetch");
      setDetail(file ? `Using uploaded file: ${file.name}` : "Downloading the linked video…");
      const sourceFile = file
        ? { blob: file as Blob, name: fileName || file.name, url: source.trim() || `upload://${file.name}` }
        : await fetchVideoBlobFromUrl(source);
      setStageDone("fetch");

      // Stage 2 — analyze (extract audio)
      stage = "analyze";
      setStageActive("analyze");
      setDetail("Extracting audio for analysis…");
      const analysisAudio = await extractAnalysisAudio(sourceFile.blob, {
        maxSeconds: 300,
        onProgress: (_r, msg) => { if (msg) setDetail(msg); },
      });
      setStageDone("analyze");

      // Stage 3 — Gemini plan
      stage = "plan";
      setStageActive("plan");
      setDetail("Gemini is picking the 3 best moments…");
      const clipPlans = await generateClipPlanFromAudio(analysisAudio, title, 3);
      if (!clipPlans?.length) throw new Error("Gemini did not return any clip suggestions.");
      setStageDone("plan");

      // Preview phase — wait for user confirmation before cutting
      const previewObjectUrl = URL.createObjectURL(sourceFile.blob);
      setPreview({
        plans: clipPlans,
        sourceBlob: sourceFile.blob,
        sourceName: sourceFile.name,
        sourceUrl: sourceFile.url,
        previewObjectUrl,
      });
      setQualities(clipPlans.map(() => ({ ...DEFAULT_QUALITY })));
      setPhase("preview");
      setDetail("Review the 3 selected moments, then confirm to export.");
    } catch (err: any) {
      setErrorStage(stage);
      setErrorMsg(err?.message ?? "Something went wrong.");
      toast.error(`${STAGE_ORDER.find((s) => s.key === stage)?.label ?? "Error"}: ${err?.message ?? "Failed"}`);
      setPhase("idle");
    }
  }

  async function confirmAndExport() {
    if (!preview) return;
    setPhase("exporting");
    // Preserve fetch/analyze/plan as done, reset cut+output.
    setStatuses((s) => ({ ...s, cut: "pending", output: "pending" }));
    setErrorStage(null);
    setErrorMsg(null);
    let stage: StageKey = "cut";
    try {
      // Stage 4 — cut
      stage = "cut";
      setStageActive("cut");
      setDetail("Cutting clips with ffmpeg.wasm…");
      const slices = await sliceIntoClips(preview.sourceBlob, 3, {
        maxLenSeconds: 30,
        analysisWindowSeconds: 300,
        windows: preview.plans.map((p, i) => ({ start: p.start, end: p.end, quality: qualities[i] ?? DEFAULT_QUALITY })),
        onProgress: (r, msg) => {
          setStageProgress("cut", r);
          if (msg) setDetail(msg);
        },
      });
      if (!slices.length) throw new Error("Couldn't cut real clips from this video. Try uploading the original file.");
      setStageDone("cut");

      // Stage 5 — output
      stage = "output";
      setStageActive("output");
      setDetail("Saving output…");
      const res = await create({ data: { title, sourceUrl: preview.sourceUrl, style, language, autoEmojis, highlight } });
      if ((res as any).error === "limit") {
        setUpgradeOpen(true);
        setPhase("preview");
        return;
      }
      const persisted = Array.isArray((res as any).videos) ? ((res as any).videos as any[]) : [];
      const vids = slices.map((s, i) => {
        const v = persisted[i] ?? {};
        const plan = preview.plans[i];
        return {
          ...v,
          id: v.id ?? `local-${Date.now()}-${i}`,
          title: plan?.title ?? v.title ?? `${title} — Short ${i + 1}`,
          output_url: s.url,
          source_url: preview.sourceUrl,
          duration_seconds: Math.round(s.end - s.start),
          clip_start: s.start,
          clip_end: s.end,
          clip_blob: s.blob,
          is_real_clip: true,
          social_kit: {
            ...(v.social_kit ?? {}),
            title: plan?.title,
            description: plan?.description,
            hashtags: plan?.hashtags,
            caption_text: plan?.title,
            gemini_reason: plan?.reason,
            clip_start: s.start,
            clip_end: s.end,
          },
        };
      });
      setResults(vids);
      qc.invalidateQueries();
      await saveSession({
        key: CACHE_KEY,
        updatedAt: Date.now(),
        form: { title, source, style, language, autoEmojis, highlight, fileName: preview.sourceName },
        results: vids,
        file: { name: preview.sourceName, type: preview.sourceBlob.type || "video/mp4", size: preview.sourceBlob.size, blob: preview.sourceBlob },
      });
      setStageDone("output");
      toast.success("Cut 3 real shorts from your video!");
      navigate({ to: "/clipper/results" });
    } catch (err: any) {
      setErrorStage(stage);
      setErrorMsg(err?.message ?? "Something went wrong.");
      toast.error(`${STAGE_ORDER.find((s) => s.key === stage)?.label ?? "Error"}: ${err?.message ?? "Failed"}`);
      setPhase("preview");
    }
  }

  function cancelPreview() {
    if (preview?.previewObjectUrl) URL.revokeObjectURL(preview.previewObjectUrl);
    setPreview(null);
    setPhase("idle");
    resetProgress();
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
          <div className="space-y-2">
            <Label>Upload a video from your computer</Label>
            <label
              htmlFor="clipper-upload"
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-fuchsia-400/40 bg-fuchsia-500/5 px-4 py-3 hover:bg-fuchsia-500/10 transition"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {fileName ? fileName : "Choose a video file (mp4, mov, webm)…"}
                </div>
                <div className="text-xs text-slate-400">
                  Best option: cuts 3 real shorts from the uploaded video itself.
                </div>
              </div>
              {fileName && (
                <button
                  type="button"
                  onClick={(ev) => { ev.preventDefault(); setFile(null); setFileName(""); }}
                  className="text-xs text-slate-300 hover:text-white underline underline-offset-2"
                >
                  Remove
                </button>
              )}
              <input
                id="clipper-upload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0] ?? null;
                  setFile(f);
                  setFileName(f ? f.name : "");
                }}
              />
            </label>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <span className="h-px flex-1 bg-white/10" /> or paste a link <span className="h-px flex-1 bg-white/10" />
          </div>
          <div>
            <Label>{t("source_placeholder")}</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://youtube.com/..." className="bg-white/5 border-white/10 mt-1" />
            <p className="mt-1 text-xs text-slate-500">
              Direct .mp4/.mov/.webm links can be cut here. For YouTube/TikTok/Instagram pages, upload the original file so the clips come from the same video.
            </p>
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

          <Button type="submit" disabled={busy || phase === "preview"} className="w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
            {phase === "analyzing" ? "Analyzing…" : phase === "preview" ? "Review below" : phase === "exporting" ? "Exporting…" : t("generate")}
          </Button>
        </form>

        {(busy || errorMsg || phase === "preview") && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">
                  {phase === "analyzing" && "Analyzing your video…"}
                  {phase === "preview" && !errorMsg && "Ready to export"}
                  {phase === "exporting" && "Exporting your shorts…"}
                  {errorMsg && "Something went wrong"}
                </span>
                <span className="tabular-nums text-slate-400">{percent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className={"h-full transition-all duration-300 " + (errorMsg ? "bg-rose-400" : "bg-gradient-to-r from-fuchsia-500 to-amber-400")}
                  style={{ width: `${percent}%` }}
                />
              </div>
              {detail && !errorMsg && <p className="mt-2 text-xs text-slate-400">{detail}</p>}
              {errorMsg && (
                <p className="mt-2 text-sm text-rose-300">
                  {STAGE_ORDER.find((s) => s.key === errorStage)?.label}: {errorMsg}
                </p>
              )}
            </div>
            <StageList statuses={statuses} errorStage={errorStage} />

            {phase === "preview" && preview && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Preview the 3 selected moments</h3>
                  <span className="text-xs text-slate-400">Same frames from your original video</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {preview.plans.map((p, i) => (
                    <PreviewCard
                      key={i}
                      plan={p}
                      srcUrl={preview.previewObjectUrl}
                      index={i}
                      quality={qualities[i] ?? DEFAULT_QUALITY}
                      onQualityChange={(q) => setQualities((prev) => prev.map((x, idx) => (idx === i ? q : x)))}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={cancelPreview} className="border-white/15 bg-white/5 hover:bg-white/10">
                    Cancel
                  </Button>
                  <Button type="button" onClick={confirmAndExport} className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
                    Confirm & Export 3 Shorts
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!busy && phase === "idle" && results && (
          <div className="mt-6 space-y-3">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={resetAll} className="border-white/15 bg-white/5 hover:bg-white/10">
                <RotateCcw className="h-4 w-4 mr-1" /> New video
              </Button>
            </div>
            <VideoResult videos={results} isPro={isPro} />
          </div>
        )}
      </main>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
