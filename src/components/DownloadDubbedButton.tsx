import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Client-side muxer: fetches the source video + the dubbed audio (data URL or
 * remote), then uses ffmpeg.wasm to duck the original track (-18dB) and mix
 * the dubbed voice on top, producing a downloadable MP4. Loaded lazily so the
 * 30MB wasm blob never enters the initial bundle.
 */
export function DownloadDubbedButton({
  videoUrl,
  audioUrl,
  filename = "dubbed.mp4",
}: {
  videoUrl?: string | null;
  audioUrl?: string | null;
  filename?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  async function toU8(url: string): Promise<Uint8Array> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }

  async function handleClick() {
    if (!videoUrl || !audioUrl) {
      toast.error("Need both source video and dubbed audio");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => setProgress(Math.round(progress * 100)));
      const base = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ffmpeg.load({
        coreURL: `${base}/ffmpeg-core.js`,
        wasmURL: `${base}/ffmpeg-core.wasm`,
      });
      const [videoBytes, audioBytes] = await Promise.all([toU8(videoUrl), toU8(audioUrl)]);
      await ffmpeg.writeFile("in.mp4", videoBytes);
      await ffmpeg.writeFile("dub.mp3", audioBytes);
      // Duck original -18dB, mix with dubbed voice, keep video stream as-is.
      await ffmpeg.exec([
        "-i", "in.mp4",
        "-i", "dub.mp3",
        "-filter_complex",
        "[0:a]volume=0.15[bg];[1:a]volume=1.6[voice];[bg][voice]amix=inputs=2:duration=longest:dropout_transition=0[aout]",
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "out.mp4",
      ]);
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
      toast.success("Dubbed video ready");
    } catch (e: any) {
      console.error("[dub-mux]", e);
      toast.error(e?.message ?? "Muxing failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  if (!audioUrl) return null;
  return (
    <Button
      size="sm"
      onClick={handleClick}
      disabled={busy || !videoUrl}
      className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90"
    >
      {busy ? (
        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Mixing {progress}%</>
      ) : (
        <><Download className="h-4 w-4 mr-1" /> Download dubbed MP4</>
      )}
    </Button>
  );
}