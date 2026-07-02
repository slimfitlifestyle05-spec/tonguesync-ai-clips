import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_CLIPS = 3;
const FREE_DUBS = 3;
const FREE_DUB_MAX_SECONDS = 15;
const PRO_MONTHLY = 30;
const PRO_DUB_MAX_SECONDS = 60;

function sampleOutput(kind: "clip" | "dub", idx = 0) {
  const samples = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  ];
  return samples[(kind === "dub" ? 1 : idx) % samples.length];
}

// Mocked "transcription" step. In production this is the Gemini transcript of
// the uploaded video; for the demo we synthesize a plausible, topic-rich
// transcript so the AI Social Kit output looks like real content analysis.
const MOCK_TRANSCRIPTS = [
  "Here's the AI workflow I use to replace four hours of manual work every morning. I chain a Gemini agent with a scraper, feed the output into a prompt template, and the automation ships a first draft before I finish coffee. If you're a founder still doing this by hand in 2026, you're leaving hours on the table.",
  "Most small business owners underprice their offer and then wonder why revenue is flat. This is the exact pricing tweak we rolled out last month — same product, new positioning, sharper guarantee — and it doubled monthly revenue in thirty days without touching ad spend.",
  "Your content isn't converting because the hook is dying in the first three seconds. Here's the retention pattern top creators are using right now: pattern interrupt, promise, proof, payoff. Rebuild your last three posts around it before you publish anything new.",
  "There's a hidden setting on your phone that unlocks a genuinely useful automation, and almost nobody talks about it. I'll show you the two taps to enable it and the tiny workflow that saves me about twenty minutes a day.",
];

function mockTranscript(seedIdx: number) {
  return MOCK_TRANSCRIPTS[seedIdx % MOCK_TRANSCRIPTS.length];
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    return { profile, isAdmin };
  });

export const listMyVideos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("videos").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  });

export const getVideoById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: video } = await supabase
      .from("videos")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    return video;
  });

export const createClips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      sourceUrl: z.string().max(2000).optional().default(""),
      style: z.string().min(1).max(30),
      language: z.string().min(2).max(6),
      autoEmojis: z.boolean().optional().default(false),
      highlight: z.boolean().optional().default(false),
    }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Profile missing");
    const tier = profile.tier;
    // Quota
    if (tier === "free") {
      if (profile.clips_used >= FREE_CLIPS) {
        return { error: "limit" as const };
      }
    } else {
      if (profile.monthly_used >= PRO_MONTHLY) return { error: "limit" as const };
    }
    // Premium features locked on free
    const style = tier === "free" && data.style !== "modern" && data.style !== "minimal" ? "modern" : data.style;
    const autoEmojis = tier === "pro" ? data.autoEmojis : false;
    const highlight = tier === "pro" ? data.highlight : false;
    const premium = tier === "pro" ? await import("./premium") : null;

    // Each short gets its own "transcript slice" and its own analyzed Social Kit.
    const baseSeed = profile.clips_used + Date.now();
    const rows = Array.from({ length: 3 }).map((_, i) => {
      const transcript = mockTranscript(baseSeed + i);
      const socialKit = premium ? premium.generateSocialKit(transcript) : null;
      return {
        user_id: userId,
        kind: "clip" as const,
        title: socialKit?.title ?? `${data.title} \u2014 Short ${i + 1}`,
        source_url: data.sourceUrl || null,
        output_url: sampleOutput("clip", i),
        style,
        language: data.language,
        watermarked: tier === "free",
        social_kit: socialKit ? { ...socialKit, autoEmojis, highlight } : { autoEmojis, highlight },
        status: "ready",
      };
    });
    const { data: inserted, error } = await supabase.from("videos").insert(rows).select();
    if (error) throw new Error(error.message);
    await supabase
      .from("profiles")
      .update({
        clips_used: profile.clips_used + 1,
        monthly_used: profile.monthly_used + 3,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    return { videos: inserted };
  });

export const createDub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      title: z.string().min(1).max(200),
      sourceUrl: z.string().max(2000).optional().default(""),
      targetLanguage: z.string().min(2).max(6),
      targetCountry: z.string().min(2).max(4),
      style: z.string().min(1).max(30),
      durationSeconds: z.number().int().positive().max(600),
    }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Profile missing");
    const tier = profile.tier;
    const maxDur = tier === "free" ? FREE_DUB_MAX_SECONDS : PRO_DUB_MAX_SECONDS;
    if (data.durationSeconds > maxDur) return { error: "duration" as const, maxDur };
    if (tier === "free" && profile.dubs_used >= FREE_DUBS) return { error: "limit" as const };
    if (tier === "pro" && profile.monthly_used >= PRO_MONTHLY) return { error: "limit" as const };

    const style = tier === "free" && data.style !== "modern" && data.style !== "minimal" ? "modern" : data.style;
    const transcript = mockTranscript(profile.dubs_used + Date.now());
    const socialKit = tier === "pro" ? (await import("./premium")).generateSocialKit(transcript) : null;

    const { data: inserted, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        kind: "dub",
        title: socialKit?.title ? `${socialKit.title} (${data.targetCountry})` : `${data.title} \u2014 ${data.targetCountry}`,
        source_url: data.sourceUrl || null,
        output_url: sampleOutput("dub"),
        style,
        target_language: data.targetLanguage,
        target_country: data.targetCountry,
        watermarked: tier === "free",
        social_kit: socialKit,
        status: "ready",
        duration_seconds: data.durationSeconds,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase
      .from("profiles")
      .update({
        dubs_used: profile.dubs_used + 1,
        monthly_used: profile.monthly_used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    return { video: inserted };
  });

export const upgradeToPro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Billing skipped per user request. Flip tier for demo.
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({ tier: "pro", monthly_used: 0, monthly_period_start: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", userId);
    return { ok: true };
  });

export const LIMITS = { FREE_CLIPS, FREE_DUBS, FREE_DUB_MAX_SECONDS, PRO_MONTHLY, PRO_DUB_MAX_SECONDS } as const;
