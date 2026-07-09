import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Transcribes an uploaded audio/video file via Lovable AI Gateway STT
// (openai/gpt-4o-mini-transcribe). Accepts base64 bytes because server
// functions are JSON-only. Keep the client-side cap ~15MB base64.
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
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "LOVABLE_API_KEY missing" };

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > 24 * 1024 * 1024) {
      return { ok: false as const, error: "File too large (24MB max)" };
    }

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
    const baseMime = data.mimeType.split(";")[0].trim();
    const ext = extMap[baseMime] ?? (data.filename.split(".").pop() || "mp4");

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: baseMime }), `upload.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
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
    return { ok: true as const, text };
  });