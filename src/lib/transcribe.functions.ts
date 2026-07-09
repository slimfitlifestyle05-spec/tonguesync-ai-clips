import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TranscriptSegment = { start: number; end: number; text: string };

// Try Gemini inline audio → segment-level timestamps for tight lip-sync.
// Uses the user's personal GEMINI_API_KEY(_2). Returns null if unavailable.
async function transcribeWithGeminiInline(
  bytes: Buffer,
  mime: string,
): Promise<{ text: string; segments: TranscriptSegment[] } | null> {
  const keys = [
    process.env.GEMINI_API_KEY?.trim(),
    process.env.GEMINI_API_KEY_2?.trim(),
    process.env.VITE_GEMINI_API_KEY?.trim(),
    process.env.VITE_GEMINI_API_KEY_2?.trim(),
  ].filter(Boolean) as string[];
  if (!keys.length) return null;
  const base64 = bytes.toString("base64");
  const prompt =
    "Transcribe the spoken audio in this media verbatim in its ORIGINAL language. " +
    "Return ONLY a JSON array (no markdown, no prose) of objects with keys " +
    '"start" (seconds, number), "end" (seconds, number), "text" (string). ' +
    "Split at natural sentence/phrase boundaries — aim for 1–8s per segment " +
    "so the dub can be time-aligned to the original speaker. " +
    "If there is no speech, return [].";
  for (const key of keys) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { parts: [{ inlineData: { mimeType: mime, data: base64 } }, { text: prompt }] },
            ],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
        },
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("[transcribeUpload] gemini failed", res.status, body.slice(0, 200));
        continue;
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
      const segments: TranscriptSegment[] = (Array.isArray(parsed) ? parsed : [])
        .map((s: any) => ({
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          text: String(s.text || "").trim(),
        }))
        .filter((s) => s.text && s.end > s.start);
      const text = segments.map((s) => s.text).join(" ").trim();
      if (text) return { text, segments };
    } catch (e: any) {
      console.warn("[transcribeUpload] gemini key error:", e?.message ?? e);
    }
  }
  return null;
}

// Transcribes an uploaded audio/video file. Prefers Gemini inline (with
// per-segment timestamps for lip-sync). Falls back to Lovable AI Gateway
// STT (openai/gpt-4o-mini-transcribe) which returns text only.
export const transcribeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        base64: z.string().min(1),
        mimeType: z.string().min(1).max(100),
        filename: z.string().min(1).max(200),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > 24 * 1024 * 1024) {
      return { ok: false as const, error: "File too large (24MB max)" };
    }
    const baseMime = data.mimeType.split(";")[0].trim() || "video/mp4";

    // 1) Best path — Gemini with sentence-level timestamps.
    if (bytes.byteLength <= 18 * 1024 * 1024) {
      const g = await transcribeWithGeminiInline(bytes, baseMime);
      if (g && g.text) {
        return { ok: true as const, text: g.text, segments: g.segments };
      }
    }

    // 2) Fallback — Lovable AI STT (text only, no segments).
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) return { ok: false as const, error: "No transcription provider available" };

    // Pick an extension that matches the container — OpenAI infers format from name.
    const extMap: Record<string, string> = {
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
      "audio/webm": "webm",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/wav": "wav",
      "audio/x-wav": "wav",
    };
    const ext = extMap[baseMime] ?? (data.filename.split(".").pop() || "mp4");

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: baseMime }), `upload.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[transcribeUpload] gateway", res.status, body.slice(0, 300));
      return { ok: false as const, error: `Transcription failed (${res.status})` };
    }
    const json: any = await res.json().catch(() => ({}));
    const text: string = typeof json?.text === "string" ? json.text.trim() : "";
    if (!text) return { ok: false as const, error: "Empty transcript" };
    return { ok: true as const, text, segments: [] as TranscriptSegment[] };
  });