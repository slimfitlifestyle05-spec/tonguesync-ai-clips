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
import { Users, DollarSign, Video, Activity, Loader2, Trash2, UserPlus, Crown } from "lucide-react";

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
  const qc = useQueryClient();
  const { data: overview } = useQuery({ queryKey: ["admin-overview"], queryFn: () => getOverview(), refetchInterval: 15000 });
  const { data: settings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => getSettings() });
  const { data: promo } = useQuery({ queryKey: ["admin-promo"], queryFn: () => getPromo() });
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => listUsers() });

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
      qc.invalidateQueries();
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
                  <Line type="monotone" dataKey="views" stroke="#a855f7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="videos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="font-semibold mb-4">Traffic sources</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={overview?.sources?.length ? overview.sources : [{ name: "direct", value: 1 }]} dataKey="value" nameKey="name" outerRadius={80}>
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
            <TabsTrigger value="promo">Promo Video</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
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
