// Server-only. Do not import from route/component/*.functions.ts modules at
// top level — load with dynamic import inside a handler.

type ApiKeys = {
  openai?: string;
  gemini?: string;
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
      provider: "cartesia" | "elevenlabs";
      llm: "gemini" | "openai";
      localizedText: string;
      audioDataUrl: string;
      elapsedMs: number;
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
    apiKeys: map.api_keys ?? {},
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

export async function runDubbingPipeline(input: {
  transcript: string;
  targetLanguage: string;
  targetCountry: string;
  durationSeconds?: number;
}): Promise<PipelineResult> {
  const started = Date.now();
  const settings = await loadPipelineSettings();
  const { apiKeys, ttsProvider, cartesiaModel } = settings;

  // Translation step — prefer Gemini, fall back to OpenAI.
  let localizedText = "";
  let llm: "gemini" | "openai";
  try {
    if (apiKeys.gemini) {
      llm = "gemini";
      localizedText = await translateWithGemini(
        apiKeys.gemini,
        input.transcript,
        input.targetLanguage,
        input.targetCountry,
      );
    } else if (apiKeys.openai) {
      llm = "openai";
      localizedText = await translateWithOpenAI(
        apiKeys.openai,
        input.transcript,
        input.targetLanguage,
        input.targetCountry,
      );
    } else {
      return {
        ok: false,
        stage: "config",
        message: "No LLM key configured. Add a Gemini or OpenAI key in Admin → API Integrations.",
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
      return {
        ok: true,
        provider: "cartesia",
        llm,
        localizedText,
        audioDataUrl,
        elapsedMs: Date.now() - started,
      };
    }
    if (!apiKeys.elevenlabs)
      return {
        ok: false,
        stage: "config",
        message: "ElevenLabs is selected but no ElevenLabs API key is set.",
      };
    const { audioDataUrl } = await synthesizeWithElevenLabs(apiKeys.elevenlabs, localizedText);
    return {
      ok: true,
      provider: "elevenlabs",
      llm,
      localizedText,
      audioDataUrl,
      elapsedMs: Date.now() - started,
    };
  } catch (e: any) {
    console.error("[dubbing-pipeline] TTS failed:", e?.message ?? e);
    return { ok: false, stage: "tts", message: e?.message ?? "Voice synthesis failed" };
  }
}