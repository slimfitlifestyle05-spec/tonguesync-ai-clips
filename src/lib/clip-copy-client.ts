// Client-side Gemini helper that turns a clip topic into a polished English
// title + short description + hashtags. Uses the user's personal
// VITE_GEMINI_API_KEY so we never touch Lovable's shared quota.

export type ClipCopy = {
  title: string;
  description: string;
  hashtags: string[];
};

export function hasGeminiKey(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

const SYSTEM = `You are an expert short-form video strategist. From a topic, you write viral English copy for a vertical short (TikTok / Reels / Shorts).

Rules:
- Title: max 60 chars, hook-first, no clickbait clichés, no emojis at the start.
- Description: 1–2 sentences, plain English, max 180 chars, teases the value.
- Hashtags: exactly 5, lowercase, each starts with #, no spaces, mixing 1 broad + 3 niche + 1 trending.

Return STRICT JSON: { "title": "...", "description": "...", "hashtags": ["#a","#b","#c","#d","#e"] } — no markdown, no preamble.`;

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
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
  }
  const title = String(parsed?.title ?? "").trim();
  const description = String(parsed?.description ?? "").trim();
  const hashtags = Array.isArray(parsed?.hashtags)
    ? parsed.hashtags.map((h: any) => {
        const s = String(h).trim();
        return s.startsWith("#") ? s : `#${s}`;
      }).filter(Boolean).slice(0, 5)
    : [];
  if (!title || !description || hashtags.length < 3) {
    throw new Error("Gemini returned incomplete copy");
  }
  return { title, description, hashtags };
}

export async function generateClipCopyBatch(topic: string, count: number): Promise<ClipCopy[]> {
  return Promise.all(Array.from({ length: count }, (_, i) => generateClipCopy(topic, i)));
}