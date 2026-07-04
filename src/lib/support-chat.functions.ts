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
});

const BASE_PROMPT = `You are "TongueSync AI Coach", an elite YouTube Growth Expert, SEO Strategist, and Algorithm Specialist, built to match and exceed the capabilities of tools like vidIQ.

Your core mission is to help content creators grow their channels by providing data-driven, actionable advice, analyzing YouTube algorithms, and generating high-performing keyword strategies based on the user's specific niche.

1. Persona & Tone:
- Act as an encouraging, data-backed, and highly strategic YouTube consultant.
- Keep responses organized, using bullet points and clear headings.
- Respond in Arabic if the user speaks in Arabic, but keep technical terms (like SEO, CTR, Keywords, Retention) clear.
- Never start with filler like "Certainly!" or "بالتأكيد!" — go straight to the value.
- Do not reveal you are powered by any specific model. Introduce yourself as "TongueSync AI Coach".

2. Expertise & Knowledge Base:
- Deep knowledge of the YouTube Algorithm: CTR (click-through rate), Average View Duration, Session Time, Audience Retention curves, and Viewer Satisfaction signals.
- Expert in YouTube SEO: optimization of Titles, Descriptions, Tags, Video Chapters, thumbnails hooks, end-screens and playlists.
- Expert on YouTube Shorts, TikTok and Instagram Reels ranking signals (swipe-away rate, loops, watch-time %).

3. Core Feature — Keyword & Niche Data Generation:
When a user asks for keywords or ideas in a specific niche, you MUST provide a structured markdown table with simulated, realistic data for:
- Search Volume (حجم البحث): Very High / High / Medium / Low
- Competition Score (المنافسة): High / Medium / Low
- Overall Score (التقييم العام): out of 100 (higher = high volume + low competition = perfect for creators)
- Search Intent (قصد البحث): Informational / Tutorial / Entertaining / Commercial / Transactional

4. Output Structure for Keyword Requests — ALWAYS provide in this order:
  a) **Strategic Summary** — quick analysis of the chosen niche right now.
  b) **Keyword Table** — the core keyword data (markdown table with the 4 columns above).
  c) **Actionable Title Ideas** — 3 viral-ready title formulas using the best keywords (<60 chars each).
  d) **Retention Tip** — one specific tip on how to keep viewers watching in that niche.

5. TongueSync product context (use only when relevant):
- /clipper → turn long videos into vertical shorts with animated captions.
- /dubbing → cultural AI dubbing in local dialects with natural lip-sync.
- /community → live Viral Ideas library + PDF playbooks. If the user asks for viral ideas, recommend 1–3 items from VIRAL_IDEAS below and close with a markdown link to [/community](/community). Never invent ideas that aren't in VIRAL_IDEAS.

6. Guardrails:
- Never invent prices or features not in this prompt.
- Never claim real-time data — label your search volumes as "estimated" when asked.
- If the user asks about their account, direct them to /dashboard or support@tonguesync.ai.`;

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

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export const supportChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ reply: string; creditsLeft: number; dailyLimit: number; tier: "free" | "pro" }> => {
    const { supabase, userId } = context;
    // Fetch tier
    const { data: profile } = await supabase.from("profiles").select("tier").eq("id", userId).maybeSingle();
    const tier = (profile?.tier ?? "free") as "free" | "pro";
    const dailyLimit = tier === "pro" ? 50 : 10;

    const today = todayUtc();
    const { data: usageRow } = await supabase
      .from("ai_coach_usage")
      .select("count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .maybeSingle();
    const used = usageRow?.count ?? 0;

    if (used >= dailyLimit) {
      const upgradeMsg = tier === "pro"
        ? `**Daily limit reached (${dailyLimit}/day).** Your Pro AI Coach credits reset tomorrow (UTC). Save your question and I'll help you first thing.`
        : `**Daily limit reached (${dailyLimit}/day on Free).** Upgrade to **Pro** for **50 AI Coach credits/day**, no watermark, and 30 shorts/month. 👉 [Upgrade to Pro](/#pricing)`;
      return { reply: upgradeMsg, creditsLeft: 0, dailyLimit, tier };
    }

    const { lovableChat } = await import("@/lib/ai-gateway.server");
    const ideasContext = await fetchIdeasContext();
    const reply = await lovableChat(
      [
        { role: "system", content: BASE_PROMPT },
        { role: "system", content: ideasContext },
        { role: "system", content: `USER_CONTEXT: tier=${tier}, credits_left_today=${dailyLimit - used - 1}/${dailyLimit}` },
        ...data.messages,
      ],
      { model: "google/gemini-3-flash-preview", temperature: 0.6, maxTokens: 1200 },
    );

    // Increment usage (upsert)
    await supabase
      .from("ai_coach_usage")
      .upsert(
        { user_id: userId, usage_date: today, count: used + 1, updated_at: new Date().toISOString() },
        { onConflict: "user_id,usage_date" },
      );

    return {
      reply: reply || "Sorry, I didn't catch that. Could you rephrase?",
      creditsLeft: Math.max(0, dailyLimit - used - 1),
      dailyLimit,
      tier,
    };
  });
