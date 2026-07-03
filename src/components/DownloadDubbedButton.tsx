import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Segment = { start: number; end: number; text?: string; audioDataUrl: string };

type Phase = "idle" | "loading-core" | "fetching" | "mixing" | "done";

/**
 * Client-side muxer with:
 *   - phased progress bar (loading ffmpeg core → fetching assets → mixing)
 *   - cancel button (AbortController + ffmpeg.terminate)
 *   - optional per-segment lip-sync: each dubbed sentence is placed at its
 *     exact source timestamp via `adelay`, then mixed over the ducked
 *     original — so the new voice lands on the original speaker's mouth.
 */
export function DownloadDubbedButton({
  videoUrl,
  audioUrl,
  segments,
  filename = "dubbed.mp4",
}: {
  videoUrl?: string | null;
  audioUrl?: string | null;
  segments?: Segment[] | null;
  filename?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [label, setLabel] = useState("");
  const ffmpegRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);
  const canceledRef = useRef(false);

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
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Fetch ${res.status}`);
    const total = Number(res.headers.get("content-length") || 0);
    if (!res.body || !total) {
      const buf = await res.arrayBuffer();
      onPct(100);
      return new Uint8Array(buf);
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onPct(Math.min(99, Math.round((received / total) * 100)));
      }
    }
    const out = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.byteLength; }
    onPct(100);
    return out;
  }

  async function handleClick() {
    if (!videoUrl || !audioUrl) { toast.error("Need both source video and dubbed audio"); return; }
    canceledRef.current = false;
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      // 1) Load ffmpeg.wasm with real download progress on the core files.
      setPhase("loading-core");
      setLabel("Loading ffmpeg engine…");
      setPct(0);
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      ffmpegRef.current = ffmpeg;
      const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      const coreBytes = await fetchWithProgress(`${base}/ffmpeg-core.js`, signal, (p) => setPct(Math.round(p * 0.15)));
      const wasmBytes = await fetchWithProgress(`${base}/ffmpeg-core.wasm`, signal, (p) => setPct(15 + Math.round(p * 0.35)));
      if (canceledRef.current) return;
      const coreURL = URL.createObjectURL(new Blob([coreBytes.buffer as ArrayBuffer], { type: "text/javascript" }));
      const wasmURL = URL.createObjectURL(new Blob([wasmBytes.buffer as ArrayBuffer], { type: "application/wasm" }));
      await ffmpeg.load({ coreURL, wasmURL });
      URL.revokeObjectURL(coreURL);
      URL.revokeObjectURL(wasmURL);

      // 2) Fetch source video + dubbed audio(s).
      setPhase("fetching");
      setLabel("Downloading source video…");
      const videoBytes = await fetchWithProgress(videoUrl, signal, (p) => setPct(50 + Math.round(p * 0.15)));
      if (canceledRef.current) return;
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
          if (canceledRef.current) return;
          const name = `dub_${i}.mp3`;
          await ffmpeg.writeFile(name, bytes);
          audioTracks.push({ file: name, delayMs: Math.max(0, Math.round(s.start * 1000)) });
        }
      } else {
        setLabel("Downloading dubbed audio…");
        const dubBytes = await fetchWithProgress(audioUrl, signal, (p) => setPct(65 + Math.round(p * 0.15)));
        if (canceledRef.current) return;
        await ffmpeg.writeFile("dub.mp3", dubBytes);
        audioTracks.push({ file: "dub.mp3", delayMs: 0 });
      }

      // 3) Mix with ffmpeg — progress driven by ffmpeg's own progress event.
      setPhase("mixing");
      setLabel(useSegments ? `Mixing ${audioTracks.length}-segment lip-sync…` : "Mixing dubbed audio…");
      ffmpeg.on("progress", ({ progress }) => {
        setPct(80 + Math.min(19, Math.round(progress * 19)));
      });

      // Build filter graph: duck original + delay each dubbed track to its
      // segment start, then amix. `normalize=0` keeps voice at full level.
      const inputs: string[] = ["-i", "in.mp4"];
      audioTracks.forEach((t) => inputs.push("-i", t.file));
      const filterParts: string[] = ["[0:a]volume=0.15[bg]"];
      const mixLabels: string[] = ["[bg]"];
      audioTracks.forEach((t, i) => {
        const idx = i + 1; // input index; 0 is video
        const lbl = `v${i}`;
        const delay = t.delayMs;
        filterParts.push(`[${idx}:a]adelay=${delay}|${delay},volume=1.6[${lbl}]`);
        mixLabels.push(`[${lbl}]`);
      });
      filterParts.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[aout]`);

      await ffmpeg.exec([
        ...inputs,
        "-filter_complex", filterParts.join(";"),
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "out.mp4",
      ]);
      if (canceledRef.current) return;

      const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setPct(100);
      setPhase("done");
      toast.success(useSegments ? "Lip-synced dubbed video ready" : "Dubbed video ready");
      setTimeout(reset, 1200);
    } catch (e: any) {
      if (canceledRef.current || e?.name === "AbortError") { reset(); return; }
      console.error("[dub-mux]", e);
      toast.error(e?.message ?? "Muxing failed");
      reset();
    }
  }

  if (!audioUrl) return null;
  const busy = phase !== "idle" && phase !== "done";
  const hasLipSync = Array.isArray(segments) && segments.length > 1;

  return (
    <div className="space-y-2">
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
            Download dubbed MP4
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