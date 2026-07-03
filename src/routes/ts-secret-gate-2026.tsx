import { createFileRoute, notFound, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminOverview,
  getAdminSettings,
  saveAdminSettings,
  getPromoVideo,
  setPromoVideo,
  listAppUsers,
  inviteUser,
  setUserTier,
  deleteAppUser,
  getPaymentProviders,
  savePaymentProviders,
  PAYMENT_PROVIDERS,
} from "@/lib/admin.functions";
import { getMyProfile } from "@/lib/video.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";
import { Users, DollarSign, Video, Activity, Loader2, Trash2, UserPlus, Crown, CreditCard, Link2, Check } from "lucide-react";
import { listAllPostsAdmin, generatePostAdmin, deletePostAdmin, togglePublishedAdmin } from "@/lib/blog.functions";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ts-secret-gate-2026")({
  ssr: false,
  head: () => ({ meta: [{ title: "\u00b7", content: "noindex" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminGate,
});

function AdminGate() {
  const navigate = useNavigate();
  const getProfile = useServerFn(getMyProfile);
  const [status, setStatus] = useState<"loading" | "ok" | "deny">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate({ to: "/auth" }); return; }
      try {
        const p = await getProfile();
        if (!p.isAdmin) setStatus("deny"); else setStatus("ok");
      } catch { setStatus("deny"); }
    })();
  }, [navigate, getProfile]);

  if (status === "loading")
    return <div className="min-h-screen grid place-items-center bg-slate-950 text-white"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (status === "deny") {
    // Look like a 404 to avoid revealing the URL exists
    throw notFound();
  }
  return <AdminDashboard />;
}

const COLORS = ["#a855f7", "#f59e0b", "#ec4899", "#10b981", "#3b82f6", "#ef4444"];

function AdminDashboard() {
  const getOverview = useServerFn(getAdminOverview);
  const getSettings = useServerFn(getAdminSettings);
  const save = useServerFn(saveAdminSettings);
  const getPromo = useServerFn(getPromoVideo);
  const savePromo = useServerFn(setPromoVideo);
  const listUsers = useServerFn(listAppUsers);
  const invite = useServerFn(inviteUser);
  const setTier = useServerFn(setUserTier);
  const delUser = useServerFn(deleteAppUser);
  const getProviders = useServerFn(getPaymentProviders);
  const saveProviders = useServerFn(savePaymentProviders);
  const qc = useQueryClient();
  const { data: overview } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => getOverview(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const { data: settings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => getSettings() });
  const { data: promo } = useQuery({ queryKey: ["admin-promo"], queryFn: () => getPromo() });
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });
  const { data: paymentData } = useQuery({ queryKey: ["admin-payments"], queryFn: () => getProviders() });

  const [providers, setProviders] = useState<Array<{ id: string; enabled: boolean; connected: boolean; account?: string }>>([]);
  useEffect(() => {
    if (paymentData?.providers) setProviders(paymentData.providers);
  }, [paymentData]);

  async function toggleProvider(id: string, enabled: boolean) {
    const next = providers.map((p) => (p.id === id ? { ...p, enabled } : p));
    setProviders(next);
    try {
      await saveProviders({ data: { providers: next as any } });
      toast.success(enabled ? "Provider shown at checkout" : "Provider hidden from checkout");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["public-payments"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    }
  }

  function connectProvider(id: string, label: string) {
    toast(`${label}: connection UI coming next`, {
      description: "Toggle it on and the button appears at checkout — wire real keys later.",
      icon: <Link2 className="h-4 w-4 text-fuchsia-400" />,
    });
  }

  const [ga, setGa] = useState("");
  const [openai, setOpenai] = useState("");
  const [gemini, setGemini] = useState("");
  const [elevenlabs, setElevenlabs] = useState("");
  const [cartesia, setCartesia] = useState("");
  const [ttsProvider, setTtsProvider] = useState<"cartesia" | "elevenlabs">("cartesia");
  const [cartesiaModel, setCartesiaModel] = useState<"sonic-2" | "sonic-turbo" | "sonic">("sonic-2");
  const [twoFactor, setTwoFactor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoUrl, setPromoUrl] = useState("");
  const [promoTitle, setPromoTitle] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTier, setInviteTier] = useState<"free" | "pro">("free");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      setGa(settings.ga);
      setOpenai(settings.apiKeys?.openai ?? "");
      setGemini(settings.apiKeys?.gemini ?? "");
      setElevenlabs(settings.apiKeys?.elevenlabs ?? "");
      setCartesia((settings.apiKeys as any)?.cartesia ?? "");
      setTtsProvider((settings as any).ttsProvider ?? "cartesia");
      setCartesiaModel(((settings as any).cartesiaModel as any) ?? "sonic-2");
      setTwoFactor(!!settings.twoFactor);
    }
  }, [settings]);

  useEffect(() => {
    if (promo) {
      setPromoUrl(promo.url ?? "");
      setPromoTitle(promo.title ?? "");
    }
  }, [promo]);

  async function saveAll() {
    setSaving(true);
    try {
      await save({
        data: {
          ga,
          apiKeys: { openai, gemini, elevenlabs, cartesia },
          ttsProvider,
          cartesiaModel,
          twoFactor,
        },
      });
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  async function savePromoVideo() {
    setBusy(true);
    try {
      await savePromo({ data: { url: promoUrl, title: promoTitle } });
      toast.success("Promo video saved");
      qc.invalidateQueries({ queryKey: ["admin-promo"] });
      qc.invalidateQueries({ queryKey: ["promo-video"] });
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setBusy(false); }
  }

  async function handleInvite() {
    if (!inviteEmail) return;
    setBusy(true);
    try {
      await invite({ data: { email: inviteEmail, tier: inviteTier } });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e?.message ?? "Invite failed"); }
    finally { setBusy(false); }
  }

  async function handleSetTier(userId: string, tier: "free" | "pro") {
    try {
      await setTier({ data: { userId, tier } });
      toast.success(`User set to ${tier}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e?.message ?? "Update failed"); }
  }

  async function handleDelete(userId: string, email: string | null) {
    if (!confirm(`Delete user ${email ?? userId}? This cannot be undone.`)) return;
    try {
      await delUser({ data: { userId } });
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e?.message ?? "Delete failed"); }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-3"><Link to="/"><Logo /></Link><span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">ADMIN</span></div>
        <div className="flex items-center gap-2"><LangToggle /><Link to="/dashboard"><Button variant="ghost" size="sm">User dashboard</Button></Link></div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Stat icon={<Users />} label="Total users" value={overview?.totalUsers ?? "\u2014"} />
          <Stat icon={<DollarSign />} label="MRR (Pro x $10)" value={overview ? `$${overview.mrr}` : "\u2014"} />
          <Stat icon={<Video />} label="Videos generated" value={overview?.totalVideos ?? "\u2014"} />
          <Stat icon={<Activity />} label="Active (5m)" value={overview?.activeNow ?? 0} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Views & videos (14d)</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={overview?.days ?? []}>
                  <CartesianGrid stroke="#ffffff10" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                  <Line type="monotone" dataKey="views" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="videos" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Traffic sources</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={overview?.sources?.length ? overview.sources : [{ name: "direct", value: 1 }]} dataKey="value" nameKey="name" outerRadius={80} isAnimationActive={false}>
                    {(overview?.sources ?? [{ name: "direct", value: 1 }]).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList>
            <TabsTrigger value="analytics">Google Analytics</TabsTrigger>
            <TabsTrigger value="api">API Keys</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="promo">Promo Video</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="blog">Blog</TabsTrigger>
          </TabsList>
          <TabsContent value="analytics">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div>
                <Label>Google Analytics Measurement ID</Label>
                <Input value={ga} onChange={(e) => setGa(e.target.value)} placeholder="G-XXXXXXXXXX" className="bg-white/5 border-white/10 mt-1" />
                <p className="text-xs text-slate-400 mt-1">Injected into every public page as gtag.js. Page views tracked automatically on navigation.</p>
              </div>
              <Button onClick={saveAll} disabled={saving}>Save changes</Button>
            </div>
          </TabsContent>
          <TabsContent value="api">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div>
                <h3 className="font-semibold">API Integrations</h3>
                <p className="text-xs text-slate-400 mt-1">Keys are stored server-side and used only by the dubbing pipeline. Never rendered to end users.</p>
              </div>
              <div>
                <Label>Text-to-Speech provider</Label>
                <select
                  value={ttsProvider}
                  onChange={(e) => setTtsProvider(e.target.value as "cartesia" | "elevenlabs")}
                  className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
                >
                  <option value="cartesia">Cartesia (Sonic model) \u2014 recommended</option>
                  <option value="elevenlabs">ElevenLabs (multilingual)</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Cartesia routes dubbing through the flagship <span className="text-fuchsia-300">Sonic</span> model for ultra-low latency voice generation.
                </p>
              </div>
              {ttsProvider === "cartesia" ? (
                <div>
                  <Label>Cartesia model</Label>
                  <select
                    value={cartesiaModel}
                    onChange={(e) => setCartesiaModel(e.target.value as "sonic-2" | "sonic-turbo" | "sonic")}
                    className="mt-1 w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
                  >
                    <option value="sonic-2">Sonic 2 \u2014 flagship quality (recommended)</option>
                    <option value="sonic-turbo">Sonic Turbo \u2014 ~40ms latency, fastest</option>
                    <option value="sonic">Sonic (legacy)</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Sonic 2 is Cartesia's newest premium model. Switch to Sonic Turbo when raw speed matters more than fidelity.</p>
                </div>
              ) : null}
              <div>
                <Label>Cartesia API Key</Label>
                <Input type="password" value={cartesia} onChange={(e) => setCartesia(e.target.value)} placeholder="sk_car_\u2026" className="bg-white/5 border-white/10 mt-1" />
              </div>
              <div><Label>OpenAI API Key</Label><Input type="password" value={openai} onChange={(e) => setOpenai(e.target.value)} placeholder="sk-\u2026" className="bg-white/5 border-white/10 mt-1" /></div>
              <div><Label>Google Gemini API Key</Label><Input type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="AIza\u2026" className="bg-white/5 border-white/10 mt-1" /></div>
              <div><Label>ElevenLabs API Key (fallback)</Label><Input type="password" value={elevenlabs} onChange={(e) => setElevenlabs(e.target.value)} placeholder="\u2026" className="bg-white/5 border-white/10 mt-1" /></div>
              <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400 space-y-1">
                <div><span className="text-slate-300 font-medium">Pipeline:</span> Gemini/OpenAI translates the transcript into the target dialect, then streams straight into Cartesia Sonic for instant dubbing.</div>
                <div>Missing keys or quota errors are logged to the server console and surfaced in the dubbing UI.</div>
              </div>
              <Button onClick={saveAll} disabled={saving}>Save changes</Button>
            </div>
          </TabsContent>
          <TabsContent value="security">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Two-Factor Authentication (Admin)</div>
                  <div className="text-xs text-slate-400">Require a TOTP code for admin sign-in.</div>
                </div>
                <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
              </label>
              <Button onClick={saveAll} disabled={saving}>Save changes</Button>
            </div>
          </TabsContent>
          <TabsContent value="payments">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment providers</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Toggle a provider on to make its button appear at checkout. The provider stays fully <span className="text-amber-300">inactive</span> until you connect real credentials — click <span className="text-fuchsia-300">Connect</span> next to it when you're ready to wire it up.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {providers.map((p) => {
                  const meta = PAYMENT_PROVIDERS.find((x) => x.id === p.id)!;
                  return (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-black/30 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{meta.label}</span>
                          {p.connected ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 font-semibold">
                              <Check className="h-2.5 w-2.5" /> CONNECTED
                            </span>
                          ) : (
                            <span className="rounded bg-white/10 text-slate-400 text-[10px] px-1.5 py-0.5 font-semibold">NOT CONNECTED</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{meta.note}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => connectProvider(p.id, meta.label)}
                          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs"
                        >
                          <Link2 className="h-3 w-3" /> {p.connected ? "Reconnect" : "Connect"}
                        </button>
                        <Switch checked={p.enabled} onCheckedChange={(v) => toggleProvider(p.id, v)} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-500 pt-2 border-t border-white/5">
                A toggled-on provider without connected credentials shows on checkout but won't complete a real charge — perfect for capturing interest and wiring the integration afterwards.
              </div>
            </div>
          </TabsContent>
          <TabsContent value="promo">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div>
                <Label>Promo video URL (MP4 or embed)</Label>
                <Input value={promoUrl} onChange={(e) => setPromoUrl(e.target.value)} placeholder="https://.../promo.mp4" className="bg-white/5 border-white/10 mt-1" />
                <p className="text-xs text-slate-400 mt-1">Shown on the landing page as an intro explaining what TongueSync AI does. Leave empty to hide.</p>
              </div>
              <div>
                <Label>Caption (optional)</Label>
                <Input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} placeholder="Watch how it works in 60 seconds" className="bg-white/5 border-white/10 mt-1" />
              </div>
              {promoUrl ? (
                <div className="rounded-xl overflow-hidden border border-white/10 aspect-video bg-black">
                  <video src={promoUrl} controls className="w-full h-full" />
                </div>
              ) : null}
              <Button onClick={savePromoVideo} disabled={busy}>Save promo video</Button>
            </div>
          </TabsContent>
          <TabsContent value="users">
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><UserPlus className="h-4 w-4" /> Invite a user</h3>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="flex-1 min-w-[240px]">
                    <Label>Email</Label>
                    <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="user@example.com" className="bg-white/5 border-white/10 mt-1" />
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <select value={inviteTier} onChange={(e) => setInviteTier(e.target.value as "free" | "pro")} className="mt-1 rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm">
                      <option value="free">Free</option>
                      <option value="pro">Pro (paid)</option>
                    </select>
                  </div>
                  <Button onClick={handleInvite} disabled={busy || !inviteEmail}>Send invite</Button>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 text-slate-400 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">Tier</th>
                      <th className="text-left px-4 py-3">Role</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users ?? []).map((u) => (
                      <tr key={u.id} className="border-t border-white/5">
                        <td className="px-4 py-3">{u.email ?? <span className="text-slate-500">—</span>}<div className="text-xs text-slate-500">{u.full_name}</div></td>
                        <td className="px-4 py-3">
                          <span className={"inline-flex items-center gap-1 px-2 py-1 rounded text-xs " + (u.tier === "pro" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-slate-300")}>
                            {u.tier === "pro" ? <Crown className="h-3 w-3" /> : null}{u.tier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{u.roles.join(", ") || "user"}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            {u.tier === "pro" ? (
                              <Button size="sm" variant="ghost" onClick={() => handleSetTier(u.id, "free")}>Downgrade</Button>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => handleSetTier(u.id, "pro")}>Upgrade to Pro</Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(u.id, u.email)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(users ?? []).length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No users yet.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="blog">
            <BlogAdminPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between text-slate-400 text-xs"><span>{label}</span><span className="opacity-70">{icon}</span></div>
      <div className="text-3xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function BlogAdminPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAllPostsAdmin);
  const genFn = useServerFn(generatePostAdmin);
  const delFn = useServerFn(deletePostAdmin);
  const toggleFn = useServerFn(togglePublishedAdmin);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState(false);

  const { data: posts, isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: () => listFn(),
    staleTime: 30_000,
  });

  async function generate() {
    if (!topic.trim() || busy) return;
    setBusy(true);
    try {
      const res = await genFn({ data: { topic: topic.trim(), audience: audience.trim() || undefined, publish } });
      toast.success(`Generated: ${res.title}`);
      setTopic("");
      setAudience("");
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this article? This cannot be undone.")) return;
    try {
      await delFn({ data: { id } });
      toast.success("Article deleted");
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function toggle(id: string, published: boolean) {
    try {
      await toggleFn({ data: { id, published: !published } });
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      qc.invalidateQueries({ queryKey: ["blog"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-amber-500/10 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-fuchsia-300" />
          <h3 className="text-lg font-semibold">Generate a new article with AI</h3>
        </div>
        <p className="text-sm text-slate-400">
          Give a topic. The AI writes a full 700-1100 word article in a human editorial voice, then saves it here.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Topic *</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Why creators should stop over-editing their vertical shorts"
              className="mt-1 bg-white/5 border-white/10 min-h-[60px]"
            />
          </div>
          <div>
            <Label>Audience (optional)</Label>
            <Input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Solo TikTok creators aged 22-35"
              className="mt-1 bg-white/5 border-white/10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={publish} onCheckedChange={setPublish} id="publish-now" />
            <Label htmlFor="publish-now" className="cursor-pointer">Publish immediately</Label>
          </div>
          <Button onClick={generate} disabled={busy || !topic.trim()} className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Writing…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate article</>}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> All articles ({posts?.length ?? 0})</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : !posts || posts.length === 0 ? (
          <p className="text-sm text-slate-400">No articles yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-white/10">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Published</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p: any) => (
                  <tr key={p.id} className="border-b border-white/5">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-white">{p.title}</div>
                      <div className="text-xs text-slate-500">/{p.slug}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={p.published ? "text-emerald-300" : "text-slate-500"}>
                        {p.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-400">{new Date(p.published_at).toLocaleDateString()}</td>
                    <td className="py-3 flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => toggle(p.id, p.published)}>
                        {p.published ? "Unpublish" : "Publish"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)} className="text-rose-400 hover:text-rose-300">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
