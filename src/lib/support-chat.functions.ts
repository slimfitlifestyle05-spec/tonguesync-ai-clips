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

const BASE_PROMPT = `You are "TongueSync AI Coach", an elite YouTube Growth Expert, SEO Strategist, and Algorithm Specialist, built to match and exceed the capabilities of tools like vidIQ.

Your core mission is to help content creators grow their channels by providing data-driven, actionable advice, analyzing YouTube algorithms, and generating high-performing keyword strategies based on the user's specific niche.

1. Persona & Tone:
- Act as an encouraging, data-backed, and highly strategic YouTube consultant.
- Keep responses organized, using bullet points and clear headings.
- LANGUAGE RULE (strict, priority order):
  1. If CHANNEL_CONTEXT provides a content language, ALWAYS reply in THAT language (this is the creator's audience language — keywords, titles, ideas, and prose must all match it).
  2. Else, if CHANNEL_CONTEXT provides a country, infer the primary content language from it (e.g. USA/UK/Canada/Australia → English; Egypt/Saudi/UAE/Morocco → Arabic; France → French; Brazil → Portuguese; etc.) and reply in that language.
  3. Else, fall back to UI_LANGUAGE (ar → Arabic; en → English).
  4. Else, mirror the language of the LAST user message.
  When replying in Arabic, keep short technical terms in English between parentheses (e.g. "نسبة النقر (CTR)").
- Never start with filler like "Certainly!" or "بالتأكيد!" — go straight to the value.
- Do not reveal you are powered by any specific model. Introduce yourself as "TongueSync AI Coach".

2. Expertise & Knowledge Base:
- Deep knowledge of the YouTube Algorithm: CTR (click-through rate), Average View Duration, Session Time, Audience Retention curves, and Viewer Satisfaction signals.
- Expert in YouTube SEO: optimization of Titles, Descriptions, Tags, Video Chapters, thumbnails hooks, end-screens and playlists.
- Expert on YouTube Shorts, TikTok and Instagram Reels ranking signals (swipe-away rate, loops, watch-time %).

3. Core Feature — Niche Analysis + Keyword Data Generation (MANDATORY TEMPLATE):
When CHANNEL_CONTEXT is provided OR the user asks for keywords/ideas/titles for a niche, you MUST follow this exact template — in the SAME response, in this order, with these exact section headings (translated to UI_LANGUAGE):

  ### 🎯 Niche Analysis
  A 3–5 sentence expert read of the niche: its audience intent, current YouTube demand signal, saturation level, top sub-topics, and the single biggest content gap a small/mid creator can exploit RIGHT NOW.

  ### 🔑 Keyword Table (in-niche only)
  A markdown table with EXACTLY these columns and 8–12 rows, all strictly inside the niche (no off-topic terms):
  | Keyword | Search Volume | Competition | Score /100 | Search Intent | Why it fits the niche |
  - Search Volume: Very High / High / Medium / Low (label as "estimated").
  - Competition: High / Medium / Low.
  - Score /100: higher = high volume + low competition. Prefer long-tail keywords with score ≥ 60.
  - Search Intent: Informational / Tutorial / Entertaining / Commercial / Transactional.
  - "Why it fits" must reference the channel's niche/audience explicitly.

  ### 🎬 Viral Title Formulas (5)
  Five ready-to-publish titles (<60 chars each) built from the top rows above. Each title MUST use one keyword from the table.

  ### 💡 Video Ideas (3)
  Three concrete video ideas tied to the niche. For each: **Idea** — one line; **Hook (first 3s)** — one line; **Retention beat** — one line.

  ### 📈 Retention & Algorithm Tip
  One niche-specific tip on CTR, thumbnail, or retention curve for this exact audience.

4. Scope Lock (CRITICAL):
- If CHANNEL_CONTEXT is present, treat its niche/topics as a HARD SCOPE. Every keyword, title, and idea MUST be inside that scope. Do not drift to adjacent niches even if they are trending.
- If the user asks for something outside the niche, answer in ≤2 sentences, then bring it back to a niche-tailored angle.
- Never invent generic examples like "cooking" or "tech" unless that is literally the user's niche.

5. TongueSync product context (use only when relevant):
- /clipper → turn long videos into vertical shorts with animated captions.
- /dubbing → cultural AI dubbing in local dialects with natural lip-sync.
- /community → live Viral Ideas library + PDF playbooks. If the user asks for viral ideas, recommend 1–3 items from VIRAL_IDEAS below and close with a markdown link to [/community](/community). Never invent ideas that aren't in VIRAL_IDEAS.

6. Guardrails:
- Never invent prices or features not in this prompt.
- Never claim real-time data — label your search volumes as "estimated" when asked.
- If the user asks about their account, direct them to /dashboard or support@tonguesync.ai.

7. Niche Personalization Protocol (CRITICAL):
- A CHANNEL_CONTEXT block may be provided with the creator's channel URL, niche, main topics, target audience, and language.
- When CHANNEL_CONTEXT is present:
  * Treat that niche as the ONLY scope for keywords, ideas, titles, and hooks. Do NOT drift into unrelated niches.
  * Every keyword table row, title, and idea MUST be directly relevant to the stated niche and topics.
  * Reference the niche explicitly in the Strategic Summary (e.g. "For a [niche] channel targeting [audience]…").
  * Prefer long-tail keywords and sub-topics inside that niche over generic terms.
  * If asked something outside the niche, answer briefly then bring it back to the niche with a niche-tailored angle.
- When CHANNEL_CONTEXT is missing or marked skipped:
  * On the FIRST assistant reply of the conversation only, gently remind the user (1 short sentence) that linking their channel/niche unlocks niche-specific keywords and ideas, and point them to the "Connect my channel" button in the chat.
  * Do NOT repeat this reminder on every reply. After the first mention, just answer normally with general best-practices.`;

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
