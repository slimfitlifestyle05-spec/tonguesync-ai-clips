// Server-only chat helper.
//
// Routing strategy — enforced in this order on EVERY call:
//   1. Personal Google AI Studio keys (GEMINI_API_KEY / GEMINI_API_KEY_2 /
//      VITE_GEMINI_API_KEY / VITE_GEMINI_API_KEY_2) → call Google's
//      Generative Language API directly. The second key acts as a fallback
//      when the first hits quota, so the shared Lovable quota is never touched.
//   2. Only if no personal key is configured (or all are exhausted), fall back
//      to Lovable's AI Gateway (LOVABLE_API_KEY).
//
// Both paths return the assistant's text content as a string.

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function getPersonalGeminiKey(): string | null {
  // Prefer the user's personal Google AI Studio key. Accept the VITE_
  // prefixed variant too because that's the name the user configured.
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

function getLovableKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

// Map a "vendor/model" gateway id (e.g. "google/gemini-3-flash-preview") to
// a native Google model name. Anything not obviously Gemini is coerced to a
// safe default so a personal key can still handle it.
function toGoogleModel(vendorModel: string | undefined): string {
  const m = (vendorModel ?? "").toLowerCase();
  if (!m || !m.includes("gemini")) return "gemini-2.5-pro";
  // Strip vendor prefix ("google/") and any "-preview" suffix that the
  // native API doesn't accept.
  const bare = m.replace(/^google\//, "").replace(/-preview$/, "");
  // Native API accepts these families; fall back to 2.5-pro for unknown ids.
  if (
    bare.startsWith("gemini-1.5") ||
    bare.startsWith("gemini-2.0") ||
    bare.startsWith("gemini-2.5")
  ) {
    return bare;
  }
  return "gemini-2.5-pro";
}

async function geminiDirectChat(
  key: string,
  messages: ChatMessage[],
  opts: ChatOptions,
): Promise<string> {
  const model = toGoogleModel(opts.model);
  const systemText = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  };
  if (systemText) body.systemInstruction = { role: "system", parts: [{ text: systemText }] };

  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Your Gemini API key is rate-limited. Please wait and retry.");
    if (res.status === 403) throw new Error("Your Gemini API key was rejected (403). Check the key and its quota.");
    throw new Error(`Gemini API error (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

export async function lovableChat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  // 1) Personal Gemini key takes precedence — bypass Lovable's gateway entirely.
  const personal = getPersonalGeminiKey();
  if (personal) {
    return geminiDirectChat(personal, messages, opts);
  }

  // 2) No personal key configured — fall back to Lovable's AI Gateway.
  const res = await fetch(LOVABLE_GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": getLovableKey(),
    },
    body: JSON.stringify({
      model: opts.model ?? "google/gemini-3-flash-preview",
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please top up in workspace settings.");
    throw new Error(`AI gateway error (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}