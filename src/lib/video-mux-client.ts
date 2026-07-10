// Client-side muxing: replace the video's original audio with a set of
// timestamped Cartesia MP3 segments — 100% in the browser using ffmpeg.wasm.
// No VPS backend required. Returns a Blob URL of the muxed MP4 that the UI
// can preview and download.

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let _ff: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

export async function getFFmpeg(onLog?: (m: string) => void): Promise<FFmpeg> {
  if (_ff) return _ff;
  if (_loading) return _loading;
  _loading = (async () => {
    const ff = new FFmpeg();
    if (onLog) ff.on("log", ({ message }) => onLog(message));
    // singleThread core — works without SharedArrayBuffer / COOP+COEP.
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    _ff = ff;
    return ff;
  })();
  return _loading;
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const [, b64] = dataUrl.split(",", 2);
  const bin = atob(b64 || "");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type MuxSegment = { start: number; audioDataUrl: string };

/**
 * Mux `videoFile` with dubbed audio segments in the browser.
 * The original audio track is muted and replaced with the merged Cartesia mix.
 */
export async function muxDubbedVideo(
  videoFile: File | Blob,
  segments: MuxSegment[],
  onProgress?: (ratio: number, message?: string) => void,
): Promise<{ url: string; blob: Blob }> {
  const ff = await getFFmpeg((m) => onProgress?.(-1, m));
  ff.on("progress", ({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress))));

  const inputName = "input.mp4";
  await ff.writeFile(inputName, await fetchFile(videoFile));

  const inputs: string[] = ["-i", inputName];
  const filterParts: string[] = [];
  const mixed: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const name = `s${i}.mp3`;
    await ff.writeFile(name, dataUrlToUint8(seg.audioDataUrl));
    inputs.push("-i", name);
    const delayMs = Math.max(0, Math.round(seg.start * 1000));
    // adelay per-channel; apad extends so amix mixes across the full timeline
    filterParts.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs},apad[a${i}]`);
    mixed.push(`[a${i}]`);
  }

  const filter =
    segments.length > 0
      ? `${filterParts.join(";")};${mixed.join("")}amix=inputs=${segments.length}:normalize=0:dropout_transition=0[aout]`
      : "";

  const outName = "out.mp4";
  const args: string[] = [
    ...inputs,
    ...(filter ? ["-filter_complex", filter, "-map", "0:v:0", "-map", "[aout]"] : ["-map", "0:v:0", "-an"]),
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "160k",
    "-shortest",
    "-movflags", "+faststart",
    "-y",
    outName,
  ];

  try {
    await ff.exec(args);
  } catch (e) {
    // Some containers (webm, mismatched codecs) can't -c:v copy. Retry with re-encode.
    const retry = args.map((a) => a);
    const idx = retry.indexOf("copy");
    if (idx >= 0) retry[idx] = "libx264";
    retry.splice(retry.indexOf("-c:v"), 0, "-preset", "ultrafast");
    await ff.exec(retry);
  }

  const data = (await ff.readFile(outName)) as Uint8Array;
  // Best-effort cleanup
  try { await ff.deleteFile(inputName); } catch {}
  try { await ff.deleteFile(outName); } catch {}
  for (let i = 0; i < segments.length; i++) {
    try { await ff.deleteFile(`s${i}.mp3`); } catch {}
  }

  const buf = new ArrayBuffer(data.byteLength);
  new Uint8Array(buf).set(data);
  const blob = new Blob([buf], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);
  return { url, blob };
}