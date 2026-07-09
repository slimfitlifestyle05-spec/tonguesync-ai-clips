// Server-only. Do not import from route/component/*.functions.ts modules at
// top level — load with dynamic import inside a handler.

type ApiKeys = {
  openai?: string;
  gemini?: string;
  gemini2?: string;
  elevenlabs?: string;
  cartesia?: string;
};

export type PipelineSettings = {
  apiKeys: ApiKeys;
  ttsProvider: "cartesia" | "elevenlabs";
  cartesiaModel: "sonic-2" | "sonic-turbo" | "sonic";
};

export type PipelineResult =
  | {
      ok: true;
      provider: "cartesia" | "elevenlabs" | "lovable";
      llm: "gemini" | "openai";
      localizedText: string;
      audioDataUrl: string;
      elapsedMs: number;
      // When real ASR + per-sentence sync is available we also return each
      // localized segment aligned to the original source timing. The client
      // muxer uses these to place each dubbed sentence at its exact start —
      // a simplified lip-sync so mouth movements line up with the new voice.
      segments?: Array<{ start: number; end: number; text: string; audioDataUrl: string }>;
      transcriptSource?: "whisper" | "mock";
    }
  | { ok: false; stage: "config" | "llm" | "tts"; message: string };

export async function loadPipelineSettings(): Promise<PipelineSettings> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["api_keys", "tts_provider"]);
  const { data: extra } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", ["cartesia_model"]);
  const map: Record<string, any> = {};
  (data ?? []).forEach((r) => (map[r.key] = r.value));
  (extra ?? []).forEach((r) => (map[r.key] = r.value));
  return {
    // Personal Google AI Studio keys (GEMINI_API_KEY / GEMINI_API_KEY_2 /
    // VITE_GEMINI_API_KEY / VITE_GEMINI_API_KEY_2) always win over anything
    // stored in app_settings, so the dubbing pipeline routes translation +
    // text steps through the user's own quota instead of the shared Lovable one.
    apiKeys: (() => {
      const stored = (map.api_keys ?? {}) as ApiKeys;
      const personalGemini =
        process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || "";
      const personalGemini2 =
        process.env.GEMINI_API_KEY_2?.trim() || process.env.VITE_GEMINI_API_KEY_2?.trim() || "";
      const out: ApiKeys = personalGemini ? { ...stored, gemini: personalGemini } : { ...stored };
      if (personalGemini2) out.gemini2 = personalGemini2;
      return out;
    })(),
    ttsProvider: (typeof map.tts_provider === "string" ? map.tts_provider : "cartesia") as
      | "cartesia"
      | "elevenlabs",
    cartesiaModel: (typeof map.cartesia_model === "string" ? map.cartesia_model : "sonic-2") as
      | "sonic-2"
      | "sonic-turbo"
      | "sonic",
  };
}

// Normalize target language input (e.g. "arabic", "ar-EG") to a Cartesia BCP47 code.
function normalizeLanguage(input: string): string {
  const key = input.toLowerCase().trim();
  const map: Record<string, string> = {
    ar: "ar", arabic: "ar", "ar-eg": "ar", egyptian: "ar", "ar-sa": "ar", khaleeji: "ar",
    en: "en", english: "en", "en-us": "en", "en-gb": "en",
    es: "es", spanish: "es", "es-mx": "es", "es-es": "es",
    fr: "fr", french: "fr",
    de: "de", german: "de",
    it: "it", italian: "it",
    pt: "pt", portuguese: "pt", "pt-br": "pt",
    tr: "tr", turkish: "tr",
    hi: "hi", hindi: "hi",
    ja: "ja", japanese: "ja",
    ko: "ko", korean: "ko",
    zh: "zh", chinese: "zh", mandarin: "zh",
    ru: "ru", russian: "ru",
    nl: "nl", dutch: "nl",
    pl: "pl", polish: "pl",
  };
  return map[key] ?? key.slice(0, 2);
}

// Cartesia Sonic-2 is cross-lingual: one voice can speak any supported language.
// We keep a small curated map so each language sounds native — pick a warm, mid-pitched voice.
function voiceForLanguage(lang: string): string {
  const map: Record<string, string> = {
    ar: "a67e0421-22e0-4d5b-b586-bd4a64aee41d", // Farsi/Arabic-friendly narrator
    en: "a0e99841-438c-4a64-b679-ae501e7d6091", // Barbershop Man
    es: "846d6cb0-2301-48b6-9683-48f5618ea2f6", // Spanish-speaking Lady
    fr: "a8a1eb38-5f15-4c1d-8722-7ac0f329727d", // Calm French Man
    de: "b9de4a89-2257-424b-94c2-db18ba68c81a", // German conversational
    pt: "700d1ee3-a641-4018-ba6e-899dcadc9e2b", // Brazilian Portuguese
    it: "13524ffb-a918-499a-ae97-c98c7c4408c4", // Italian narrator
    tr: "bf991597-6c13-47e4-8411-91ec2de5c466", // Turkish narrator
    hi: "9b953e7b-b1ce-4a20-9a34-eb1c11d94f11", // Hindi conversational
    ja: "2b568345-1d48-4047-b25f-7baccf842eb0", // Japanese narrator
    zh: "e90c6678-f0d3-4767-9883-5d0ecf5894a8", // Mandarin narrator
    ru: "779673f3-895f-4935-b6b5-b031dc78b319", // Russian storyteller
  };
  return map[lang] ?? map.en;
}

async function translateWithGemini(
  key: string,
  transcript: string,
  targetLanguage: string,
  targetCountry: string,
): Promise<string> {
  const prompt = `You are a native localization expert and voice director. Rewrite the transcript below into the ${targetLanguage} language using the natural spoken dialect of ${targetCountry}. Match idioms, cultural references, and rhythm as if it were originally written for that audience. Preserve meaning, tone, pacing and approximate sentence duration so it can be re-dubbed over the original video without desyncing. Return ONLY the rewritten transcript with no preface.\n\nTRANSCRIPT:\n${transcript}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const out = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof out !== "string" || !out.trim()) throw new Error("Gemini returned empty output");
  return out.trim();
}

async function translateWithOpenAI(
  key: string,
  transcript: string,
  targetLanguage: string,
  targetCountry: string,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You rewrite transcripts into the natural spoken ${targetLanguage} dialect used in ${targetCountry}, keeping pacing suitable for dubbing. Reply with the transcript only.`,
        },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const out = json?.choices?.[0]?.message?.content;
  if (typeof out !== "string" || !out.trim()) throw new Error("OpenAI returned empty output");
  return out.trim();
}

// Try each configured Gemini key in order; return null if all fail.
async function tryGeminiTranslate(
  apiKeys: ApiKeys,
  transcript: string,
  targetLanguage: string,
  targetCountry: string,
): Promise<string | null> {
  const keys = [apiKeys.gemini, apiKeys.gemini2].filter(Boolean) as string[];
  for (const key of keys) {
    try {
      return await translateWithGemini(key, transcript, targetLanguage, targetCountry);
    } catch (e: any) {
      console.warn("[dubbing-pipeline] Gemini key failed:", e?.message ?? e);
    }
  }
  return null;
}

async function synthesizeWithCartesia(
  key: string,
  text: string,
  language: string,
  model: "sonic-2" | "sonic-turbo" | "sonic" = "sonic-2",
  targetDurationSeconds?: number,
): Promise<{ audioDataUrl: string }> {
  // Cartesia Sonic family — sonic-2 = flagship quality, sonic-turbo = ~40ms latency.
  const lang = normalizeLanguage(language);
  const voiceId = voiceForLanguage(lang);
  // Estimate speech duration (~15 chars/sec at speed 1) and adjust `speed`
  // to match the source clip's length within Cartesia's [-1,1] range.
  let speed = 0;
  if (targetDurationSeconds && text.length > 0) {
    const estSec = text.length / 15;
    const ratio = estSec / targetDurationSeconds; // >1 means too long → speed up
    speed = Math.max(-0.5, Math.min(0.5, (ratio - 1) * 0.8));
  }
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": key,
      "Cartesia-Version": "2024-11-13",
    },
    body: JSON.stringify({
      model_id: model,
      transcript: text,
      voice: { mode: "id", id: voiceId, __experimental_controls: { speed } },
      output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
      language: lang,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cartesia ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const base64 = Buffer.from(buf).toString("base64");
  return { audioDataUrl: `data:audio/mpeg;base64,${base64}` };
}

// Real ASR via OpenAI Whisper. Returns per-segment timestamps we can use to
// place each dubbed sentence at its exact position in the source video.
async function transcribeWithWhisper(
  key: string,
  sourceUrl: string,
): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> {
  const src = await fetch(sourceUrl);
  if (!src.ok) throw new Error(`Whisper source fetch ${src.status}`);
  const blob = await src.blob();
  if (blob.size > 24 * 1024 * 1024) throw new Error("Source too large for Whisper (25MB)");
  const form = new FormData();
  form.append("file", blob, "source.mp4");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const text: string = json?.text ?? "";
  const segments = (json?.segments ?? []).map((s: any) => ({
    start: Number(s.start) || 0,
    end: Number(s.end) || 0,
    text: String(s.text || "").trim(),
  })).filter((s: any) => s.text);
  return { text, segments };
}

// Fallback ASR using Gemini's inline video support. Works with the user's
// existing Gemini key (no OpenAI required). We ask Gemini to return a JSON
// array of {start,end,text} so we still get per-segment timing for lip-sync.
async function transcribeWithGemini(
  key: string,
  sourceUrl: string,
): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> {
  const src = await fetch(sourceUrl);
  if (!src.ok) throw new Error(`Gemini source fetch ${src.status}`);
  const contentType = src.headers.get("content-type") || "video/mp4";
  const buf = new Uint8Array(await src.arrayBuffer());
  if (buf.byteLength > 18 * 1024 * 1024) throw new Error("Source too large for Gemini inline (18MB)");
  const base64 = Buffer.from(buf).toString("base64");
  const prompt =
    "Transcribe the spoken audio in this video verbatim in its ORIGINAL language. " +
    "Return ONLY a JSON array (no markdown, no prose) of objects with keys " +
    '"start" (seconds, number), "end" (seconds, number), "text" (string). ' +
    "One object per spoken sentence, in order. If there is no speech, return [].";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: contentType, data: base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ASR ${res.status}: ${body.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: any = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  }
  const segments = (Array.isArray(parsed) ? parsed : [])
    .map((s: any) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: String(s.text || "").trim(),
    }))
    .filter((s: any) => s.text);
  const text = segments.map((s: any) => s.text).join(" ").trim();
  if (!text) throw new Error("Gemini returned empty transcript");
  return { text, segments };
}

// Translate a single sentence while preserving pacing and voice-direction.
async function translateSentence(
  apiKeys: ApiKeys,
  text: string,
  targetLanguage: string,
  targetCountry: string,
): Promise<string> {
  const geminiResult = await tryGeminiTranslate(apiKeys, text, targetLanguage, targetCountry);
  if (geminiResult) return geminiResult;
  if (apiKeys.openai) {
    try {
      return await translateWithOpenAI(apiKeys.openai, text, targetLanguage, targetCountry);
    } catch (e: any) {
      console.warn("[dubbing-pipeline] openai failed, using Lovable AI:", e?.message ?? e);
    }
  }
  // Fallback to Lovable AI Gateway (no user key required).
  try {
    const { lovableChat } = await import("./ai-gateway.server");
    const out = await lovableChat(
      [
        {
          role: "system",
          content: `You rewrite transcripts into the natural spoken ${targetLanguage} dialect used in ${targetCountry}, preserving pacing for dubbing. Reply with the transcript only, no preface.`,
        },
        { role: "user", content: text },
      ],
      { temperature: 0.3, maxTokens: 1024 },
    );
    if (out.trim()) return out.trim();
  } catch (e: any) {
    console.warn("[dubbing-pipeline] lovable gateway translate failed:", e?.message ?? e);
  }
  return text;
}

async function synthesizeWithElevenLabs(
  key: string,
  text: string,
): Promise<{ audioDataUrl: string }> {
  const voiceId = "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": key },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const base64 = Buffer.from(buf).toString("base64");
  return { audioDataUrl: `data:audio/mpeg;base64,${base64}` };
}

// Lovable AI Gateway TTS (OpenAI gpt-4o-mini-tts) — no user key required.
// Used as a last-resort fallback when ElevenLabs/Cartesia fail.
async function synthesizeWithLovableAI(text: string): Promise<{ audioDataUrl: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      input: text.slice(0, 4000),
      voice: "alloy",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lovable TTS ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const base64 = Buffer.from(buf).toString("base64");
  return { audioDataUrl: `data:audio/mpeg;base64,${base64}` };
}

export async function runDubbingPipeline(input: {
  transcript: string;
  targetLanguage: string;
  targetCountry: string;
  durationSeconds?: number;
  sourceUrl?: string | null;
  skipAsr?: boolean;
}): Promise<PipelineResult> {
  const started = Date.now();
  const settings = await loadPipelineSettings();
  const { apiKeys, ttsProvider, cartesiaModel } = settings;

  // Step 0 (optional) — real ASR with timestamps via Whisper. Falls back
  // silently to the caller-supplied transcript if disabled or fails.
  let workingTranscript = input.transcript;
  let asrSegments: Array<{ start: number; end: number; text: string }> = [];
  let transcriptSource: "whisper" | "mock" = "mock";
  if (!input.skipAsr && input.sourceUrl && apiKeys.openai) {
    try {
      const w = await transcribeWithWhisper(apiKeys.openai, input.sourceUrl);
      if (w.text.trim()) {
        workingTranscript = w.text;
        asrSegments = w.segments;
        transcriptSource = "whisper";
        console.log(`[dubbing-pipeline] whisper ok segments=${w.segments.length}`);
      }
    } catch (e: any) {
      console.warn("[dubbing-pipeline] whisper failed, using mock transcript:", e?.message ?? e);
    }
  }
  // If Whisper wasn't used (or failed), try Gemini inline-video ASR so we
  // dub what the video actually says instead of a random mock transcript.
  if (!input.skipAsr && transcriptSource === "mock" && input.sourceUrl) {
    const geminiKeys = [apiKeys.gemini, apiKeys.gemini2].filter(Boolean) as string[];
    for (const key of geminiKeys) {
      try {
        const g = await transcribeWithGemini(key, input.sourceUrl);
        if (g.text.trim()) {
          workingTranscript = g.text;
          asrSegments = g.segments;
          // Reuse "whisper" tag so downstream UI treats it as real ASR.
          transcriptSource = "whisper";
          console.log(`[dubbing-pipeline] gemini ASR ok segments=${g.segments.length}`);
          break;
        }
      } catch (e: any) {
        console.warn("[dubbing-pipeline] gemini ASR key failed:", e?.message ?? e);
      }
    }
  }
  if (!input.skipAsr && transcriptSource === "mock" && input.sourceUrl) {
    return {
      ok: false,
      stage: "config",
      message:
        "Couldn't transcribe the video. Add an OpenAI key (Whisper) or a Gemini key, and keep the clip under 18MB.",
    };
  }

  // Translation step — try Gemini keys in order, then OpenAI, then Lovable.
  let localizedText = "";
  let llm: "gemini" | "openai" = "gemini";
  try {
    const geminiResult = await tryGeminiTranslate(
      apiKeys,
      workingTranscript,
      input.targetLanguage,
      input.targetCountry,
    );
    if (geminiResult) {
      localizedText = geminiResult;
      llm = "gemini";
    } else if (apiKeys.openai) {
      try {
        localizedText = await translateWithOpenAI(
          apiKeys.openai,
          workingTranscript,
          input.targetLanguage,
          input.targetCountry,
        );
        llm = "openai";
      } catch (e: any) {
        console.warn("[dubbing-pipeline] openai failed, using Lovable AI:", e?.message ?? e);
      }
    }
    if (!localizedText) {
      const { lovableChat } = await import("./ai-gateway.server");
      localizedText = await lovableChat(
        [
          { role: "system", content: `You rewrite transcripts into the natural spoken ${input.targetLanguage} dialect used in ${input.targetCountry}, preserving pacing for dubbing. Reply with the transcript only.` },
          { role: "user", content: workingTranscript },
        ],
        { temperature: 0.3, maxTokens: 2048 },
      );
      llm = "gemini";
    }
    if (!localizedText.trim() || localizedText === workingTranscript) {
      return {
        ok: false,
        stage: "config",
        message: "Translation unavailable. Add a Gemini/OpenAI key or enable Lovable AI credits.",
      };
    }
  } catch (e: any) {
    console.error("[dubbing-pipeline] LLM failed:", e?.message ?? e);
    return { ok: false, stage: "llm", message: e?.message ?? "Translation failed" };
  }

  // TTS step — Cartesia by default, ElevenLabs fallback if selected.
  try {
    if (ttsProvider === "cartesia") {
      if (!apiKeys.cartesia)
        return {
          ok: false,
          stage: "config",
          message: "Cartesia is selected but no Cartesia API key is set.",
        };
      const { audioDataUrl } = await synthesizeWithCartesia(
        apiKeys.cartesia,
        localizedText,
        input.targetLanguage,
        cartesiaModel,
        input.durationSeconds,
      );

      // Per-segment synthesis for lip-sync: translate + speak each ASR
      // sentence individually, matching its original duration. This lets
      // the client muxer place each dubbed sentence exactly on the
      // original speaker's mouth, giving a simplified but very effective
      // lip-sync. Best-effort — falls back to the single combined take.
      let segments: Array<{ start: number; end: number; text: string; audioDataUrl: string }> | undefined;
      if (asrSegments.length > 0) {
        try {
          const out: Array<{ start: number; end: number; text: string; audioDataUrl: string }> = [];
          // Parallelism cap = 4 to keep Cartesia + Gemini rate-limits happy.
          const queue = [...asrSegments];
          async function worker() {
            while (queue.length) {
              const s = queue.shift()!;
              const localized = await translateSentence(apiKeys, s.text, input.targetLanguage, input.targetCountry);
              const { audioDataUrl: segAudio } = await synthesizeWithCartesia(
                apiKeys.cartesia!,
                localized,
                input.targetLanguage,
                cartesiaModel,
                Math.max(0.4, s.end - s.start),
              );
              out.push({ start: s.start, end: s.end, text: localized, audioDataUrl: segAudio });
            }
          }
          await Promise.all([worker(), worker(), worker(), worker()]);
          out.sort((a, b) => a.start - b.start);
          segments = out;
        } catch (e: any) {
          console.warn("[dubbing-pipeline] per-segment synth failed, using single take:", e?.message ?? e);
        }
      }

      return {
        ok: true,
        provider: "cartesia",
        llm,
        localizedText,
        audioDataUrl,
        elapsedMs: Date.now() - started,
        segments,
        transcriptSource,
      };
    }
    // ElevenLabs first (if key), otherwise fall back to Lovable AI TTS.
    let audioDataUrl: string;
    let provider: "elevenlabs" | "lovable" = "lovable";
    if (apiKeys.elevenlabs) {
      try {
        const r = await synthesizeWithElevenLabs(apiKeys.elevenlabs, localizedText);
        audioDataUrl = r.audioDataUrl;
        provider = "elevenlabs";
      } catch (e: any) {
        console.warn("[dubbing-pipeline] elevenlabs failed, using Lovable AI TTS:", e?.message ?? e);
        const r = await synthesizeWithLovableAI(localizedText);
        audioDataUrl = r.audioDataUrl;
      }
    } else {
      const r = await synthesizeWithLovableAI(localizedText);
      audioDataUrl = r.audioDataUrl;
    }
    return {
      ok: true,
      provider,
      llm,
      localizedText,
      audioDataUrl,
      elapsedMs: Date.now() - started,
      transcriptSource,
    };
  } catch (e: any) {
    console.error("[dubbing-pipeline] TTS failed:", e?.message ?? e);
    return { ok: false, stage: "tts", message: e?.message ?? "Voice synthesis failed" };
  }
}