import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  author_name: string;
  reading_minutes: number;
  published_at: string;
};

export type BlogPost = BlogPostSummary & { content: string };

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Forbidden");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export const listPublishedPosts = createServerFn({ method: "GET" }).handler(async (): Promise<BlogPostSummary[]> => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_image_url, author_name, reading_minutes, published_at")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<BlogPost | null> => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("blog_posts")
      .select("id, slug, title, excerpt, content, cover_image_url, author_name, reading_minutes, published_at")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as BlogPost | null) ?? null;
  });

// ---------------- Admin ----------------

export const listAllPostsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, published, published_at, reading_minutes")
      .order("published_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deletePostAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const togglePublishedAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), published: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("blog_posts")
      .update({ published: data.published, published_at: data.published ? new Date().toISOString() : undefined })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generatePostAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      topic: z.string().min(3).max(200),
      audience: z.string().max(200).optional(),
      publish: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { lovableChat } = await import("@/lib/ai-gateway.server");

    const system = `You are a senior editorial writer for TongueSync AI — a product that turns videos into vertical shorts with animated captions and culturally-native AI dubbing.

You write English blog articles that sound unmistakably human: opinionated, specific, structured, with concrete examples and data. You avoid AI clichés ("in today's fast-paced world", "unleash the power of", "in conclusion"), avoid em-dash overuse, and never use emojis. You favor short paragraphs, active voice, and section headings that make skimmers stop scrolling.

Return ONLY a JSON object with these exact keys, no prose before or after:
{
  "title": "60 chars max, concrete and specific, no clickbait",
  "slug": "kebab-case-slug-under-70-chars",
  "excerpt": "One sentence, 140-180 chars, hooks the reader with a specific claim",
  "reading_minutes": 4,
  "content": "Full article in GitHub-flavored Markdown. Starts with an H1 that matches the title. 700-1100 words. Uses H2 sections, bold for emphasis, bullet lists where they help. Ends with a natural takeaway, not a summary paragraph."
}`;

    const user = `Write a blog article for TongueSync AI.

Topic: ${data.topic}
${data.audience ? `Audience: ${data.audience}` : "Audience: creators, marketers, and localization managers."}

Constraints:
- Ground claims in specifics. Reference real models, real platforms, real numbers when relevant.
- No promotional language. Mention TongueSync only if it fits naturally, at most once.
- Assume the reader is smart and busy.
- Output valid JSON only. No markdown fences, no commentary.`;

    const raw = await lovableChat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.85, maxTokens: 3500 },
    );

    // Strip potential code fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: {
      title: string;
      slug?: string;
      excerpt: string;
      reading_minutes?: number;
      content: string;
    };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("The AI returned malformed JSON. Please try again.");
    }

    const title = String(parsed.title || "").slice(0, 200);
    const excerpt = String(parsed.excerpt || "").slice(0, 400);
    const content = String(parsed.content || "").trim();
    if (!title || !excerpt || content.length < 300) {
      throw new Error("The generated article was incomplete. Please try again.");
    }

    let slug = slugify(parsed.slug || title);
    if (!slug) slug = `post-${Date.now()}`;

    // Ensure unique slug
    const { data: existing } = await context.supabase.from("blog_posts").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const reading = Math.max(2, Math.min(15, Number(parsed.reading_minutes) || Math.round(content.split(/\s+/).length / 220)));

    const { error } = await context.supabase.from("blog_posts").insert({
      slug,
      title,
      excerpt,
      content,
      reading_minutes: reading,
      published: data.publish,
      published_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);

    return { ok: true, slug, title };
  });