import { lovableChat } from "./ai-gateway.server";

export type ClipPlanServer = {
  start: number;
  end: number;
  title: string;
  description: string;
  hashtags: string[];
  reason?: string;
};

export type ClipCopyServer = {
  title: string;
  description: string;
  hashtags: string[];
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

const COPY_SYSTEM = `You are an expert short-form video strategist. From a topic, you write viral English copy for a vertical short (TikTok / Reels / Shorts).

Rules:
- Title: max 60 chars, hook-first, no clickbait clichés, no emojis at the start.
- Description: 1–2 sentences, plain English, max 180 chars, teases the value.
- Hashtags: exactly 5, lowercase, each starts with #, no spaces, mixing 1 broad + 3 niche + 1 trending.

Return STRICT JSON: { "title": "...", "description": "...", "hashtags": ["#a","#b","#c","#d","#e"] } — no markdown, no preamble.`;

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

function normalizeCopy(parsed: any): ClipCopyServer | null {
  const title = String(parsed?.title ?? "").trim();
  const description = String(parsed?.description ?? "").trim();
  const hashtags = normalizeHashtags(parsed?.hashtags);
  if (!title || !description || hashtags.length < 3) return null;
  return { title, description, hashtags };
}

function normalizePlans(parsed: any, count: number, duration: number): ClipPlanServer[] {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const maxEnd = safeDuration > 0 ? safeDuration : Number.POSITIVE_INFINITY;
  return (Array.isArray(parsed?.clips) ? parsed.clips : [])
    .map((c: any) => {
      const rawStart = Number(c.start);
      const start = Math.max(0, Math.min(maxEnd - 1, Number.isFinite(rawStart) ? rawStart : 0));
      const rawEnd = Number(c.end);
      const boundedEnd = Number.isFinite(rawEnd) ? rawEnd : start + 20;
      const end = Math.max(start + 8, Math.min(maxEnd, start + 30, boundedEnd));
      return {
        start: Math.floor(start * 100) / 100,
        end: Math.floor(end * 100) / 100,
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

async function writeCopyWithGemini(key: string, topic: string, clipIndex: number, variation: number): Promise<ClipCopyServer | null> {
  const angleHint = variation > 0
    ? `\n\nIMPORTANT: This is regeneration #${variation}. Produce a COMPLETELY DIFFERENT angle, hook, and word choice than any previous attempt.`
    : "";
  const user = `Master video topic: """${topic}"""\nThis is short clip #${clipIndex + 1} of 3 extracted from that video. Write copy that highlights a distinct angle of the topic for this specific short.${angleHint}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: COPY_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: variation > 0 ? 1 : 0.75, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) return null;
  const json: any = await res.json().catch(() => ({}));
  const raw = String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  return normalizeCopy(parseJsonObject(raw));
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

export async function planUploadedClipMoments(input: {
  base64: string;
  mimeType: string;
  topic: string;
  count: number;
  durationSeconds: number;
}): Promise<{ plans: ClipPlanServer[]; source: "gemini_audio" | "gateway_transcript" }> {
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.byteLength > 20 * 1024 * 1024) {
    throw new Error("Audio payload too large for analysis (20MB max).");
  }
  const mime = input.mimeType.split(";")[0].trim() || "audio/wav";
  const duration = Number.isFinite(input.durationSeconds) ? input.durationSeconds : 0;

  const keys = getPersonalGeminiKeys();
  for (const key of keys) {
    try {
      const plans = await planWithGeminiAudio(key, input.base64, mime, input.topic, input.count, duration);
      if (plans.length >= input.count) return { plans, source: "gemini_audio" };
    } catch (e: any) {
      console.warn("[planClips] gemini audio failed", e?.message);
    }
  }

  try {
    const transcript = await transcribeViaGateway(bytes, mime);
    if (transcript) {
      const plans = await planFromTranscript(transcript, input.topic, input.count, duration);
      if (plans.length >= input.count) return { plans, source: "gateway_transcript" };
    }
  } catch (e: any) {
    console.warn("[planClips] transcript fallback failed", e?.message);
  }

  throw new Error("AI could not identify 3 real clip timestamps from this upload. No placeholder or dummy shorts were generated — try a clearer video with speech, or upload a shorter original file.");
}

export async function writeClipCopyForTopic(input: {
  topic: string;
  clipIndex: number;
  variation: number;
}): Promise<ClipCopyServer> {
  const topic = input.topic || "Short clip";
  for (const key of getPersonalGeminiKeys()) {
    const copy = await writeCopyWithGemini(key, topic, input.clipIndex, input.variation);
    if (copy) return copy;
  }

  const angleHint = input.variation > 0
    ? `\nThis is regeneration #${input.variation}; use a fresh angle and wording.`
    : "";
  const raw = await lovableChat(
    [
      { role: "system", content: COPY_SYSTEM },
      { role: "user", content: `Topic: """${topic}"""\nShort number: ${input.clipIndex + 1} of 3.${angleHint}` },
    ],
    { model: "google/gemini-2.5-flash", temperature: input.variation > 0 ? 0.95 : 0.75, maxTokens: 600 },
  );
  const copy = normalizeCopy(parseJsonObject(raw));
  if (!copy) throw new Error("AI returned incomplete copy for this clip.");
  return copy;
}