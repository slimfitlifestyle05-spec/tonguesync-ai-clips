import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createDub, getMyProfile, LIMITS } from "@/lib/video.functions";
import { transcribeUpload } from "@/lib/transcribe.functions";
import { previewDubbingVoice } from "@/lib/voice-preview.functions";
import { hasClientDubbingKeys, runClientDubbing } from "@/lib/dubbing-client";
import { muxDubbedVideo } from "@/lib/video-mux-client";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, REGIONS, STYLE_TEMPLATES } from "@/lib/premium";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Globe2, Lock, RotateCcw, UploadCloud, X, Loader2, Layers, Volume2, Mic, User, Users, Subtitles, Smile } from "lucide-react";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/UpgradeModal";
import { VideoResult } from "@/components/VideoResult";
import { ProcessingProgress } from "@/components/ProcessingProgress";
import { loadSession, saveSession, clearSession } from "@/lib/videoCache";

const CACHE_KEY = "dubbing";

const DUB_STAGES = [
  "Reading video…",
  "Transcribing text…",
  "Finalizing output…",
];
const DUB_BOUNDARIES = [30, 70, 100];

export const Route = createFileRoute("/_authenticated/dubbing")({
  head: () => ({ meta: [{ title: "Cultural AI Dubbing \u2014 TongueSync AI" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    source: typeof search.source === "string" ? search.source : undefined,
    title: typeof search.title === "string" ? search.title : undefined,
  }),
  component: DubbingPage,
});

function DubbingPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const getProfile = useServerFn(getMyProfile);
  const dub = useServerFn(createDub);
  const transcribe = useServerFn(transcribeUpload);
  const previewVoice = useServerFn(previewDubbingVoice);
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  async function handleVoicePreview() {
    if (previewingVoice) return;
    setPreviewingVoice(true);
    try {
      const r = await previewVoice({ data: { targetLanguage, voiceGender } });
      if (!(r as any).ok) {
        toast.error((r as any).error ?? "Couldn't play preview");
        return;
      }
      const audio = new Audio((r as any).audioDataUrl);
      previewAudioRef.current?.pause();
      previewAudioRef.current = audio;
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't play preview");
    } finally {
      setPreviewingVoice(false);
    }
  }
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
  const [voiceGender, setVoiceGender] = useState<"female" | "male">("female");
  const [captionStyle, setCaptionStyle] = useState<
    "none" | "classic" | "tiktok" | "neon" | "karaoke" | "minimal"
  >("none");
  const [captionEmojis, setCaptionEmojis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [batchResults, setBatchResults] = useState<any[] | null>(null);
  const [extraLanguages, setExtraLanguages] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [muxedVideoUrl, setMuxedVideoUrl] = useState<string | null>(null);
  const [muxProgress, setMuxProgress] = useState<number | null>(null);
  const hydrated = useRef(false);

  const isUploadUrl = (url: unknown) => typeof url === "string" && /^upload:\/\//i.test(url);

  const withPlayableUploadUrl = (video: any) => {
    if (!video) return video;
    const playable = muxedVideoUrl ?? localVideoUrl;
    if (!playable) return video;
    return {
      ...video,
      source_url: isUploadUrl(video.source_url) ? (localVideoUrl ?? playable) : video.source_url,
      output_url: isUploadUrl(video.output_url) ? playable : video.output_url,
    };
  };

  const displayResult = result ? withPlayableUploadUrl(result) : null;
  const displayBatchResults = batchResults ? batchResults.map(withPlayableUploadUrl) : null;

  // Restore cached session (including uploaded file Blob)
  useEffect(() => {
    loadSession(CACHE_KEY).then((s) => {
      if (s) {
        const f = s.form || {};
        if (typeof f.title === "string") setTitle(f.title);
        if (typeof f.source === "string") setSource(f.source);
        if (typeof f.targetLanguage === "string") setTargetLanguage(f.targetLanguage);
        if (typeof f.targetCountry === "string") setTargetCountry(f.targetCountry);
        if (typeof f.style === "string") setStyle(f.style);
        if (typeof f.duration === "number") setDuration(f.duration);
        if (f.voiceGender === "male" || f.voiceGender === "female") setVoiceGender(f.voiceGender);
        if (typeof f.captionStyle === "string") setCaptionStyle(f.captionStyle as any);
        if (typeof f.captionEmojis === "boolean") setCaptionEmojis(f.captionEmojis);
        if (s.file && s.file.blob) {
          try {
            const restored = new File([s.file.blob], s.file.name, { type: s.file.type });
            setFile(restored);
          } catch {}
        }
        if (s.results) {
          setResult(s.results);
          toast.success("Restored your last dubbing session");
        }
      }
      // Search-param prefill wins over cached session for re-dub deep links
      if (search.source) {
        setSource(search.source);
        setFile(null);
      }
      if (search.title) setTitle(`${search.title} — re-dub`);
      if (search.source) toast("Re-dub: source prefilled — pick a new language and go");
      hydrated.current = true;
    });
  }, []);

  useEffect(() => {
    if (!file) {
      setLocalVideoUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Persist changes
  useEffect(() => {
    if (!hydrated.current) return;
    saveSession({
      key: CACHE_KEY,
      updatedAt: Date.now(),
      form: { title, source, targetLanguage, targetCountry, style, duration, voiceGender, captionStyle, captionEmojis },
      results: result,
      file: file ? { name: file.name, type: file.type, size: file.size, blob: file } : null,
    });
  }, [title, source, targetLanguage, targetCountry, style, duration, voiceGender, captionStyle, captionEmojis, result, file]);

  function resetAll() {
    setTitle("");
    setSource("");
    setFile(null);
    setTargetLanguage("ar");
    setTargetCountry("SA");
    setStyle("modern");
    setDuration(20);
    setResult(null);
    setMuxedVideoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setMuxProgress(null);
    clearSession(CACHE_KEY);
    toast.success("Cleared — ready for a new video");
  }

  const maxDur = isPro ? LIMITS.PRO_DUB_MAX_SECONDS : LIMITS.FREE_DUB_MAX_SECONDS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setBatchResults(null);
    try {
      const sourceUrl = file ? `upload://${file.name}` : source;
      // If the user uploaded a video/audio file, transcribe it in the browser
      // → server via Lovable AI STT so the dub matches what the video says.
      // Server can't fetch upload:// URLs, so ASR must happen here.
      let providedTranscript = "";
      let providedSegments: Array<{ start: number; end: number; text: string }> = [];
      if (file) {
        try {
          if (file.size > 15 * 1024 * 1024) {
            toast.error("For accurate dubbing, please use a clip under 15MB.");
            return;
          }
          const buf = await file.arrayBuffer();
          let bin = "";
          const bytes = new Uint8Array(buf);
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const base64 = btoa(bin);
          const tr = await transcribe({ data: { base64, mimeType: file.type || "video/mp4", filename: file.name } });
          if ((tr as any).ok) {
            providedTranscript = (tr as any).text;
            providedSegments = ((tr as any).segments ?? []) as typeof providedSegments;
          } else {
            toast.warning(`Couldn't read the video's speech: ${(tr as any).error}. Using a generic script.`);
          }
        } catch (e: any) {
          toast.warning(`Transcription skipped: ${e?.message ?? "error"}. Using a generic script.`);
        }
      }
      const targets = [targetLanguage, ...extraLanguages.filter((l) => l !== targetLanguage)];
      const isBatch = targets.length > 1;
      if (isBatch && !isPro) {
        toast.error("Multi-language batch dub is a Pro feature");
        setUpgradeOpen(true);
        return;
      }
      if (isBatch) setBatchProgress({ done: 0, total: targets.length });
      const results: any[] = [];
      let firstError: string | null = null;
      const clientDubEnabled = hasClientDubbingKeys() && providedSegments.length > 0;
      for (let i = 0; i < targets.length; i++) {
        const lang = targets[i];
        // Client-side path — Gemini + Cartesia straight from the browser.
        let providedDubbedSegments: Array<{ start: number; end: number; text: string; audioDataUrl: string }> = [];
        let providedLocalizedText = "";
        if (clientDubEnabled) {
          try {
            const r = await runClientDubbing({
              segments: providedSegments,
              targetLanguage: lang,
              targetCountry,
              voiceGender,
            });
            providedDubbedSegments = r.segments;
            providedLocalizedText = r.localizedText;
            // Browser-native muxing: replace the original audio with the
            // Cartesia dub, produce an MP4 the user can preview & download.
            if (file && providedDubbedSegments.length > 0 && i === 0) {
              try {
                setMuxProgress(0);
                toast.message("Rendering your dubbed short video in the browser…");
                const { url } = await muxDubbedVideo(
                  file,
                  providedDubbedSegments.map((s) => ({ start: s.start, audioDataUrl: s.audioDataUrl })),
                  (ratio) => { if (ratio >= 0) setMuxProgress(ratio); },
                );
                setMuxedVideoUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
                setMuxProgress(1);
              } catch (mx: any) {
                toast.warning(`In-browser render failed (${mx?.message ?? "error"}). Showing original video with dubbed audio track separately.`);
              } finally {
                setTimeout(() => setMuxProgress(null), 1200);
              }
            }
          } catch (e: any) {
            toast.warning(`Client dubbing failed (${e?.message ?? "error"}). Falling back to server.`);
          }
        }
        const [res] = await Promise.all([
          dub({ data: { title: isBatch ? `${title} — ${lang.toUpperCase()}` : title, sourceUrl, targetLanguage: lang, targetCountry, style, durationSeconds: duration, providedTranscript, providedSegments, voiceGender, captionStyle, captionEmojis, providedDubbedSegments, providedLocalizedText } }),
          i === 0 ? new Promise((r) => setTimeout(r, 4200)) : Promise.resolve(),
        ]);
        if ((res as any).error === "limit") { setUpgradeOpen(true); return; }
        if ((res as any).error === "duration") { toast.error(`Max ${(res as any).maxDur}s on your plan.`); return; }
        results.push((res as any).video);
        const pipelineError = (res as any).pipelineError as string | null | undefined;
        if (pipelineError && !firstError) firstError = pipelineError;
        if (isBatch) setBatchProgress({ done: i + 1, total: targets.length });
      }
      if (isBatch) {
        setBatchResults(results);
        toast.success(`Dubbed in ${results.length} languages`);
      } else {
        setResult(results[0]);
        if (firstError) toast.warning(`Dubbed with fallback voice. ${firstError}`, { duration: 6000 });
        else toast.success("Dubbed!");
      }
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setLoading(false);
      setBatchProgress(null);
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
      <main className={`mx-auto px-6 py-10 transition-all ${result && !loading ? "max-w-6xl" : "max-w-4xl"}`}>
        <div className="mb-8 flex items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black"><Globe2 className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold">{t("dubbing")}</h1>
            <p className="text-slate-400 text-sm">{t("dubbing_desc")}</p>
          </div>
        </div>

        <div className={`grid gap-6 ${result && !loading ? "lg:grid-cols-2 items-stretch" : "grid-cols-1"}`}>
        <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 min-w-0 h-full flex flex-col">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-fuchsia-300/80 font-semibold">Configure</div>
              <h2 className="text-lg font-semibold">Dubbing settings</h2>
            </div>
          </div>
          <div className="space-y-4 flex-1">
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
              <div className="mt-1 flex gap-2">
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger className="bg-white/5 border-white/10 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleVoicePreview}
                  disabled={previewingVoice}
                  aria-label="Preview dubbing voice"
                  title="Preview dubbing voice"
                  className="shrink-0 bg-white/5 border-white/10"
                >
                  {previewingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>
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
          <div>
            <Label className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> Voice</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["female", "male"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setVoiceGender(g)}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm capitalize transition ${
                    voiceGender === g
                      ? "bg-gradient-to-r from-fuchsia-500/30 to-amber-400/30 border-fuchsia-400/60 text-white"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {g === "female" ? <User className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {g}
                </button>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">Tap the speaker icon above to preview the selected voice.</div>
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Subtitles className="h-3.5 w-3.5" /> Captions</Label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {([
                { id: "none", label: "Off" },
                { id: "classic", label: "Classic" },
                { id: "tiktok", label: "TikTok" },
                { id: "neon", label: "Neon" },
                { id: "karaoke", label: "Karaoke" },
                { id: "minimal", label: "Minimal" },
              ] as const).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCaptionStyle(c.id)}
                  className={`rounded-md border px-2 py-1.5 text-xs transition ${
                    captionStyle === c.id
                      ? "bg-gradient-to-r from-fuchsia-500/30 to-amber-400/30 border-fuchsia-400/60 text-white"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <label className={`mt-2 inline-flex items-center gap-2 text-xs cursor-pointer select-none ${captionStyle === "none" ? "opacity-50 cursor-not-allowed" : ""}`}>
              <input
                type="checkbox"
                checked={captionEmojis}
                disabled={captionStyle === "none"}
                onChange={(e) => setCaptionEmojis(e.target.checked)}
                className="h-3.5 w-3.5 accent-fuchsia-500"
              />
              <Smile className="h-3.5 w-3.5 text-amber-300" /> Add auto-emojis to captions
            </label>
          </div>
          <div>
            <Label className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Also dub into (batch)
              {!isPro && <span className="text-[10px] text-amber-300/80">Pro only 🔒</span>}
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LANGUAGES.filter((l) => l.code !== targetLanguage).map((l) => {
                const active = extraLanguages.includes(l.code);
                return (
                  <button
                    key={l.code}
                    type="button"
                    disabled={!isPro}
                    onClick={() =>
                      setExtraLanguages((prev) => (prev.includes(l.code) ? prev.filter((x) => x !== l.code) : [...prev, l.code]))
                    }
                    className={`rounded-full px-2.5 py-1 text-xs border transition ${
                      active
                        ? "bg-gradient-to-r from-fuchsia-500/30 to-amber-400/30 border-fuchsia-400/50 text-white"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    } ${!isPro ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
            {extraLanguages.length > 0 && (
              <div className="mt-2 text-[10px] text-fuchsia-300">
                Batch will generate {extraLanguages.length + 1} videos in one run.
              </div>
            )}
          </div>
          {!isPro && <p className="text-xs text-amber-300/80">{t("watermark_notice")} Free: {LIMITS.FREE_DUBS} dubs up to {LIMITS.FREE_DUB_MAX_SECONDS}s each.</p>}
          </div>
          <Button type="submit" disabled={loading} className="mt-4 w-full bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">
            {loading
              ? batchProgress
                ? `Batch ${batchProgress.done}/${batchProgress.total}…`
                : t("processing")
              : extraLanguages.length > 0
              ? `Generate ${extraLanguages.length + 1} dubs`
              : t("generate")}
          </Button>
        </form>

        {(loading || result || batchResults) && (
          <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 min-w-0 h-full flex flex-col">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-fuchsia-300/80 font-semibold">Result</div>
                <h2 className="text-lg font-semibold">
                  {loading
                    ? batchProgress
                      ? `Generating ${batchProgress.total} dubs — ${batchProgress.done} done`
                      : "Generating your video…"
                    : batchResults
                    ? `Your ${batchResults.length} dubbed videos`
                    : "Your dubbed video"}
                </h2>
              </div>
              {!loading && (
                <Button type="button" variant="outline" size="sm" onClick={() => { resetAll(); setBatchResults(null); setExtraLanguages([]); }} className="border-white/15 bg-white/5 hover:bg-white/10 shrink-0">
                  <RotateCcw className="h-4 w-4 mr-1" /> New
                </Button>
              )}
            </div>

            {loading ? (
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden animate-fade-in flex-1 flex flex-col">
                <div className="relative aspect-[9/16] bg-black overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/10 to-white/5 animate-pulse" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="absolute inset-0 rounded-full bg-fuchsia-400/40 blur-lg animate-pulse" />
                    </div>
                    <div className="text-xs text-slate-300 font-medium">Dubbing in progress…</div>
                    <div className="text-[10px] text-slate-500">
                      {batchProgress ? `Language ${batchProgress.done + 1} of ${batchProgress.total}` : "This may take a few moments"}
                    </div>
                    {muxProgress !== null && (
                      <div className="mt-2 w-3/4 max-w-[220px]">
                        <div className="text-[10px] text-fuchsia-300 mb-1 text-center">
                          Rendering dubbed short in your browser… {Math.round(muxProgress * 100)}%
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-fuchsia-500 to-amber-400 transition-[width] duration-200"
                            style={{ width: `${Math.max(4, Math.round(muxProgress * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  <div className="h-3 w-3/4 bg-white/10 rounded animate-pulse" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-8 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-8 w-full bg-white/10 rounded animate-pulse" />
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                    <div className="h-2 w-1/2 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-full bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-5/6 bg-white/10 rounded animate-pulse" />
                    <div className="h-3 w-2/3 bg-fuchsia-500/20 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1">
                <VideoResult videos={displayBatchResults ?? [displayResult]} isPro={isPro} embedded />
              </div>
            )}
          </aside>
        )}
        </div>

        <ProcessingProgress active={loading} stages={DUB_STAGES} boundaries={DUB_BOUNDARIES} duration={4200} skeletonCount={1} />
      </main>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
