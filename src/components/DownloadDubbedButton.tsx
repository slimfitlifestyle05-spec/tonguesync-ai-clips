import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, X, Sparkles, Play, Pause, Subtitles } from "lucide-react";
import { toast } from "sonner";

type Segment = { start: number; end: number; text?: string; audioDataUrl: string };

type Phase = "idle" | "loading-core" | "fetching" | "mixing" | "done";

export type CaptionStyle = "none" | "classic" | "tiktok" | "neon" | "karaoke" | "minimal";

// ASS/SRT force_style strings per caption look (colors are &HAABBGGRR).
const CAPTION_STYLES: Record<Exclude<CaptionStyle, "none">, string> = {
  classic:
    "Fontname=Arial,Fontsize=22,Bold=1,PrimaryColour=&Hffffff&,OutlineColour=&H80000000&,BorderStyle=3,Outline=1,Shadow=0,MarginV=40",
  tiktok:
    "Fontname=Arial,Fontsize=26,Bold=1,PrimaryColour=&H00f6ff&,OutlineColour=&H000000&,BorderStyle=1,Outline=3,Shadow=0,MarginV=60",
  neon:
    "Fontname=Arial,Fontsize=24,Bold=1,PrimaryColour=&Hffffff&,OutlineColour=&Hff40e0&,BorderStyle=1,Outline=3,Shadow=1,MarginV=60",
  karaoke:
    "Fontname=Arial,Fontsize=24,Bold=1,PrimaryColour=&H000000&,BackColour=&H0080ff&,OutlineColour=&H000000&,BorderStyle=4,Outline=6,Shadow=0,MarginV=60",
  minimal:
    "Fontname=Arial,Fontsize=18,PrimaryColour=&Hffffff&,OutlineColour=&H80000000&,BorderStyle=3,Outline=1,Shadow=0,MarginV=32",
};

// Very small keyword → emoji dictionary. Injects one emoji at the end of a
// caption line when we spot a matching keyword. Keeps captions lively without
// hitting an external API.
const EMOJI_MAP: Array<[RegExp, string]> = [
  [/\b(love|heart|amor|amour|liebe|حب|❤)\b/i, "❤️"],
  [/\b(fire|hot|🔥|نار|رهيب|awesome)\b/i, "🔥"],
  [/\b(money|cash|dollar|revenue|price|pricing|فلوس|مال|سعر)\b/i, "💰"],
  [/\b(win|winner|victory|success|فوز|نجاح)\b/i, "🏆"],
  [/\b(idea|think|brain|فكرة)\b/i, "💡"],
  [/\b(fast|speed|quick|سريع|بسرعة)\b/i, "⚡"],
  [/\b(secret|hidden|reveal|سر|خفي)\b/i, "🤫"],
  [/\b(learn|teach|lesson|class|تعلم|درس)\b/i, "📚"],
  [/\b(video|watch|show|فيديو|شاهد)\b/i, "🎬"],
  [/\b(music|song|sing|موسيقى|أغنية)\b/i, "🎵"],
  [/\b(happy|smile|joy|فرح|سعيد)\b/i, "😄"],
  [/\b(sad|cry|tear|حزين|بكاء)\b/i, "😢"],
  [/\b(surprise|wow|شگفت|واو|مذهل)\b/i, "😲"],
  [/\b(warning|danger|alert|تحذير|خطر)\b/i, "⚠️"],
  [/\b(rocket|launch|scale|grow|إطلاق|نمو)\b/i, "🚀"],
  [/\b(time|clock|hour|وقت|ساعة)\b/i, "⏰"],
  [/\b(question|why|how|كيف|لماذا)\b/i, "❓"],
  [/\b(check|done|ready|جاهز|تم)\b/i, "✅"],
];

function addEmoji(text: string): string {
  for (const [rx, emoji] of EMOJI_MAP) {
    if (rx.test(text)) return text.endsWith(emoji) ? text : `${text} ${emoji}`;
  }
  return text;
}

function toSrtTime(seconds: number) {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function segmentsToSrt(segments: Segment[]) {
  return segments
    .map((s, i) => `${i + 1}\n${toSrtTime(s.start)} --> ${toSrtTime(s.end)}\n${(s.text ?? "").replace(/\r?\n/g, " ")}\n`)
    .join("\n");
}

/**
 * Client-side muxer with:
 *   - phased progress bar (loading ffmpeg core → fetching assets → mixing)
 *   - cancel button (AbortController + ffmpeg.terminate)
 *   - optional per-segment lip-sync: each dubbed sentence is placed at its
 *     exact source timestamp via `adelay`, then mixed over the ducked
 *     original — so the new voice lands on the original speaker's mouth.
 *   - optional burn-in subtitles from segments (SRT generated in memory).
 *   - EBU R128 loudness normalization on every mix so exports match the
 *     -16 LUFS streaming target.
 *   - inline synced preview player (source video + dubbed audio) so users
 *     review the result before spending time on the full mux.
 */
export function DownloadDubbedButton({
  videoUrl,
  audioUrl,
  segments,
  filename = "dubbed.mp4",
  clipStart,
  clipEnd,
  autoRender = true,
  onRendered,
  captionStyle: initialCaptionStyle = "none",
  captionEmojis: initialCaptionEmojis = false,
}: {
  videoUrl?: string | null;
  audioUrl?: string | null;
  segments?: Segment[] | null;
  filename?: string;
  clipStart?: number | null;
  clipEnd?: number | null;
  autoRender?: boolean;
  onRendered?: (url: string) => void;
  captionStyle?: CaptionStyle;
  captionEmojis?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(initialCaptionStyle);
  const [captionEmojis, setCaptionEmojis] = useState<boolean>(initialCaptionEmojis);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [renderedUrl, setRenderedUrl] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const ffmpegRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canceledRef = useRef(false);
  const autoStartedRef = useRef(false);

  const hasSegments = Array.isArray(segments) && segments.length > 0;

  function reset() {
    setPhase("idle");
    setPct(0);
    setLabel("");
    ffmpegRef.current = null;
    abortRef.current = null;
    canceledRef.current = false;
  }

  function cancel() {
    canceledRef.current = true;
    try { abortRef.current?.abort(); } catch {}
    try { ffmpegRef.current?.terminate(); } catch {}
    toast("Canceled");
    reset();
  }

  // Fetch a URL with byte-level progress into a Uint8Array.
  async function fetchWithProgress(url: string, signal: AbortSignal, onPct: (p: number) => void): Promise<Uint8Array> {
    const isRemote = /^https?:\/\//i.test(url);
    if (/^data:/i.test(url)) {
      // Decode data: URLs synchronously — avoids window.fetch, which some
      // browser extensions (Ant Video Downloader) hijack and break.
      const comma = url.indexOf(",");
      const meta = url.slice(5, comma);
      const payload = url.slice(comma + 1);
      const isBase64 = /;base64/i.test(meta);
      const raw = isBase64 ? atob(payload) : decodeURIComponent(payload);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      onPct(100);
      return bytes;
    }
    const sameOrigin =
      isRemote && typeof window !== "undefined" && url.startsWith(window.location.origin);
    // Route cross-origin HTTP(S) fetches through our /api/public/proxy so
    // ffmpeg.wasm can read videos/audios from origins without CORS headers.
    const fetchUrl =
      isRemote && !sameOrigin
        ? `/api/public/proxy?url=${encodeURIComponent(url)}`
        : url;

    // Use XMLHttpRequest instead of fetch: some browser extensions (Ant Video
    // Downloader, ad-blockers, antivirus) wrap window.fetch and reject binary
    // media requests with a bare "TypeError: Failed to fetch" — XHR bypasses
    // those hooks and also gives us reliable progress on non-chunked responses.
    const download = (target: string) =>
      new Promise<Uint8Array>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", target, true);
        xhr.responseType = "arraybuffer";
        xhr.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            onPct(Math.min(99, Math.round((e.loaded / e.total) * 100)));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            onPct(100);
            resolve(new Uint8Array(xhr.response as ArrayBuffer));
          } else {
            reject(new Error(`Fetch ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
        const abortHandler = () => { try { xhr.abort(); } catch {} };
        if (signal.aborted) abortHandler();
        else signal.addEventListener("abort", abortHandler, { once: true });
        xhr.send();
      });

    try {
      return await download(fetchUrl);
    } catch (err: any) {
      // If the direct URL failed and we didn't already proxy, retry via proxy.
      if (isRemote && fetchUrl === url) {
        return await download(`/api/public/proxy?url=${encodeURIComponent(url)}`);
      }
      // Last-resort fallback: try native fetch (works for same-origin, blob:,
      // and cases where XHR was blocked by an extension).
      try {
        const res = await fetch(fetchUrl, { signal });
        if (!res.ok) throw new Error(`Fetch ${res.status}`);
        const buf = await res.arrayBuffer();
        onPct(100);
        return new Uint8Array(buf);
      } catch {}
      throw err;
    }
  }

  async function renderMux({ downloadAfter }: { downloadAfter: boolean }): Promise<string | null> {
    if (!videoUrl || !audioUrl) { toast.error("Need both source video and dubbed audio"); return null; }
    if (/^upload:\/\//i.test(videoUrl)) {
      toast.error("Please re-select the source video, then export again.");
      return null;
    }
    canceledRef.current = false;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const wantBurn = captionStyle !== "none" && hasSegments;
    const hasClip = typeof clipStart === "number" && typeof clipEnd === "number" && clipEnd > clipStart;

    try {
      // 1) Load ffmpeg.wasm with real download progress on the core files.
      setPhase("loading-core");
      setLabel("Rendering your dubbed short video in the browser…");
      setPct(0);
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      setPct(10);
      // Fetch ffmpeg core via XHR (not @ffmpeg/util `toBlobURL`, which uses
      // window.fetch — some browser extensions like Ant Video Downloader
      // hijack fetch and reject binary requests with "Failed to fetch").
      const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
      const [coreBytes, wasmBytes] = await Promise.all([
        fetchWithProgress(`${base}/ffmpeg-core.js`, signal, () => {}),
        fetchWithProgress(`${base}/ffmpeg-core.wasm`, signal, () => {}),
      ]);
      const coreURL = URL.createObjectURL(
        new Blob([coreBytes.buffer as ArrayBuffer], { type: "text/javascript" }),
      );
      const wasmURL = URL.createObjectURL(
        new Blob([wasmBytes.buffer as ArrayBuffer], { type: "application/wasm" }),
      );
      if (canceledRef.current) return null;
      setPct(45);
      await ffmpeg.load({ coreURL, wasmURL });
      // Do NOT revoke the blob URLs — the ffmpeg worker may re-import them
      // if it needs to reinitialize during long muxes, which is what caused
      // the "failed to import ffmpeg-core.js" error mid-render.

      // 2) Fetch source video + dubbed audio(s).
      setPhase("fetching");
      setLabel("Rendering your dubbed short video in the browser…");
      const videoBytes = await fetchWithProgress(videoUrl, signal, (p) => setPct(50 + Math.round(p * 0.15)));
      if (canceledRef.current) return null;
      await ffmpeg.writeFile("in.mp4", videoBytes);

      const useSegments = Array.isArray(segments) && segments.length > 1;
      const audioTracks: Array<{ file: string; delayMs: number }> = [];
      if (useSegments) {
        setLabel(`Downloading ${segments!.length} dubbed segments…`);
        for (let i = 0; i < segments!.length; i++) {
          const s = segments![i];
          const bytes = await fetchWithProgress(s.audioDataUrl, signal, (p) => {
            const perSeg = 15 / segments!.length;
            setPct(65 + Math.round((i * perSeg) + (p / 100) * perSeg));
          });
          if (canceledRef.current) return null;
          const name = `dub_${i}.mp3`;
          await ffmpeg.writeFile(name, bytes);
          audioTracks.push({ file: name, delayMs: Math.max(0, Math.round(s.start * 1000)) });
        }
      } else {
        setLabel("Downloading dubbed audio…");
        const dubBytes = await fetchWithProgress(audioUrl, signal, (p) => setPct(65 + Math.round(p * 0.15)));
        if (canceledRef.current) return null;
        await ffmpeg.writeFile("dub.mp3", dubBytes);
        audioTracks.push({ file: "dub.mp3", delayMs: 0 });
      }

      // Write SRT for burn-in when the user asked and we have segments.
      if (wantBurn) {
        const styled: Segment[] = segments!.map((s) => ({
          ...s,
          text: captionEmojis ? addEmoji(s.text ?? "") : (s.text ?? ""),
        }));
        const srt = segmentsToSrt(styled);
        await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(srt));
      }

      // 3) Mix with ffmpeg — progress driven by ffmpeg's own progress event.
      setPhase("mixing");
      setLabel("Rendering your dubbed short video in the browser…");
      ffmpeg.on("progress", ({ progress }) => {
        setPct(80 + Math.min(19, Math.round(progress * 19)));
      });

      // Build filter graph: DROP the original audio entirely (spec: original
      // completely muted and replaced with the dubbed track) and delay each
      // dubbed track to its segment start, then amix + EBU R128 loudnorm.
      const inputs: string[] = ["-i", "in.mp4"];
      audioTracks.forEach((t) => inputs.push("-i", t.file));
      const filterParts: string[] = [];
      const mixLabels: string[] = [];
      audioTracks.forEach((t, i) => {
        const idx = i + 1; // input index; 0 is video
        const lbl = `v${i}`;
        const delay = t.delayMs;
        filterParts.push(`[${idx}:a]adelay=${delay}|${delay},volume=1.0[${lbl}]`);
        mixLabels.push(`[${lbl}]`);
      });
      if (mixLabels.length > 1) {
        filterParts.push(
          `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=0:normalize=0[amix]`,
          `[amix]loudnorm=I=-16:LRA=11:TP=-1.5[aout]`,
        );
      } else {
        filterParts.push(`${mixLabels[0]}loudnorm=I=-16:LRA=11:TP=-1.5[aout]`);
      }

      // Video map: fast stream-copy by default; re-encode with libx264 when
      // burning subtitles or trimming to Gemini timestamps.
      const needsReencode = wantBurn || hasClip;
      const styleString =
        wantBurn && captionStyle !== "none" ? CAPTION_STYLES[captionStyle] : "";
      const videoArgs = wantBurn
        ? [
            "-filter_complex",
            filterParts.join(";") +
              `;[0:v]subtitles=subs.srt:force_style='${styleString}'[vout]`,
            "-map", "[vout]",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "20",
          ]
        : [
            "-filter_complex", filterParts.join(";"),
            "-map", "0:v",
            "-c:v", needsReencode ? "libx264" : "copy",
            ...(needsReencode ? ["-preset", "veryfast", "-crf", "20"] : []),
          ];

      // Optional trim to the Gemini-provided clip range (client-side clipping).
      const trimArgs: string[] = hasClip
        ? ["-ss", String(clipStart), "-to", String(clipEnd)]
        : [];

      await ffmpeg.exec([
        ...inputs,
        ...videoArgs,
        "-map", "[aout]",
        "-c:a", "aac",
        "-b:a", "192k",
        ...trimArgs,
        "-shortest",
        "out.mp4",
      ]);
      if (canceledRef.current) return null;

      const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setRenderedUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
      try { onRendered?.(url); } catch {}
      if (downloadAfter) {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setPct(100);
      setPhase("done");
      toast.success(
        (useSegments ? "Lip-synced" : "Dubbed") + (wantBurn ? " + subtitled" : "") + " video ready",
      );
      setTimeout(reset, 1200);
      return url;
    } catch (e: any) {
      if (canceledRef.current || e?.name === "AbortError") { reset(); return null; }
      console.error("[dub-mux]", e);
      toast.error(e?.message ?? "Muxing failed");
      reset();
      return null;
    }
  }

  async function handleClick() {
    if (renderedUrl) {
      const a = document.createElement("a");
      a.href = renderedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    await renderMux({ downloadAfter: true });
  }

  // Auto-render the merged MP4 as soon as we have both video + audio so the
  // user sees the finished result in an inline dashboard-style player without
  // any extra click.
  useEffect(() => {
    if (!autoRender) return;
    if (autoStartedRef.current) return;
    if (!videoUrl || !audioUrl) return;
    autoStartedRef.current = true;
    void renderMux({ downloadAfter: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl, audioUrl, autoRender]);

  // Preview: play source video muted + dubbed audio in sync.
  async function togglePreview() {
    const v = previewVideoRef.current;
    const a = previewAudioRef.current;
    if (!v || !a) return;
    if (previewPlaying) {
      v.pause();
      a.pause();
      setPreviewPlaying(false);
      return;
    }
    v.currentTime = 0;
    a.currentTime = 0;
    v.muted = true;
    try {
      await Promise.all([v.play(), a.play()]);
      setPreviewPlaying(true);
    } catch {
      toast.error("Preview blocked by browser");
    }
  }

  if (!audioUrl) return null;
  const busy = phase !== "idle" && phase !== "done";
  const hasLipSync = Array.isArray(segments) && segments.length > 1;

  return (
    <div className="space-y-2">
      {renderedUrl ? (
        <div className="rounded-lg border border-emerald-400/30 bg-black overflow-hidden">
          <video
            src={renderedUrl}
            controls
            playsInline
            className="w-full aspect-[9/16] object-cover bg-black"
          />
          <div className="p-2 text-[10px] text-emerald-300 text-center">
            Rendered in your browser · original audio muted, replaced with dubbed track
          </div>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          disabled={busy || !videoUrl}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-xs font-medium"
        >
          <Play className="h-3.5 w-3.5" /> {previewOpen ? "Hide preview" : "Preview before export"}
        </button>
        {hasSegments ? (
          <label className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={burnSubs}
              onChange={(e) => setBurnSubs(e.target.checked)}
              disabled={busy}
              className="h-3 w-3 accent-emerald-500"
            />
            <Subtitles className="h-3.5 w-3.5" /> Burn subtitles
          </label>
        ) : null}
      </div>

      {previewOpen && videoUrl ? (
        <div className="rounded-lg border border-white/10 bg-black overflow-hidden">
          <div className="relative">
            <video ref={previewVideoRef} src={videoUrl} className="w-full aspect-[9/16] object-cover" muted playsInline />
            <audio
              ref={previewAudioRef}
              src={audioUrl}
              onEnded={() => setPreviewPlaying(false)}
              onPause={() => setPreviewPlaying(false)}
            />
            <button
              type="button"
              onClick={togglePreview}
              className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black">
                {previewPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </span>
            </button>
          </div>
          <div className="p-2 text-[10px] text-slate-400 text-center">
            Source video (muted) + dubbed audio · a rough preview of the final mix
          </div>
        </div>
      ) : null}

      <Button
        size="sm"
        onClick={handleClick}
        disabled={busy || !videoUrl}
        className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90"
      >
        {busy ? (
          <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {pct}%</>
        ) : (
          <>
            <Download className="h-4 w-4 mr-1" />
            {renderedUrl ? "Download dubbed MP4" : "Render & download dubbed MP4"}
            {hasLipSync && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-bold">
                <Sparkles className="h-2.5 w-2.5" /> LIP-SYNC
              </span>
            )}
          </>
        )}
      </Button>
      {busy && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald-200 truncate">{label}</span>
            <button
              type="button"
              onClick={cancel}
              className="ml-2 inline-flex items-center gap-0.5 rounded bg-white/10 px-1.5 py-0.5 text-slate-200 hover:bg-white/20"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}