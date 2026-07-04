import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChannelContext = {
  channelUrl: string | null;
  niche: string | null;
  topics: string | null;
  audience: string | null;
  language: string | null;
};

const SaveSchema = z.object({
  channelUrl: z.string().trim().max(300).optional().nullable(),
  niche: z.string().trim().max(200).optional().nullable(),
  topics: z.string().trim().max(500).optional().nullable(),
  audience: z.string().trim().max(200).optional().nullable(),
  language: z.string().trim().max(50).optional().nullable(),
});

function norm(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  return t.length ? t : null;
}

export const getChannelContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChannelContext | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("youtube_channel_url,niche,topics,audience,content_language")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    if (!data.youtube_channel_url && !data.niche && !data.topics && !data.audience) return null;
    return {
      channelUrl: data.youtube_channel_url ?? null,
      niche: data.niche ?? null,
      topics: data.topics ?? null,
      audience: data.audience ?? null,
      language: data.content_language ?? null,
    };
  });

export const saveChannelContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }): Promise<ChannelContext> => {
    const { supabase, userId } = context;
    const payload = {
      youtube_channel_url: norm(data.channelUrl),
      niche: norm(data.niche),
      topics: norm(data.topics),
      audience: norm(data.audience),
      content_language: norm(data.language),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (error) throw new Error(error.message);
    return {
      channelUrl: payload.youtube_channel_url,
      niche: payload.niche,
      topics: payload.topics,
      audience: payload.audience,
      language: payload.content_language,
    };
  });

export const clearChannelContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        youtube_channel_url: null,
        niche: null,
        topics: null,
        audience: null,
        content_language: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });