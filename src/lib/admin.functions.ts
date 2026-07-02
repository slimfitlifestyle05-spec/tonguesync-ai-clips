import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  if (!isAdmin) throw new Error("Forbidden");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count: totalUsers }, { count: proUsers }, { count: totalVideos }, { data: recentEvents }, { data: videosByDay }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }),
        supabaseAdmin.from("profiles").select("id", { head: true, count: "exact" }).eq("tier", "pro"),
        supabaseAdmin.from("videos").select("id", { head: true, count: "exact" }),
        supabaseAdmin
          .from("analytics_events")
          .select("event, path, source, created_at")
          .order("created_at", { ascending: false })
          .limit(500),
        supabaseAdmin.from("videos").select("created_at").gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
      ]);

    // bucket last 14 days
    const days: { date: string; views: number; videos: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, views: 0, videos: 0 });
    }
    (recentEvents ?? []).forEach((e) => {
      const key = e.created_at.slice(0, 10);
      const bucket = days.find((x) => x.date === key);
      if (bucket) bucket.views += 1;
    });
    (videosByDay ?? []).forEach((v) => {
      const key = v.created_at.slice(0, 10);
      const bucket = days.find((x) => x.date === key);
      if (bucket) bucket.videos += 1;
    });

    const sources: Record<string, number> = {};
    (recentEvents ?? []).forEach((e) => {
      const s = (e.source ?? "direct").toLowerCase();
      sources[s] = (sources[s] ?? 0) + 1;
    });

    const activeNow = (recentEvents ?? []).filter((e) => Date.now() - new Date(e.created_at).getTime() < 5 * 60_000).length;

    return {
      totalUsers: totalUsers ?? 0,
      proUsers: proUsers ?? 0,
      mrr: (proUsers ?? 0) * 10,
      totalVideos: totalVideos ?? 0,
      activeNow,
      days,
      sources: Object.entries(sources).map(([name, value]) => ({ name, value })),
    };
  });

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("key, value");
    const map: Record<string, any> = {};
    (data ?? []).forEach((r) => (map[r.key] = r.value));
    return {
      ga: (typeof map.ga_measurement_id === "string" ? map.ga_measurement_id : "") || "",
      apiKeys: map.api_keys ?? { openai: "", gemini: "", elevenlabs: "" },
      twoFactor: !!map.two_factor_enabled,
    };
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      ga: z.string().max(40).optional(),
      apiKeys: z
        .object({
          openai: z.string().max(300).optional().default(""),
          gemini: z.string().max(300).optional().default(""),
          elevenlabs: z.string().max(300).optional().default(""),
        })
        .optional(),
      twoFactor: z.boolean().optional(),
    }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const updates: { key: string; value: any; updated_by: string }[] = [];
    if (data.ga !== undefined)
      updates.push({ key: "ga_measurement_id", value: data.ga, updated_by: context.userId });
    if (data.apiKeys)
      updates.push({ key: "api_keys", value: data.apiKeys, updated_by: context.userId });
    if (data.twoFactor !== undefined)
      updates.push({ key: "two_factor_enabled", value: data.twoFactor, updated_by: context.userId });
    for (const u of updates) {
      await supabaseAdmin
        .from("app_settings")
        .upsert({ ...u, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }
    return { ok: true };
  });

export const getPublicGA = createServerFn({ method: "GET" }).handler(async () => {
  // Public GA id (uses publishable client + narrow RLS policy)
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.from("app_settings").select("value").eq("key", "ga_measurement_id").maybeSingle();
  return { ga: typeof data?.value === "string" ? data.value : "" };
});
