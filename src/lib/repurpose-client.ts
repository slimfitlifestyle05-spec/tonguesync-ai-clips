// Client-side "Long-form → Professional Text" repurposing.
// Uses the user's VITE_GEMINI_API_KEY directly from the browser — no
// server round-trip, no Lovable shared quota consumed.

export type RepurposeResult = {
  linkedin_post: string;
  x_thread: string[]; // ordered tweets, already numbered "1/n"
};

const SYSTEM_PROMPT =
  "You are an elite social-media ghostwriter for founders and creators. " +
  "Given a raw long-form video transcript, produce TWO polished, ready-to-post artifacts in the SAME language as the transcript:\n\n" +
  "1) linkedin_post — a high-converting LinkedIn post with:\n" +
  "   • A scroll-stopping HOOK on line 1 (max 12 words)\n" +
  "   • A short 1-2 line context paragraph\n" +
  "   • 4-7 punchy bullet points (use \"→\" or \"•\")\n" +
  "   • A strong, specific CALL TO ACTION on the last line\n" +
  "   • 700-1500 characters. Add whitespace between blocks. No hashtags mid-text; up to 3 relevant hashtags on the last line only.\n\n" +
  "2) x_thread — an ordered array of tweets forming a viral X (Twitter) thread:\n" +
  "   • First tweet is a killer hook, must include \"1/\" at the END.\n" +
  "   • Each following tweet <= 270 characters and ends with \"i/n\" (e.g. 2/8).\n" +
  "   • 5-10 tweets total, one clear idea per tweet, natural transitions (\"But here's the twist:\", \"Then:\", etc.).\n" +
  "   • Last tweet is a CTA + soft ask (follow / bookmark / reply).\n\n" +
  "Return STRICTLY valid JSON matching the schema. No markdown fences.";

const SCHEMA = {
  type: "object",
  properties: {
    linkedin_post: { type: "string" },
    x_thread: { type: "array", items: { type: "string" } },
  },
  required: ["linkedin_post", "x_thread"],
} as const;

export function hasGeminiKey(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

export async function repurposeTranscript(transcript: string): Promise<RepurposeResult> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) throw new Error("VITE_GEMINI_API_KEY not set — add it in Dashboard settings.");
  const text = transcript.trim();
  if (text.length < 40) throw new Error("Transcript is too short to repurpose.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          { role: "user", parts: [{ text: `TRANSCRIPT:\n${text}` }] },
        ],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 240)}`);
  }
  const json: any = await res.json();
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  }
  const linkedin_post = String(parsed?.linkedin_post ?? "").trim();
  const x_thread = Array.isArray(parsed?.x_thread)
    ? parsed.x_thread.map((t: any) => String(t).trim()).filter(Boolean)
    : [];
  if (!linkedin_post || !x_thread.length) {
    throw new Error("Gemini returned an unexpected response — try again.");
  }
  return { linkedin_post, x_thread };
}