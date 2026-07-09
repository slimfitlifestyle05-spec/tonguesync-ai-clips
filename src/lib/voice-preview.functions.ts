import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Short greeting per language so users can preview the dubbing voice
// in the exact target language before running the full pipeline.
const GREETINGS: Record<string, string> = {
  ar: "أهلاً بك. هذا هو الصوت الذي سيتحدث في الفيديو المدبلج.",
  en: "Hi there. This is the voice that will speak in your dubbed video.",
  es: "Hola. Esta es la voz que hablará en tu video doblado.",
  fr: "Bonjour. C'est la voix qui parlera dans votre vidéo doublée.",
  de: "Hallo. Das ist die Stimme, die im synchronisierten Video sprechen wird.",
  pt: "Olá. Esta é a voz que falará no seu vídeo dublado.",
  it: "Ciao. Questa è la voce che parlerà nel tuo video doppiato.",
  tr: "Merhaba. Dublajlı videonuzda konuşacak ses budur.",
  hi: "नमस्ते। यही आवाज़ आपके डब किए गए वीडियो में बोलेगी।",
  ja: "こんにちは。これは吹き替え動画で話す声です。",
  ko: "안녕하세요. 더빙된 영상에서 말할 목소리입니다.",
  zh: "你好。这是将在配音视频中说话的声音。",
  ru: "Привет. Это голос, который будет говорить в дублированном видео.",
  nl: "Hallo. Dit is de stem in je nagesynchroniseerde video.",
  pl: "Cześć. To jest głos, który wystąpi w dubbingu.",
};

function greetingFor(lang: string): string {
  const key = lang.toLowerCase().slice(0, 2);
  return GREETINGS[key] ?? GREETINGS.en;
}

export const previewDubbingVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        targetLanguage: z.string().min(2).max(6),
        text: z.string().max(400).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const text = data.text?.trim() || greetingFor(data.targetLanguage);

    // Reuse the same pipeline settings + Cartesia voice map so the preview
    // matches the voice the final dub will use.
    const { loadPipelineSettings } = await import("./dubbing-pipeline.server");
    const { apiKeys, ttsProvider, cartesiaModel } = await loadPipelineSettings();

    const attemptCartesia = async () => {
      if (!apiKeys.cartesia) return null;
      const mod = await import("./dubbing-pipeline.server");
      // We re-run the pipeline as a single-take TTS just for this preview.
      const result = await (mod as any).runDubbingPipeline({
        transcript: text,
        targetLanguage: data.targetLanguage,
        targetCountry: "",
        durationSeconds: Math.max(2, Math.ceil(text.length / 15)),
        skipAsr: true,
        providedSegments: [],
      });
      if (result?.ok && result.audioDataUrl) {
        return { audioDataUrl: result.audioDataUrl as string, provider: result.provider as string };
      }
      return null;
    };

    try {
      if (ttsProvider === "cartesia") {
        const c = await attemptCartesia();
        if (c) return { ok: true as const, ...c };
      }
    } catch (e: any) {
      console.warn("[voice-preview] cartesia failed:", e?.message ?? e);
    }

    // Fallback — Lovable AI TTS (no user key needed).
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "No TTS provider available" };
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: text,
          voice: "alloy",
          response_format: "mp3",
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[voice-preview] lovable", res.status, body.slice(0, 300));
        return { ok: false as const, error: `Preview failed (${res.status})` };
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const base64 = Buffer.from(buf).toString("base64");
      return { ok: true as const, audioDataUrl: `data:audio/mpeg;base64,${base64}`, provider: "lovable" };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Preview failed" };
    }
  });