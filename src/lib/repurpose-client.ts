// Client-side "Long-form → Professional Text" repurposing.
// Uses the user's VITE_GEMINI_API_KEY directly from the browser — no server
// round-trip, no Lovable shared quota consumed. Two independent generators:
// one for a viral X thread, one for a high-converting LinkedIn post. Each
// runs the exact user-supplied prompt.

export function hasGeminiKey(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

const LINKEDIN_PROMPT = `You are an expert LinkedIn Ghostwriter and Content Strategist. Your task is to analyze the provided video transcript and repurpose it into a highly engaging, professional LinkedIn post that drives massive engagement.

Strict Formatting & Structure Rules:

1. THE HOOK (First 2 lines max): Start with a bold, scroll-stopping statement, an anti-intuitive fact, or a specific result from the transcript. Do NOT use generic AI openings like "In today's fast-paced world..." or "I am excited to share...". Keep it under 15 words.

2. THE TENSION: Briefly explain the core problem or old way of thinking mentioned in the video.

3. THE VALUE (Bullet Points): Breakdown the 3 most actionable insights from the video. Keep each bullet point short, punchy, and under one sentence.

4. THE TAKEAWAY: One final powerful line summarizing the main lesson.

5. THE ASK (Call to Action): End with a genuine, open-ended question to spark debate and drive comments. Do NOT ask for likes or shares.

Anti-AI Persona Rules (Crucial):

- Write in a conversational, human tone (like telling a peer over coffee).
- Vary sentence lengths (some short, some medium).
- Paragraphs must be under 2 lines max (optimized for mobile readability).
- BANNED WORDS: Absolutely do NOT use words like: "delve", "tapestry", "game-changer", "unlock", "elevate", "realm", "synergy", "landscape", "moreover".
- Emojis: Use a maximum of 2 emojis in the entire post. Do NOT put emojis at the start of every sentence.

Output the LinkedIn post as PLAIN TEXT ONLY. No preamble, no explanations, no markdown fences.`;

const X_THREAD_PROMPT = `You are an expert X (Twitter) Thread Writer and Growth Hacker. Your task is to analyze the provided video transcript and turn it into a highly viral, formatted X Thread.

Strict Formatting & Structure Rules:

1. THE HOOK (Tweet 1): Must be incredibly sharp and high-converting. State a shocking statistic, an anti-intuitive truth, or a massive benefit from the transcript. End Tweet 1 with a hook line like "Here is the breakdown:" or "A short thread:". Do NOT use emojis in Tweet 1.

2. BODY TWEETS (Tweets 2 to 5+): Breakdown the core insights from the transcript. Each tweet must focus on ONLY ONE clear, punchy point.

3. THREAD FORMATTING: Number every tweet clearly at the beginning or end (e.g., 1/, 2/, 3/ or 1/n, 2/n). Maximize the use of white spaces. Each tweet must be under 280 characters strict.

4. THE FINAL TWEET: Summarize the main takeaway in one powerful sentence and add a Call to Action (CTA) encouraging readers to reply or retweet the first tweet.

Anti-AI Persona Rules:

- Write in a raw, punchy, and confident human tone (Silicon Valley founder style).
- Do NOT use threads cliches like "Let's dive in 👇" or "Without further ado".
- BANNED WORDS: "delve", "tapestry", "revolutionize", "unlock", "elevate", "realm".
- Emojis: Zero emojis or maximum 1 in the entire thread.

Return STRICTLY as valid JSON matching this schema: { "tweets": ["tweet 1 text", "tweet 2 text", ...] }. Each array item is one full tweet including its number marker. No markdown fences.`;

async function callGemini(systemInstruction: string, userText: string, opts: { json?: boolean } = {}): Promise<string> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key) throw new Error("VITE_GEMINI_API_KEY not set — add it in Dashboard settings.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.85,
          ...(opts.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 240)}`);
  }
  const json: any = await res.json();
  return String(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

function requireTranscript(transcript: string): string {
  const t = transcript.trim();
  if (t.length < 40) throw new Error("Transcript is too short to repurpose.");
  return t;
}

export async function generateLinkedInPost(transcript: string): Promise<string> {
  const t = requireTranscript(transcript);
  const out = await callGemini(
    LINKEDIN_PROMPT,
    `Transcript to analyze:\n${t}`,
  );
  // Strip accidental ```fences``` just in case.
  return out.replace(/^```[a-z]*\n?/i, "").replace(/```$/i, "").trim();
}

export async function generateXThread(transcript: string): Promise<string[]> {
  const t = requireTranscript(transcript);
  const raw = await callGemini(X_THREAD_PROMPT, `Transcript to analyze:\n${t}`, { json: true });
  let parsed: any = {};
  try { parsed = JSON.parse(raw); } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
  }
  const tweets = Array.isArray(parsed?.tweets)
    ? parsed.tweets.map((t: any) => String(t).trim()).filter(Boolean)
    : [];
  if (!tweets.length) throw new Error("Gemini returned an unexpected response — try again.");
  return tweets;
}

// ============ Web Intent share helpers (no API, no cost, no auth) ============

/** Open the official X (Twitter) share window pre-filled with the thread. */
export function shareOnX(text: string) {
  // Twitter Web Intents enforce a ~280 char limit per single tweet. For a
  // multi-tweet thread we pre-fill the first tweet only and copy the full
  // thread to the clipboard so the user can paste the rest as replies.
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=720");
}

/**
 * Open the official LinkedIn share window. LinkedIn's share intent only
 * accepts a `url` param reliably (their `text` param is deprecated), so we
 * pair it with a clipboard copy so the user can paste the pre-written post.
 */
export function shareOnLinkedIn(url = "https://tonguesync.ai") {
  const intent = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  window.open(intent, "_blank", "noopener,noreferrer,width=640,height=720");
}