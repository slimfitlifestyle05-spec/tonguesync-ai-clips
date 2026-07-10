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
import { ArrowLeft, Lock, RotateCcw, Scissors } from "lucide-react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";
import { ProcessingProgress } from "@/components/ProcessingProgress";
import { loadSession, saveSession, clearSession } from "@/lib/videoCache";
import { extractAnalysisAudio, fetchVideoBlobFromUrl, sliceIntoClips } from "@/lib/video-clip-client";
import { Upload } from "lucide-react";
import { generateClipPlanFromAudio, hasGeminiKey } from "@/lib/clip-copy-client";

const CACHE_KEY = "clipper";

const CLIP_STAGES = [
  "Reading video…",
  "Transcribing text…",
  "Finalizing output…",
];
const CLIP_BOUNDARIES = [30, 70, 100];

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
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const hydrated = useRef(false);

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
    setLoading(true);
    setResults(null);
    try {
      if (!hasGeminiKey()) {
        throw new Error("Gemini key is required to analyze this video and choose exact real clip timestamps.");
      }
      const sourceFile = file
        ? { blob: file, name: fileName || file.name, url: source.trim() || `upload://${file.name}` }
        : await fetchVideoBlobFromUrl(source);

      toast.message("Gemini is choosing the exact moments from your video…");
      const analysisAudio = await extractAnalysisAudio(sourceFile.blob, {
        maxSeconds: 300,
        onProgress: (_ratio, msg) => { if (msg) console.debug("[clipper]", msg); },
      });
      const clipPlans = await generateClipPlanFromAudio(analysisAudio, title, 3);
      const slices = await sliceIntoClips(sourceFile.blob, 3, {
        maxLenSeconds: 30,
        analysisWindowSeconds: 300,
        windows: clipPlans.map((p) => ({ start: p.start, end: p.end })),
      });

      if (!slices.length) {
        throw new Error("Couldn't cut real clips from this video. Please upload the original file again.");
      }

      const res = await create({ data: { title, sourceUrl: sourceFile.url, style, language, autoEmojis, highlight } });
      if ((res as any).error === "limit") {
        setUpgradeOpen(true);
        return;
      }
      const persisted = Array.isArray((res as any).videos) ? ((res as any).videos as any[]) : [];
      const vids = slices.map((s, i) => {
        const v = persisted[i] ?? {};
        const plan = clipPlans[i];
        return {
          ...v,
          id: v.id ?? `local-${Date.now()}-${i}`,
          title: plan?.title ?? v.title ?? `${title} — Short ${i + 1}`,
          output_url: s.url,
          source_url: sourceFile.url,
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
      // Persist immediately so the results page can read the fresh clips.
      await saveSession({
        key: CACHE_KEY,
        updatedAt: Date.now(),
        form: { title, source, style, language, autoEmojis, highlight, fileName: sourceFile.name },
        results: vids,
        file: { name: sourceFile.name, type: sourceFile.blob.type || "video/mp4", size: sourceFile.blob.size, blob: sourceFile.blob },
      });
      toast.success("Cut 3 real shorts from your video!");
      navigate({ to: "/clipper/results" });
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

          <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
            {loading ? t("processing") : t("generate")}
          </Button>
        </form>

        <ProcessingProgress active={loading} stages={CLIP_STAGES} boundaries={CLIP_BOUNDARIES} duration={4200} skeletonCount={3} />

        {!loading && results && (
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
