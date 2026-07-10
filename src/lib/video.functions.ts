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
    "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    "https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4",
    "https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4",
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
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const tier = isAdmin ? "pro" : profile.tier;
    // Quota — admins bypass all limits
    if (!isAdmin) {
      if (tier === "free") {
        if (profile.clips_used >= FREE_CLIPS) {
          return { error: "limit" as const };
        }
      } else {
        if (profile.monthly_used >= PRO_MONTHLY) return { error: "limit" as const };
      }
    }
    // Premium features locked on free (admins get pro)
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
        watermarked: tier === "free" && !isAdmin,
        social_kit: socialKit ? { ...socialKit, autoEmojis, highlight } : { autoEmojis, highlight },
        status: "ready",
      };
    });
    const { data: inserted, error } = await supabase.from("videos").insert(rows).select();
    if (error) throw new Error(error.message);
    if (!isAdmin) {
      await supabase
        .from("profiles")
        .update({
          clips_used: profile.clips_used + 1,
          monthly_used: profile.monthly_used + 3,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }
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
      providedTranscript: z.string().max(20000).optional().default(""),
      providedSegments: z
        .array(
          z.object({
            start: z.number().nonnegative(),
            end: z.number().nonnegative(),
            text: z.string().min(1).max(1000),
            words: z
              .array(
                z.object({
                  start: z.number().nonnegative(),
                  end: z.number().nonnegative(),
                  text: z.string().min(1).max(200),
                }),
              )
              .max(400)
              .optional(),
          }),
        )
        .max(500)
        .optional()
        .default([]),
      voiceGender: z.enum(["female", "male"]).optional().default("female"),
      captionStyle: z
        .enum(["none", "classic", "tiktok", "neon", "karaoke", "minimal"])
        .optional()
        .default("none"),
      captionEmojis: z.boolean().optional().default(false),
      // Fully-client-side path: browser already ran Gemini + Cartesia; just
      // persist. Skips the server pipeline entirely when provided.
      providedDubbedSegments: z
        .array(
          z.object({
            start: z.number().nonnegative(),
            end: z.number().nonnegative(),
            text: z.string().min(1).max(2000),
            audioDataUrl: z.string().min(10).max(2_500_000),
          }),
        )
        .max(500)
        .optional()
        .default([]),
      providedLocalizedText: z.string().max(50_000).optional().default(""),
    }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (!profile) throw new Error("Profile missing");
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const tier = isAdmin ? "pro" : profile.tier;
    const maxDur = isAdmin ? Number.MAX_SAFE_INTEGER : (tier === "free" ? FREE_DUB_MAX_SECONDS : PRO_DUB_MAX_SECONDS);
    if (!isAdmin) {
      if (data.durationSeconds > maxDur) return { error: "duration" as const, maxDur };
      if (tier === "free" && profile.dubs_used >= FREE_DUBS) return { error: "limit" as const };
      if (tier === "pro" && profile.monthly_used >= PRO_MONTHLY) return { error: "limit" as const };
    }

    const style = tier === "free" && data.style !== "modern" && data.style !== "minimal" ? "modern" : data.style;
    const clientTranscript = data.providedTranscript?.trim() ?? "";
    const transcript = clientTranscript || mockTranscript(profile.dubs_used + Date.now());
    const socialKit = tier === "pro" ? (await import("./premium")).generateSocialKit(transcript) : null;

    // If the browser ran the full Gemini + Cartesia pipeline itself, skip
    // the server pipeline and just persist the client-produced audio.
    const clientRan =
      data.providedDubbedSegments && data.providedDubbedSegments.length > 0;
    // Ultra-fast Gemini/OpenAI -> Cartesia Sonic pipeline. Best-effort: on
    // failure we still return a video record but surface the error to the UI.
    let pipelineError: string | null = null;
    let dubbedAudioUrl: string | null = null;
    let localizedText: string | null = null;
    let ttsProvider: "cartesia" | "elevenlabs" | "lovable" | null = null;
    let dubbedSegments: Array<{ start: number; end: number; text: string; audioDataUrl: string }> | null = null;
    let transcriptSource: "whisper" | "mock" | null = null;
    if (clientRan) {
      dubbedSegments = data.providedDubbedSegments!;
      dubbedAudioUrl = dubbedSegments[0]?.audioDataUrl ?? null;
      localizedText =
        data.providedLocalizedText?.trim() || dubbedSegments.map((s) => s.text).join(" ");
      ttsProvider = "cartesia";
      transcriptSource = "whisper";
      console.log(`[createDub] client pipeline ok segments=${dubbedSegments.length}`);
    } else {
    try {
      const { runDubbingPipeline } = await import("./dubbing-pipeline.server");
      const result = await runDubbingPipeline({
        transcript,
        targetLanguage: data.targetLanguage,
        targetCountry: data.targetCountry,
        durationSeconds: data.durationSeconds,
        // If the client already transcribed the upload, skip server-side ASR
        // (the upload:// URL isn't reachable from the server anyway).
        sourceUrl: clientTranscript ? null : data.sourceUrl || null,
        skipAsr: !!clientTranscript,
        providedSegments: data.providedSegments,
        voiceGender: data.voiceGender,
      });
      if (result.ok) {
        dubbedAudioUrl = result.audioDataUrl;
        localizedText = result.localizedText;
        ttsProvider = result.provider;
        dubbedSegments = result.segments ?? null;
        transcriptSource = result.transcriptSource ?? null;
        console.log(
          `[createDub] pipeline ok llm=${result.llm} tts=${result.provider} segs=${result.segments?.length ?? 0} src=${result.transcriptSource ?? "mock"} elapsed=${result.elapsedMs}ms`,
        );
      } else {
        pipelineError = `${result.stage}: ${result.message}`;
        console.warn("[createDub] pipeline error:", pipelineError);
      }
    } catch (e: any) {
      pipelineError = e?.message ?? "Pipeline crashed";
      console.error("[createDub] pipeline crashed:", e);
    }
    }

    const enrichedSocialKit = socialKit || dubbedAudioUrl || localizedText
      ? {
          ...(socialKit ?? {}),
          dubbed_audio_url: dubbedAudioUrl,
          localized_text: localizedText,
          tts_provider: ttsProvider,
          dubbed_segments: dubbedSegments,
          transcript_source: transcriptSource,
          voice_gender: data.voiceGender,
          caption_style: data.captionStyle,
          caption_emojis: data.captionEmojis,
        }
      : null;

    const { data: inserted, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        kind: "dub",
        title: socialKit?.title ? `${socialKit.title} (${data.targetCountry})` : `${data.title} \u2014 ${data.targetCountry}`,
        source_url: data.sourceUrl || null,
        output_url: data.sourceUrl?.trim() ? data.sourceUrl : sampleOutput("dub"),
        style,
        target_language: data.targetLanguage,
        target_country: data.targetCountry,
        watermarked: tier === "free" && !isAdmin,
        social_kit: enrichedSocialKit,
        status: "ready",
        duration_seconds: data.durationSeconds,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!isAdmin) {
      await supabase
        .from("profiles")
        .update({
          dubs_used: profile.dubs_used + 1,
          monthly_used: profile.monthly_used + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }
    return { video: inserted, pipelineError };
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
