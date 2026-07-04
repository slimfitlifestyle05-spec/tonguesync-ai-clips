import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEY = "showcase_videos";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type ShowcaseVideos = {
  ar_path: string | null;
  en_path: string | null;
  ar_url: string | null;
  en_url: string | null;
  ar_caption: string | null;
  en_caption: string | null;
  poster_url: string | null;
};

async function sign(client: ReturnType<typeof publicClient>, path: string | null): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await client.storage.from("community").createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

export const getShowcaseVideos = createServerFn({ method: "GET" }).handler(async (): Promise<ShowcaseVideos> => {
  const client = publicClient();
  const { data } = await client.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? {}) as Record<string, any>;
  const ar_path = typeof v.ar_path === "string" ? v.ar_path : null;
  const en_path = typeof v.en_path === "string" ? v.en_path : null;
  return {
    ar_path,
    en_path,
    ar_url: await sign(client, ar_path),
    en_url: await sign(client, en_path),
    ar_caption: typeof v.ar_caption === "string" ? v.ar_caption : null,
    en_caption: typeof v.en_caption === "string" ? v.en_caption : null,
    poster_url: typeof v.poster_url === "string" ? v.poster_url : null,
  };
});

const Input = z.object({
  ar_path: z.string().trim().max(500).nullable().optional(),
  en_path: z.string().trim().max(500).nullable().optional(),
  ar_caption: z.string().trim().max(200).nullable().optional(),
  en_caption: z.string().trim().max(200).nullable().optional(),
  poster_url: z.string().trim().max(500).nullable().optional(),
});

export const updateShowcaseVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Admins only");
    const payload = {
      ar_path: data.ar_path ?? null,
      en_path: data.en_path ?? null,
      ar_caption: data.ar_caption ?? null,
      en_caption: data.en_caption ?? null,
      poster_url: data.poster_url ?? null,
    };
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: KEY, value: payload, updated_by: context.userId }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });