import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function serverPublicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type CommunityIdea = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  hook: string | null;
  cta: string | null;
  thumbnail_url: string | null;
  thumbnail_signed_url: string | null;
  pdf_url: string | null;
  pdf_signed_url: string | null;
  youtube_video_url: string | null;
  votes: number;
  is_published: boolean;
  created_at: string;
};

async function signAsset(
  client: ReturnType<typeof serverPublicClient>,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  // External URLs already usable
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await client.storage.from("community").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

async function mapIdeas(client: ReturnType<typeof serverPublicClient>, rows: any[]): Promise<CommunityIdea[]> {
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      tags: r.tags ?? [],
      hook: r.hook,
      cta: r.cta,
      thumbnail_url: r.thumbnail_url,
      pdf_url: r.pdf_url,
      thumbnail_signed_url: await signAsset(client, r.thumbnail_url),
      pdf_signed_url: await signAsset(client, r.pdf_url),
      youtube_video_url: r.youtube_video_url ?? null,
      votes: r.votes,
      is_published: r.is_published,
      created_at: r.created_at,
    })),
  );
}

export const listCommunityIdeas = createServerFn({ method: "GET" }).handler(async (): Promise<CommunityIdea[]> => {
  const client = serverPublicClient();
  const { data, error } = await client
    .from("community_ideas")
    .select("*")
    .eq("is_published", true)
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return [];
  return mapIdeas(client, data ?? []);
});

/** Compact list used by the AI chat as grounding context. */
export const listCommunityIdeasForChat = createServerFn({ method: "GET" }).handler(async () => {
  const client = serverPublicClient();
  const { data, error } = await client
    .from("community_ideas")
    .select("id,title,description,category,tags,hook,cta")
    .eq("is_published", true)
    .order("votes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) return [];
  return data ?? [];
});

const CreateInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  category: z.string().trim().min(1).max(60).default("general"),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  hook: z.string().trim().max(400).nullable().optional(),
  cta: z.string().trim().max(400).nullable().optional(),
  thumbnail_url: z.string().trim().max(500).nullable().optional(),
  pdf_url: z.string().trim().max(500).nullable().optional(),
  youtube_video_url: z.string().trim().max(500).nullable().optional(),
  is_published: z.boolean().default(true),
});

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Admins only");
}

export const createCommunityIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CreateInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("community_ideas")
      .insert({ ...data, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

const UpdateInput = CreateInput.partial().extend({ id: z.string().uuid() });

export const updateCommunityIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => UpdateInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("community_ideas").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCommunityIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("community_ideas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleCommunityVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ ideaId: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("community_idea_votes")
      .select("idea_id")
      .eq("idea_id", data.ideaId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      await context.supabase
        .from("community_idea_votes")
        .delete()
        .eq("idea_id", data.ideaId)
        .eq("user_id", context.userId);
      return { voted: false };
    }
    const { error } = await context.supabase
      .from("community_idea_votes")
      .insert({ idea_id: data.ideaId, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { voted: true };
  });

export const getMyVotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("community_idea_votes")
      .select("idea_id")
      .eq("user_id", context.userId);
    return (data ?? []).map((r: any) => r.idea_id as string);
  });

export const isAdminCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: Boolean(data) };
  });

/** Admin-only listing that includes drafts (unpublished). */
export const listCommunityIdeasAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CommunityIdea[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("community_ideas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const client = serverPublicClient();
    return mapIdeas(client, data ?? []);
  });

/** Reset the vote count for an idea back to zero (also clears vote rows). */
export const resetCommunityVotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Delete vote rows first — the sync_community_votes trigger updates the counter.
    const { error: delErr } = await context.supabase
      .from("community_idea_votes")
      .delete()
      .eq("idea_id", data.id);
    if (delErr) throw new Error(delErr.message);
    // Safety net: force counter to 0 in case any drift exists.
    const { error: updErr } = await context.supabase
      .from("community_ideas")
      .update({ votes: 0 })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });