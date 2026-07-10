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

async function probeDuration(file: File | Blob): Promise<number> {
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

/**
 * Pick `count` evenly-spaced segments across the video, each up to
 * `maxLenSeconds` long. Falls back to fixed offsets when duration is unknown.
 */
function pickWindows(duration: number, count: number, maxLenSeconds: number) {
  const windows: Array<{ start: number; end: number }> = [];
  if (duration <= 0) {
    for (let i = 0; i < count; i++) {
      const start = i * (maxLenSeconds + 5);
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
  opts: { maxLenSeconds?: number; onProgress?: (ratio: number, msg?: string) => void } = {},
): Promise<ClipSlice[]> {
  const { maxLenSeconds = 30, onProgress } = opts;
  const ff = await getFFmpeg((m) => onProgress?.(-1, m));
  const duration = await probeDuration(file);
  const windows = pickWindows(duration, count, maxLenSeconds);

  const inputName = "clip_src.mp4";
  await ff.writeFile(inputName, await fetchFile(file));

  const out: ClipSlice[] = [];
  for (let i = 0; i < windows.length; i++) {
    const { start, end } = windows[i];
    const len = Math.max(1, end - start);
    const outName = `clip_${i}.mp4`;
    onProgress?.(i / windows.length, `Cutting clip ${i + 1}/${windows.length}`);
    const args = [
      "-ss", String(start),
      "-i", inputName,
      "-t", String(len),
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "26",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y",
      outName,
    ];
    try {
      await ff.exec(args);
    } catch (e) {
      // Retry with stream copy as a fallback
      await ff.exec([
        "-ss", String(start),
        "-i", inputName,
        "-t", String(len),
        "-c", "copy",
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