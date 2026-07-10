// Client-side dubbing pipeline. Calls Google AI Studio (Gemini) + Cartesia
// Sonic DIRECTLY from the browser using the tested AI-Studio prompt logic.
//
// SECURITY: Any key exposed here (VITE_GEMINI_API_KEY, VITE_CARTESIA_API_KEY)
// ships in the client bundle and is visible in network calls. Only use keys
// you're willing to publish. When either key is missing, callers should fall
// back to the server pipeline.

export type ClientDubSegment = {
  start: number;
  end: number;
  text: string; // localized text
  audioDataUrl: string;
};

export type ClientDubResult = {
  localizedText: string;
  segments: ClientDubSegment[];
};

export function hasClientDubbingKeys(): boolean {
  return Boolean(
    import.meta.env.VITE_GEMINI_API_KEY && import.meta.env.VITE_CARTESIA_API_KEY,
  );
}

function normalizeLanguage(input: string): string {
  const key = input.toLowerCase().trim();
  const map: Record<string, string> = {
    ar: "ar", arabic: "ar", "ar-eg": "ar", egyptian: "ar", "ar-sa": "ar", khaleeji: "ar",
    en: "en", english: "en", "en-us": "en", "en-gb": "en",
    es: "es", spanish: "es", fr: "fr", french: "fr", de: "de", german: "de",
    it: "it", italian: "it", pt: "pt", portuguese: "pt", "pt-br": "pt",
    tr: "tr", turkish: "tr", hi: "hi", hindi: "hi", ja: "ja", japanese: "ja",
    ko: "ko", korean: "ko", zh: "zh", chinese: "zh", ru: "ru", russian: "ru",
    nl: "nl", dutch: "nl", pl: "pl", polish: "pl",
  };
  return map[key] ?? key.slice(0, 2);
}

// Same Cartesia voice pools we use on the server side.
const FEMALE_VOICES: Record<string, string> = {
  ar: "a67e0421-22e0-4d5b-b586-bd4a64aee41d",
  en: "79a125e8-cd45-4c13-8a67-188112f4dd22",
  es: "846d6cb0-2301-48b6-9683-48f5618ea2f6",
  fr: "a249eaff-1e96-4d2c-b23b-12efa4f66f41",
  de: "b9de4a89-2257-424b-94c2-db18ba68c81a",
  pt: "700d1ee3-a641-4018-ba6e-899dcadc9e2b",
  it: "13524ffb-a918-499a-ae97-c98c7c4408c4",
  tr: "bf991597-6c13-47e4-8411-91ec2de5c466",
  hi: "9b953e7b-b1ce-4a20-9a34-eb1c11d94f11",
  ja: "2b568345-1d48-4047-b25f-7baccf842eb0",
  zh: "e90c6678-f0d3-4767-9883-5d0ecf5894a8",
  ru: "779673f3-895f-4935-b6b5-b031dc78b319",
};
const MALE_VOICES: Record<string, string> = {
  ar: "a67e0421-22e0-4d5b-b586-bd4a64aee41d",
  en: "a0e99841-438c-4a64-b679-ae501e7d6091",
  es: "15a9cd88-84b0-4a8b-95f2-5d583b54c72e",
  fr: "a8a1eb38-5f15-4c1d-8722-7ac0f329727d",
  de: "384b625b-da5d-49e8-a76d-a2855d4f31eb",
  pt: "6a16c1f4-462b-44de-998d-ccdaa4125a0a",
  it: "408daed0-c597-4c27-aae8-fa0497d644bf",
  tr: "bf991597-6c13-47e4-8411-91ec2de5c466",
  hi: "3f4ade23-6eb4-4279-ab05-6a144947c4d5",
  ja: "2b568345-1d48-4047-b25f-7baccf842eb0",
  zh: "e90c6678-f0d3-4767-9883-5d0ecf5894a8",
  ru: "da05e96d-ca10-4220-9042-d8acef654fa9",
};

function voiceForLanguage(lang: string, gender: "female" | "male") {
  const pool = gender === "male" ? MALE_VOICES : FEMALE_VOICES;
  return pool[lang] ?? pool.en;
}

// === AI-Studio-tested system prompt (verbatim) ===
const AI_STUDIO_SYSTEM_PROMPT =
  "You are an expert AI Video Localization Engineer and Cultural Dubbing Artist. Your job is to analyze an English video transcript and translate/localize it into natural, authentic, and culturally resonant Egyptian/Gulf Arabic.\n\n" +
  "Strict Engineering Rules:\n" +
  "1. Maintain exactly the same timestamps mapping from the input. Do not alter, omit, or merge timestamps.\n" +
  "2. The localized translation must match the pacing of the original text so that the dubbed audio fits perfectly within the timestamp duration.\n" +
  "3. Translate into \"Modern Egyptian/Gulf Casual Dialect\" (اللهجة العامية المصرية/الخليجية الحية). Avoid formal Modern Standard Arabic (الفصحى) or robotic literal translations. Use cultural idioms and natural phrasing.\n" +
  "4. Output the result STRICTLY as a valid JSON object matching the requested schema. Do not include markdown formatting (like ```json) in the raw API response text.";

const AI_STUDIO_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    localized_segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          start: { type: "number" },
          end: { type: "number" },
          original_text: { type: "string" },
          localized_text: { type: "string" },
        },
        required: ["id", "start", "end", "original_text", "localized_text"],
      },
    },
  },
  required: ["localized_segments"],
} as const;

type InputSegment = { start: number; end: number; text: string };

async function localizeWithGemini(
  key: string,
  segments: InputSegment[],
  targetLanguage: string,
  targetCountry: string,
): Promise<Array<{ id: number; start: number; end: number; localized_text: string }>> {
  const dialectHint =
    /^ar/i.test(targetLanguage) && /eg/i.test(targetCountry)
      ? "Egyptian Arabic"
      : /^ar/i.test(targetLanguage)
        ? "Gulf Arabic"
        : `${targetLanguage} (${targetCountry})`;
  const payload = {
    target_dialect: dialectHint,
    transcript_segments: segments.map((s, i) => ({
      id: i + 1,
      start: Number(s.start.toFixed(2)),
      end: Number(s.end.toFixed(2)),
      text: s.text,
    })),
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_STUDIO_SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Target language: ${targetLanguage}. Target country/dialect: ${targetCountry}.\n\nINPUT_JSON:\n${JSON.stringify(payload)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: AI_STUDIO_RESPONSE_SCHEMA,
        },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
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
  const out = Array.isArray(parsed?.localized_segments)
    ? parsed.localized_segments
        .map((s: any, i: number) => ({
          id: Number(s.id) || i + 1,
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          localized_text: String(s.localized_text || "").trim(),
        }))
        .filter((s: any) => s.localized_text)
    : [];
  if (!out.length) throw new Error("Gemini returned no localized_segments");
  return out;
}

async function synthesizeCartesia(
  key: string,
  text: string,
  language: string,
  voiceId: string,
  targetDurationSeconds: number,
): Promise<string> {
  let speed = 0;
  if (targetDurationSeconds > 0 && text.length > 0) {
    const estSec = text.length / 15;
    const ratio = estSec / targetDurationSeconds;
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
      model_id: "sonic-2",
      transcript: text,
      voice: { mode: "id", id: voiceId, __experimental_controls: { speed } },
      output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
      language,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cartesia ${res.status}: ${body.slice(0, 200)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return `data:audio/mpeg;base64,${btoa(bin)}`;
}

export async function runClientDubbing(input: {
  segments: InputSegment[];
  targetLanguage: string;
  targetCountry: string;
  voiceGender: "female" | "male";
  onProgress?: (done: number, total: number) => void;
}): Promise<ClientDubResult> {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const cartesiaKey = import.meta.env.VITE_CARTESIA_API_KEY as string | undefined;
  if (!geminiKey) throw new Error("VITE_GEMINI_API_KEY not set");
  if (!cartesiaKey) throw new Error("VITE_CARTESIA_API_KEY not set");
  if (!input.segments.length) throw new Error("No transcript segments to dub");

  const localized = await localizeWithGemini(
    geminiKey,
    input.segments,
    input.targetLanguage,
    input.targetCountry,
  );

  const lang = normalizeLanguage(input.targetLanguage);
  const voiceId = voiceForLanguage(lang, input.voiceGender);

  const out: ClientDubSegment[] = new Array(localized.length);
  let done = 0;
  const concurrency = 4;
  const queue = localized.map((s, i) => ({ s, i }));
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      const dur = Math.max(0.4, item.s.end - item.s.start);
      const audioDataUrl = await synthesizeCartesia(
        cartesiaKey!,
        item.s.localized_text,
        lang,
        voiceId,
        dur,
      );
      out[item.i] = {
        start: item.s.start,
        end: item.s.end,
        text: item.s.localized_text,
        audioDataUrl,
      };
      done += 1;
      input.onProgress?.(done, localized.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return {
    localizedText: localized.map((s) => s.localized_text).join(" "),
    segments: out.filter(Boolean),
  };
}