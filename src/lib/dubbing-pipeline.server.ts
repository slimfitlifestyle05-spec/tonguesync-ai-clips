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
  const map: Record<string, any> = {};
  (data ?? []).forEach((r) => (map[r.key] = r.value));
  return {
    apiKeys: map.api_keys ?? {},
    ttsProvider: (typeof map.tts_provider === "string" ? map.tts_provider : "cartesia") as
      | "cartesia"
      | "elevenlabs",
  };
}

async function translateWithGemini(
  key: string,
  transcript: string,
  targetLanguage: string,
  targetCountry: string,
): Promise<string> {
  const prompt = `You are a native localization expert. Rewrite the transcript below into the ${targetLanguage} language using the natural spoken dialect of ${targetCountry}. Preserve meaning, tone, pacing and approximate sentence timing so it can be re-dubbed over the original video. Return ONLY the rewritten transcript with no preface.\n\nTRANSCRIPT:\n${transcript}`;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
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
): Promise<{ audioDataUrl: string }> {
  // Sonic model — Cartesia's flagship low-latency TTS.
  const res = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": key,
      "Cartesia-Version": "2024-11-13",
    },
    body: JSON.stringify({
      model_id: "sonic-2",
      transcript: text,
      voice: { mode: "id", id: "a0e99841-438c-4a64-b679-ae501e7d6091" },
      output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
      language,
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
}): Promise<PipelineResult> {
  const started = Date.now();
  const settings = await loadPipelineSettings();
  const { apiKeys, ttsProvider } = settings;

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