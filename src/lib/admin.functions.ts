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
    const supabaseAdmin = context.supabase;
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
    const supabaseAdmin = context.supabase;
    const { data } = await supabaseAdmin.from("app_settings").select("key, value");
    const map: Record<string, any> = {};
    (data ?? []).forEach((r) => (map[r.key] = r.value));
    return {
      ga: (typeof map.ga_measurement_id === "string" ? map.ga_measurement_id : "") || "",
      apiKeys: {
        openai: map.api_keys?.openai ?? "",
        gemini: map.api_keys?.gemini ?? "",
        elevenlabs: map.api_keys?.elevenlabs ?? "",
        cartesia: map.api_keys?.cartesia ?? "",
      },
      ttsProvider: (typeof map.tts_provider === "string" ? map.tts_provider : "cartesia") as
        | "cartesia"
        | "elevenlabs",
      cartesiaModel: (typeof map.cartesia_model === "string" ? map.cartesia_model : "sonic-2") as
        | "sonic-2"
        | "sonic-turbo"
        | "sonic",
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
          cartesia: z.string().max(300).optional().default(""),
        })
        .optional(),
      ttsProvider: z.enum(["cartesia", "elevenlabs"]).optional(),
      cartesiaModel: z.enum(["sonic-2", "sonic-turbo", "sonic"]).optional(),
      twoFactor: z.boolean().optional(),
    }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    const updates: { key: string; value: any; updated_by: string }[] = [];
    if (data.ga !== undefined)
      updates.push({ key: "ga_measurement_id", value: data.ga, updated_by: context.userId });
    if (data.apiKeys)
      updates.push({ key: "api_keys", value: data.apiKeys, updated_by: context.userId });
    if (data.ttsProvider !== undefined)
      updates.push({ key: "tts_provider", value: data.ttsProvider, updated_by: context.userId });
    if (data.cartesiaModel !== undefined)
      updates.push({ key: "cartesia_model", value: data.cartesiaModel, updated_by: context.userId });
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

export const getPromoVideo = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.from("app_settings").select("value").eq("key", "promo_video").maybeSingle();
  const v = data?.value as { url?: string; title?: string } | null;
  return { url: v?.url ?? "", title: v?.title ?? "" };
});

/** Public: fetch the site's YouTube channel link (shown on Viral Ideas). */
export const getYoutubeChannel = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.from("app_settings").select("value").eq("key", "youtube_channel").maybeSingle();
  const v = data?.value as { url?: string; handle?: string } | null;
  return { url: v?.url ?? "", handle: v?.handle ?? "" };
});

/** Admin: set the site's YouTube channel link. */
export const setYoutubeChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      url: z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\//i.test(v), "Must be a URL").or(z.literal("")),
      handle: z.string().trim().max(120).optional().default(""),
    }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    await supabaseAdmin.from("app_settings").upsert(
      { key: "youtube_channel", value: { url: data.url, handle: data.handle }, updated_by: context.userId, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    return { ok: true };
  });

export const setPromoVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ url: z.string().url().max(500).or(z.literal("")), title: z.string().max(120).optional().default("") }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    await supabaseAdmin.from("app_settings").upsert(
      { key: "promo_video", value: { url: data.url, title: data.title }, updated_by: context.userId, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    return { ok: true };
  });

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name, tier, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: { user_id: string; role: string }) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ email: z.string().email().max(255), tier: z.enum(["free", "pro"]).default("free") }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (error) throw new Error(error.message);
    const userId = created?.user?.id;
    if (userId && data.tier === "pro") {
      await supabaseAdmin.from("profiles").update({ tier: "pro" }).eq("id", userId);
    }
    return { ok: true, userId };
  });

export const setUserTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ userId: z.string().uuid(), tier: z.enum(["free", "pro"]) }).parse(raw)
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    const { error } = await supabaseAdmin.from("profiles").update({ tier: data.tier }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ userId: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    const supabaseAdmin = context.supabase;
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────────────────── Payment providers ──────────────────────────
// The catalog of visitor-facing payment methods. Admin can toggle any of
// them on; the actual API keys / merchant accounts get wired up later via
// Lovable Cloud secrets. No live processing runs from these settings — the
// UI just shows/hides the buttons at checkout.

export const PAYMENT_PROVIDERS = [
  { id: "stripe", label: "Stripe", note: "International cards" },
  { id: "paypal", label: "PayPal", note: "Global wallet" },
  { id: "fawry", label: "Fawry", note: "Egypt cash & cards" },
  { id: "vodafone_cash", label: "Vodafone Cash", note: "Egypt mobile wallet" },
  { id: "instapay", label: "InstaPay", note: "Egypt instant transfer" },
] as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number]["id"];

type PaymentProviderState = {
  id: PaymentProviderId;
  enabled: boolean;
  connected: boolean;
  account?: string;
};

function normalizeProviders(raw: unknown): PaymentProviderState[] {
  const arr = Array.isArray(raw) ? (raw as any[]) : [];
  return PAYMENT_PROVIDERS.map((p) => {
    const found = arr.find((x) => x?.id === p.id);
    return {
      id: p.id,
      enabled: !!found?.enabled,
      connected: !!found?.connected,
      account: typeof found?.account === "string" ? found.account : "",
    };
  });
}

export const getPaymentProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "payment_providers")
      .maybeSingle();
    return {
      catalog: PAYMENT_PROVIDERS,
      providers: normalizeProviders(data?.value),
    };
  });

export const savePaymentProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        providers: z
          .array(
            z.object({
              id: z.enum(["stripe", "paypal", "fawry", "vodafone_cash", "instapay"]),
              enabled: z.boolean(),
              connected: z.boolean().optional().default(false),
              account: z.string().max(120).optional().default(""),
            }),
          )
          .max(20),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const supabaseAdmin = context.supabase;
    await supabaseAdmin.from("app_settings").upsert(
      {
        key: "payment_providers",
        value: data.providers,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    return { ok: true };
  });

// Public — used by the checkout / upgrade modal to render provider buttons.
// Reads only the enabled flag; no secrets ever leave the server.
export const getEnabledPaymentProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", "payment_providers")
    .maybeSingle();
  const providers = normalizeProviders(data?.value)
    .filter((p) => p.enabled)
    .map((p) => ({
      id: p.id,
      label: PAYMENT_PROVIDERS.find((x) => x.id === p.id)!.label,
      note: PAYMENT_PROVIDERS.find((x) => x.id === p.id)!.note,
      connected: p.connected,
    }));
  return { providers };
});
