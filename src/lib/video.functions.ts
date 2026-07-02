import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FREE_CLIPS = 3;
const FREE_DUBS = 1;
const FREE_DUB_MAX_SECONDS = 30;
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
    const socialKit = tier === "pro" ? (await import("./premium")).generateSocialKit(data.title) : null;

    const rows = Array.from({ length: 3 }).map((_, i) => ({
      user_id: userId,
      kind: "clip" as const,
      title: `${data.title} \u2014 Short ${i + 1}`,
      source_url: data.sourceUrl || null,
      output_url: sampleOutput("clip", i),
      style,
      language: data.language,
      watermarked: tier === "free",
      social_kit: socialKit ? { ...socialKit, autoEmojis, highlight } : { autoEmojis, highlight },
      status: "ready",
    }));
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
    const socialKit = tier === "pro" ? (await import("./premium")).generateSocialKit(data.title) : null;

    const { data: inserted, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        kind: "dub",
        title: `${data.title} \u2014 ${data.targetCountry}`,
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
