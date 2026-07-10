// Client-side clipping: slice an uploaded video file into N short segments
// entirely in the browser using ffmpeg.wasm. Returns blob URLs so the
// results page plays real cuts of the user's own video (not samples).

import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "./video-mux-client";

export type ClipSlice = {
  index: number;
  start: number;
  end: number;
  url: string;
  blob: Blob;
};

export type VideoCutWindow = {
  start: number;
  end: number;
};

export type ResolvedVideoSource = {
  blob: Blob;
  name: string;
  url: string;
};

const DIRECT_VIDEO_EXT = /\.(mp4|mov|m4v|webm|ogg)(\?|#|$)/i;
const VIDEO_PAGE_HOST = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com|facebook\.com|drive\.google\.com)/i;

export async function fetchVideoBlobFromUrl(sourceUrl: string): Promise<ResolvedVideoSource> {
  const url = sourceUrl.trim();
  if (!url) throw new Error("Paste a direct video file link or upload the video.");

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Paste a valid video URL or upload the video file.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only secure http/https video links can be processed.");
  }

  const hasVideoExtension = DIRECT_VIDEO_EXT.test(parsed.pathname + parsed.search);
  if (!hasVideoExtension && VIDEO_PAGE_HOST.test(parsed.hostname)) {
    throw new Error("This is a video page link, not the raw video file. Upload the original video so the shorts are cut from it exactly.");
  }

  let response: Response;
  try {
    response = await fetch(url, { mode: "cors" });
  } catch {
    throw new Error("I can't download this link in the browser. Upload the original video file to cut real shorts from it.");
  }

  if (!response.ok) {
    throw new Error("This video link could not be downloaded. Upload the file instead.");
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!contentType.startsWith("video/") && !hasVideoExtension) {
    throw new Error("This link doesn't expose a video file. Upload the original video to cut exact shorts.");
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error("The downloaded video file is empty. Upload the original file instead.");

  const nameFromPath = decodeURIComponent(parsed.pathname.split("/").pop() || "linked-video.mp4");
  return {
    blob: blob.type ? blob : new Blob([blob], { type: contentType || "video/mp4" }),
    name: nameFromPath,
    url,
  };
}

export async function getVideoDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) && d > 0 ? d : 0);
    };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(0);
    setTimeout(() => done(v.duration || 0), 6000);
  });
}

export async function extractAnalysisAudio(
  file: File | Blob,
  opts: { maxSeconds?: number; onProgress?: (ratio: number, msg?: string) => void } = {},
): Promise<Blob> {
  const { maxSeconds = 300, onProgress } = opts;
  const ff = await getFFmpeg((m) => onProgress?.(-1, m));
  const nonce = Math.random().toString(36).slice(2, 8);
  const inputName = `analysis_src_${nonce}.mp4`;
  const outName = `analysis_${nonce}.wav`;
  onProgress?.(0, "Preparing audio for Gemini…");
  await ff.writeFile(inputName, await fetchFile(file));
  try {
    await ff.exec([
      "-i", inputName,
      "-t", String(maxSeconds),
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-f", "wav",
      "-y",
      outName,
    ]);
    const data = (await ff.readFile(outName)) as Uint8Array;
    const buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(data);
    return new Blob([buf], { type: "audio/wav" });
  } finally {
    try { await ff.deleteFile(inputName); } catch {}
    try { await ff.deleteFile(outName); } catch {}
  }
}

/**
 * Pick `count` evenly-spaced segments across the video, each up to
 * `maxLenSeconds` long. Falls back to fixed offsets when duration is unknown.
 */
function normalizeWindows(
  windows: VideoCutWindow[] | undefined,
  duration: number,
  count: number,
  maxLenSeconds: number,
) {
  if (!windows?.length) return null;
  const maxEnd = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  const cleaned = windows
    .map((w) => {
      const start = Math.max(0, Number(w.start) || 0);
      const rawEnd = Math.max(start + 1, Number(w.end) || start + maxLenSeconds);
      const end = Math.min(maxEnd, start + maxLenSeconds, rawEnd);
      return { start: Math.floor(start * 100) / 100, end: Math.floor(end * 100) / 100 };
    })
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start)
    .slice(0, count);
  return cleaned.length ? cleaned : null;
}

function pickWindows(duration: number, count: number, maxLenSeconds: number) {
  const windows: Array<{ start: number; end: number }> = [];
  if (duration <= 0) {
    for (let i = 0; i < count; i++) {
      const start = i * maxLenSeconds;
      windows.push({ start, end: start + maxLenSeconds });
    }
    return windows;
  }
  const target = Math.min(maxLenSeconds, Math.max(8, Math.floor(duration / (count + 1))));
  const usable = Math.max(0, duration - target);
  for (let i = 0; i < count; i++) {
    const start = Math.floor((usable * (i + 1)) / (count + 1));
    windows.push({ start, end: Math.min(duration, start + target) });
  }
  return windows;
}

export async function sliceIntoClips(
  file: File | Blob,
  count = 3,
  opts: {
    maxLenSeconds?: number;
    analysisWindowSeconds?: number;
    windows?: VideoCutWindow[];
    onProgress?: (ratio: number, msg?: string) => void;
  } = {},
): Promise<ClipSlice[]> {
  const { maxLenSeconds = 30, analysisWindowSeconds = 300, windows: requestedWindows, onProgress } = opts;
  const ff = await getFFmpeg((m) => onProgress?.(-1, m));
  const duration = await getVideoDuration(file);
  const effectiveDuration = duration > 0 ? Math.min(duration, analysisWindowSeconds) : 0;
  const windows = normalizeWindows(requestedWindows, effectiveDuration || duration, count, maxLenSeconds) ?? pickWindows(effectiveDuration, count, maxLenSeconds);

  const nonce = Math.random().toString(36).slice(2, 8);
  const inputName = `clip_src_${nonce}.mp4`;
  await ff.writeFile(inputName, await fetchFile(file));

  const out: ClipSlice[] = [];
  for (let i = 0; i < windows.length; i++) {
    const { start, end } = windows[i];
    const len = Math.max(1, end - start);
    const outName = `clip_${nonce}_${i}.mp4`;
    onProgress?.(i / windows.length, `Cutting clip ${i + 1}/${windows.length}`);
    const preciseArgs = [
      "-i", inputName,
      "-ss", String(start),
      "-t", String(len),
      "-map", "0:v:0",
      "-map", "0:a?",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      "-y",
      outName,
    ];
    try {
      // Decode-accurate seek: cuts the exact Gemini timestamp, high visual quality.
      await ff.exec(preciseArgs);
    } catch (e) {
      // Fallback to stream copy if re-encoding fails on an unusual input.
      await ff.exec([
        "-ss", String(start),
        "-i", inputName,
        "-t", String(len),
        "-map", "0:v:0",
        "-map", "0:a?",
        "-c", "copy",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        "-y",
        outName,
      ]);
    }
    const data = (await ff.readFile(outName)) as Uint8Array;
    const buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(data);
    const blob = new Blob([buf], { type: "video/mp4" });
    out.push({ index: i, start, end: start + len, url: URL.createObjectURL(blob), blob });
    try { await ff.deleteFile(outName); } catch {}
  }
  try { await ff.deleteFile(inputName); } catch {}
  onProgress?.(1, "Done");
  return out;
}