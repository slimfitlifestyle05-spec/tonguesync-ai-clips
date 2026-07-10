import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { lovableChat } from "./ai-gateway.server";

export type ClipPlanServer = {
  start: number;
  end: number;
  title: string;
  description: string;
  hashtags: string[];
  reason?: string;
};

const CLIP_PLAN_SYSTEM = `You are a senior short-form video editor and social strategist.
Analyze the uploaded video's first 5 minutes from its audio. Pick exactly 3 moments that would make the strongest Shorts/Reels/TikToks.

Rules:
- Return precise timestamps in seconds from the original media.
- Each clip must be 8 to 30 seconds long.
- Prefer complete ideas: start just before the hook, end after the payoff.
- Do not invent content that is not present in the media.
- Write professional English metadata for each selected moment.
- Hashtags: exactly 5, lowercase, each starts with #.

Return STRICT JSON only:
{ "clips": [ { "start": 12.4, "end": 36.8, "title": "...", "description": "...", "hashtags": ["#a","#b","#c","#d","#e"], "reason": "..." } ] }`;

function parseJsonObject(raw: string): any {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
  }
  return {};
}

function normalizeHashtags(input: any): string[] {
  return Array.isArray(input)
    ? input
        .map((h: any) => {
          const s = String(h).trim().toLowerCase().replace(/\s+/g, "");
          return s.startsWith("#") ? s : `#${s}`;
        })
        .filter((h: string) => h.length > 1)
        .slice(0, 5)
    : [];
}

function normalizePlans(parsed: any, count: number, duration: number): ClipPlanServer[] {
  const maxEnd = duration > 0 ? duration : Number.POSITIVE_INFINITY;
  return (Array.isArray(parsed?.clips) ? parsed.clips : [])
    .map((c: any) => {
      const start = Math.max(0, Math.min(maxEnd - 1, Number(c.start) || 0));
      const rawEnd = Number(c.end) || start + 20;
      const end = Math.max(start + 1, Math.min(maxEnd, rawEnd));
      return {
        start,
        end,
        title: String(c.title ?? "").trim(),
        description: String(c.description ?? "").trim(),
        hashtags: normalizeHashtags(c.hashtags),
        reason: String(c.reason ?? "").trim() || undefined,
      };
    })
    .filter((c: ClipPlanServer) => c.end > c.start && c.title && c.description && c.hashtags.length >= 3)
    .sort((a: ClipPlanServer, b: ClipPlanServer) => a.start - b.start)
    .slice(0, count);
}

function getPersonalGeminiKeys(): string[] {
  const raw = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.VITE_GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY_2,
  ];
  const keys: string[] = [];
  for (const k of raw) {
    if (typeof k === "string" && k.trim().length > 0) keys.push(k.trim());
  }
  return [...new Set(keys)];
}

async function planWithGeminiAudio(
  key: string,
  base64: string,
  mimeType: string,
  topic: string,
  count: number,
  duration: number,
): Promise<ClipPlanServer[]> {
  const prompt = `Video/project title: "${topic || "Uploaded video"}"\nMedia total duration: ${duration ? duration.toFixed(1) + "s" : "unknown"}.\nPick exactly ${count} real short clips from this media (first 5 minutes only).`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLIP_PLAN_SYSTEM }] },
        contents: [
          { role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] },
        ],
        generationConfig: { temperature: 0.25, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`gemini_audio_${res.status}: ${body.slice(0, 180)}`);
  }
  const json: any = await res.json();
  const raw = String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  return normalizePlans(parseJsonObject(raw), count, duration);
}

async function transcribeViaGateway(bytes: Buffer, mime: string): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) return "";
  const extMap: Record<string, string> = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  const ext = extMap[mime] ?? "wav";
  const form = new FormData();
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: mime }), `analysis.${ext}`);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}` },
    body: form,
  });
  if (!res.ok) return "";
  const json: any = await res.json().catch(() => ({}));
  return typeof json?.text === "string" ? json.text.trim() : "";
}

async function planFromTranscript(
  transcript: string,
  topic: string,
  count: number,
  duration: number,
): Promise<ClipPlanServer[]> {
  const total = duration > 0 ? duration : 60;
  const user = `Topic: "${topic || "Uploaded video"}"
Total media duration: ${total.toFixed(1)}s.
Transcript of the media (may be imperfect, no per-word timestamps):
"""${transcript.slice(0, 6000)}"""

Pick exactly ${count} short clip moments (8–30s each) spread across the media that would perform best as Shorts.
If exact timing is unclear, distribute them at roughly the 20%, 50%, and 80% points of the duration.
Return STRICT JSON only in the schema described in the system prompt.`;
  const raw = await lovableChat(
    [
      { role: "system", content: CLIP_PLAN_SYSTEM },
      { role: "user", content: user },
    ],
    { model: "google/gemini-2.5-flash", temperature: 0.3, maxTokens: 1400 },
  );
  return normalizePlans(parseJsonObject(raw), count, total);
}

function evenlySpacedPlans(topic: string, count: number, duration: number): ClipPlanServer[] {
  const total = duration > 0 ? duration : count * 30;
  const clipLen = Math.min(30, Math.max(15, Math.floor(total / (count + 1))));
  const out: ClipPlanServer[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor((total * (i + 1)) / (count + 1) - clipLen / 2);
    const clampedStart = Math.max(0, Math.min(total - clipLen, start));
    out.push({
      start: clampedStart,
      end: clampedStart + clipLen,
      title: `${topic || "Highlight"} — Part ${i + 1}`,
      description: "Auto-selected highlight from your video.",
      hashtags: ["#shorts", "#viral", "#reels", "#tiktok", "#foryou"],
      reason: "Fallback evenly-spaced window (AI unavailable).",
    });
  }
  return out;
}

export const planClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        base64: z.string().min(1),
        mimeType: z.string().min(1).max(100),
        topic: z.string().max(300).default(""),
        count: z.number().int().min(1).max(6).default(3),
        durationSeconds: z.number().min(0).max(60 * 60 * 4).default(0),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > 20 * 1024 * 1024) {
      throw new Error("Audio payload too large for analysis (20MB max).");
    }
    const mime = data.mimeType.split(";")[0].trim() || "audio/wav";

    // 1) Best path — Gemini inline audio (personal key required)
    const keys = getPersonalGeminiKeys();
    for (const key of keys) {
      try {
        const plans = await planWithGeminiAudio(key, data.base64, mime, data.topic, data.count, data.durationSeconds);
        if (plans.length >= data.count) return { plans, source: "gemini_audio" as const };
      } catch (e: any) {
        console.warn("[planClips] gemini audio failed", e?.message);
      }
    }

    // 2) Fallback — transcribe via gateway STT, then let Lovable AI Gateway pick moments from transcript.
    try {
      const transcript = await transcribeViaGateway(bytes, mime);
      if (transcript) {
        const plans = await planFromTranscript(transcript, data.topic, data.count, data.durationSeconds);
        if (plans.length >= data.count) return { plans, source: "gateway_transcript" as const };
      }
    } catch (e: any) {
      console.warn("[planClips] transcript fallback failed", e?.message);
    }

    // 3) Last-resort — evenly-spaced windows with generic copy.
    return {
      plans: evenlySpacedPlans(data.topic, data.count, data.durationSeconds),
      source: "evenly_spaced" as const,
    };
  });