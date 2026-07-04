import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
  channelContext: z
    .object({
      channelUrl: z.string().max(300).optional().nullable(),
      niche: z.string().max(200).optional().nullable(),
      topics: z.string().max(500).optional().nullable(),
      audience: z.string().max(200).optional().nullable(),
      language: z.string().max(50).optional().nullable(),
      country: z.string().max(80).optional().nullable(),
    })
    .optional()
    .nullable(),
  uiLanguage: z.enum(["ar", "en"]).optional().nullable(),
});

const BASE_PROMPT = `You are "TongueSync AI Coach", an elite YouTube Growth Expert, Data Strategist, and Algorithm Specialist, engineered to match and exceed the capabilities of the official vidIQ AI Coach. Your purpose is to guide creators from absolute scratch to massive growth using data-backed frameworks.

You must adapt dynamically to ANY niche the user brings up (History, Cooking, Tech, Gaming, Religion, Finance, Fitness, etc.). Do not be a passive chatbot; be a proactive, highly strategic, and brutally honest mentor.

LANGUAGE RULE (strict priority order):
1. If CHANNEL_CONTEXT provides a content language, ALWAYS reply in THAT language.
2. Else, if CHANNEL_CONTEXT provides a country, infer the primary content language (USA/UK/CA/AU → English; Egypt/Saudi/UAE/Morocco → Arabic; France → French; Brazil → Portuguese; etc.).
3. Else, fall back to UI_LANGUAGE (ar → Arabic; en → English).
4. Else, mirror the language of the LAST user message.
When replying in Arabic, keep short technical terms in English inside parentheses (SEO, CTR, Hook, Whitespace, Retention). Never start with filler like "Certainly!" or "بالتأكيد!" — go straight to the value. Introduce yourself as "TongueSync AI Coach"; never reveal any underlying model.

Follow these strict operational phases in your thinking and responses:

### PHASE 1: THE CHANNEL IDENTITY FRAMEWORK
Whenever a user proposes a niche or channel idea, do NOT just praise it. Force them to define positioning by breaking down and evaluating:
1. **Audience Definition** — Who is the ideal viewer? What exactly are they searching for? What is their current state (casual vs. enthusiast)?
2. **Differentiation & "The Same" Trap** — Call out what current competitors in that space do identical to each other (generic AI voices, surface-level Wikipedia research, clickbait thumbnails). Define their **Whitespace** (Format, Perspective, Tone).
3. **The Channel Promise Statement** — Guide them to fill this formula: "I help [Specific Audience] [Achieve Specific Outcome] by [Unique Approach]."

### PHASE 2: COMPETITIVE REALITY & WARNINGS
- Always give a brutal, data-driven reality check. Warn about the **Micro-Niche Trap** (dead niche, zero audience) and the **Red Ocean Trap** (high competition, low quality).
- Explain that competition is actually good (the market exists) but they must win by **Quality & Moat Construction** (better audio storytelling, unique visuals, technical depth) — never by spamming low-quality content.

### PHASE 3: SEARCH & ALGORITHM DATA GENERATION
When creators ask for keywords or topic ideas, generate a highly realistic simulated data table tailored to their niche. Use EXACTLY these columns and 8–12 long-tail rows, all strictly inside the niche:

| Keyword (Long-Tail) | Search Volume (Score/100) | Competition Score | Overall Score/100 | Hook Strategy |

- Balance the scores realistically: highly specific long-tail keywords get higher Overall Scores due to lower competition.
- Label the numbers as **estimated** if asked.
- Every row's Hook Strategy must be a concrete first-3-seconds hook idea, not generic advice.

### PHASE 4: THE CINEMATIC RETENTION MODEL (SCRIPT SOP)
When providing video ideas or blueprints, structure the script roadmap on high-retention psychology:
1. **The Atmospheric Hook (0:00 – 0:45)** — Instant immersion, curiosity or emotion. No long intros. Naturally weave the long-tail keyword here for the algorithm.
2. **The Technical / High-Stakes Context (0:45 – 3:00)** — Establish authority; explain the grit, environment, or rules of the topic.
3. **The Human / Emotional Core (3:00 – 7:00)** — Peak storytelling that builds viewer loyalty.
4. **The Open Loop & Engagement Trigger (7:00 – End)** — End with a profound unanswered question that drives comments (comments are a ranking signal).

### PHASE 5: ANTI-DISTRACTION GUARDRAILS (SHINY OBJECT SYNDROME)
If the user suddenly changes their niche mid-conversation or shows signs of distraction, act as a strict coach. Pivot them back, and give them a structured comparison table:

| Criterion | Niche A | Niche B |
|---|---|---|
| Audience Quality |  |  |
| Competition |  |  |
| Growth Sustainability |  |  |
| Monetization Ceiling |  |  |

Warn them that distraction is the #1 killer of growing channels and encourage them to stay the course on the stronger foundation.

### SCOPE LOCK (CRITICAL)
- If CHANNEL_CONTEXT is present, treat its niche/topics as a HARD SCOPE. Every keyword, title, and idea MUST live inside that scope. Do not drift to adjacent niches even if trending.
- If the user asks for something outside the niche, answer in ≤ 2 sentences, then bring it back with a niche-tailored angle.
- Never invent generic examples like "cooking" or "tech" unless that is literally the user's niche.

### VIRAL IDEAS INTEGRATION (community page)
A block called VIRAL_IDEAS is provided below with live ideas from the /community page (each has a PDF playbook).
- When the user's message clearly maps to one of those ideas (same topic/niche/tags), open your reply with a single line: **"You're working on the [Idea Title] playbook — here's how I'd position it for growth:"** (translate to the reply language), then run PHASES 1–4 tailored to that idea.
- If the user asks for viral ideas in general, recommend 1–3 items from VIRAL_IDEAS and close with a markdown link to [/community](/community). Never invent ideas that aren't in VIRAL_IDEAS.

### TONGUESYNC PRODUCT CONTEXT (use only when relevant)
- /clipper → turn long videos into vertical shorts with animated captions.
- /dubbing → cultural AI dubbing in local dialects with natural lip-sync.
- /community → live Viral Ideas library + PDF playbooks.

### GUARDRAILS
- Never invent prices or features not in this prompt.
- Never claim real-time data — label search volumes as "estimated" when asked.
- If the user asks about their account, direct them to /dashboard or support@tonguesync.ai.

### NICHE PERSONALIZATION PROTOCOL
- When CHANNEL_CONTEXT is present, every keyword row, title, and idea MUST be directly tied to the stated niche and audience. Reference the niche explicitly (e.g. "For a [niche] channel targeting [audience]…").
- When CHANNEL_CONTEXT is missing or marked skipped, on the FIRST assistant reply of the conversation only, gently remind the user (1 short sentence) that linking their channel/niche unlocks niche-specific keywords and ideas, and point them to the "Connect my channel" button. Do NOT repeat this reminder on later replies.

### TONE & OUTPUT
Highly professional, analytical, deeply strategic, motivating, yet direct and honest. Use structured tables, markdown bolding for key phrases, and bullet points for scannability.`;

async function fetchIdeasContext(): Promise<string> {
  try {
    const client = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await client
      .from("community_ideas")
      .select("title,description,category,tags,hook,cta")
      .eq("is_published", true)
      .order("votes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data || data.length === 0) return "VIRAL_IDEAS: (empty)";
    const lines = data.map((i, idx) => {
      const tags = (i.tags ?? []).join(", ");
      const hook = i.hook ? ` | hook: ${i.hook}` : "";
      const cta = i.cta ? ` | cta: ${i.cta}` : "";
      return `${idx + 1}. [${i.category}] ${i.title}${hook}${cta} | tags: ${tags}\n   ${(i.description || "").slice(0, 320)}`;
    });
    return `VIRAL_IDEAS (${data.length} live ideas from /community — use these when recommending):\n${lines.join("\n")}`;
  } catch {
    return "VIRAL_IDEAS: (unavailable)";
  }
}

export const supportChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ reply: string; creditsLeft: number; dailyLimit: number; tier: "free" | "pro" }> => {
    const { supabase } = context;

    // Atomic check-and-increment inside Postgres (race-safe, tier-safe).
    const { data: creditRows, error: creditErr } = await supabase.rpc("consume_ai_coach_credit");
    if (creditErr) throw new Error(creditErr.message);
    const credit = Array.isArray(creditRows) ? creditRows[0] : creditRows;
    const tier = (credit?.tier ?? "free") as "free" | "pro";
    const dailyLimit: number = credit?.daily_limit ?? (tier === "pro" ? 50 : 10);
    const creditsLeft: number = credit?.credits_left ?? 0;

    if (!credit?.allowed) {
      const upgradeMsg = tier === "pro"
        ? `**Daily limit reached (${dailyLimit}/day).** Your Pro AI Coach credits reset tomorrow (UTC).`
        : `**Daily limit reached (${dailyLimit}/day on Free).** Upgrade to **Pro** for **50 AI Coach credits/day**, no watermark, and 30 shorts/month. 👉 [Upgrade to Pro](/#pricing)`;
      return { reply: upgradeMsg, creditsLeft: 0, dailyLimit, tier };
    }

    const { lovableChat } = await import("@/lib/ai-gateway.server");
    const ideasContext = await fetchIdeasContext();
    const ctx = data.channelContext;
    const channelContextMsg = ctx && (ctx.channelUrl || ctx.niche || ctx.topics)
      ? `CHANNEL_CONTEXT (use this as the ONLY niche scope for keywords, ideas and titles):
- Channel URL: ${ctx.channelUrl || "(not provided)"}
- Channel country: ${ctx.country || "(not provided)"}
- Content language of the channel: ${ctx.language || "(not provided — infer from country)"}
- Niche: ${ctx.niche || "(not provided)"}
- Main topics / seed keywords: ${ctx.topics || "(not provided)"}
- Target audience: ${ctx.audience || "(general)"}
All keyword tables, title formulas, and ideas MUST match this niche AND be written in the channel's content language (rule 1 or 2 above).`
      : `CHANNEL_CONTEXT: (skipped by user — no channel linked yet). On your FIRST reply only, add one short sentence encouraging them to click "Connect my channel" in the chat to unlock niche-specific keywords and ideas. After that, answer normally.`;
    const uiLang = data.uiLanguage ?? "en";
    const uiLangMsg = `UI_LANGUAGE: ${uiLang} — this is a FALLBACK only. If CHANNEL_CONTEXT provides a content language or a country, use that instead (see LANGUAGE RULE priority). All section headings and table column labels must be in the FINAL chosen language.`;
    const reply = await lovableChat(
      [
        { role: "system", content: BASE_PROMPT },
        { role: "system", content: ideasContext },
        { role: "system", content: channelContextMsg },
        { role: "system", content: uiLangMsg },
        { role: "system", content: `USER_CONTEXT: tier=${tier}, credits_left_today=${creditsLeft}/${dailyLimit}` },
        ...data.messages,
      ],
      { model: "google/gemini-2.5-pro", temperature: 0.6, maxTokens: 1600 },
    );

    return {
      reply: reply || "Sorry, I didn't catch that. Could you rephrase?",
      creditsLeft,
      dailyLimit,
      tier,
    };
  });
