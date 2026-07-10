// Client-side Gemini helper that turns a clip topic into a polished English
// title + short description + hashtags. Uses the user's personal
// VITE_GEMINI_API_KEY so we never touch Lovable's shared quota.

export type ClipCopy = {
  title: string;
  description: string;
  hashtags: string[];
};

export type ClipPlan = ClipCopy & {
  start: number;
  end: number;
  reason?: string;
};

export function hasGeminiKey(): boolean {
  // Kept for backward compat. Clip planning now always routes through the
  // server (personal Gemini key → Lovable AI Gateway fallback), so callers
  // no longer need to gate on a client-side env var.
  return true;
}

const SYSTEM = `You are an expert short-form video strategist. From a topic, you write viral English copy for a vertical short (TikTok / Reels / Shorts).

Rules:
- Title: max 60 chars, hook-first, no clickbait clichés, no emojis at the start.
- Description: 1–2 sentences, plain English, max 180 chars, teases the value.
- Hashtags: exactly 5, lowercase, each starts with #, no spaces, mixing 1 broad + 3 niche + 1 trending.

Return STRICT JSON: { "title": "...", "description": "...", "hashtags": ["#a","#b","#c","#d","#e"] } — no markdown, no preamble.`;

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
{
  "clips": [
    { "start": 12.4, "end": 36.8, "title": "...", "description": "...", "hashtags": ["#a","#b","#c","#d","#e"], "reason": "..." }
  ]
}`;

function parseJsonObject(raw: string): any {
  try { return JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
  }
  return {};
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
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

export async function generateClipPlanFromAudio(
  audioBlob: Blob,
  topic: string,
  count = 3,
): Promise<ClipPlan[]> {
  const base64 = await blobToBase64(audioBlob);
  const { planClips } = await import("./clip-copy.functions");
  const { plans } = await planClips({
    data: {
      base64,
      mimeType: audioBlob.type || "audio/wav",
      topic,
      count,
      durationSeconds: 0,
    },
  });
  if (!plans?.length) throw new Error("The AI couldn't pick clip moments from this video. Try a shorter or clearer video.");
  return plans as ClipPlan[];
}

export async function generateClipCopy(
  topic: string,
  clipIndex: number,
  variation = 0,
): Promise<ClipCopy> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) throw new Error("VITE_GEMINI_API_KEY not set");
  const angleHint = variation > 0
    ? `\n\nIMPORTANT: This is regeneration #${variation}. Produce a COMPLETELY DIFFERENT angle, hook, and word choice than any previous attempt. Do not reuse the same opening pattern. Session nonce: ${Math.random().toString(36).slice(2, 10)}.`
    : "";
  const user = `Master video topic: """${topic}"""\nThis is short clip #${clipIndex + 1} of 3 extracted from that video. Write copy that highlights a distinct angle of the topic for this specific short.${angleHint}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: variation > 0 ? 1.15 : 0.9,
          topP: 0.95,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const raw = String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  const parsed = parseJsonObject(raw);
  const title = String(parsed?.title ?? "").trim();
  const description = String(parsed?.description ?? "").trim();
  const hashtags = normalizeHashtags(parsed?.hashtags);
  if (!title || !description || hashtags.length < 3) {
    throw new Error("Gemini returned incomplete copy");
  }
  return { title, description, hashtags };
}

export async function generateClipCopyBatch(topic: string, count: number): Promise<ClipCopy[]> {
  return Promise.all(Array.from({ length: count }, (_, i) => generateClipCopy(topic, i)));
}