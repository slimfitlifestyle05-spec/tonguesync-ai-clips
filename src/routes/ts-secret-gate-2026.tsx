import { createFileRoute, notFound, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAdminOverview, getAdminSettings, saveAdminSettings } from "@/lib/admin.functions";
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
import { Users, DollarSign, Video, Activity, Loader2 } from "lucide-react";

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
  const qc = useQueryClient();
  const { data: overview } = useQuery({ queryKey: ["admin-overview"], queryFn: () => getOverview(), refetchInterval: 15000 });
  const { data: settings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => getSettings() });

  const [ga, setGa] = useState("");
  const [openai, setOpenai] = useState("");
  const [gemini, setGemini] = useState("");
  const [elevenlabs, setElevenlabs] = useState("");
  const [twoFactor, setTwoFactor] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setGa(settings.ga);
      setOpenai(settings.apiKeys?.openai ?? "");
      setGemini(settings.apiKeys?.gemini ?? "");
      setElevenlabs(settings.apiKeys?.elevenlabs ?? "");
      setTwoFactor(!!settings.twoFactor);
    }
  }, [settings]);

  async function saveAll() {
    setSaving(true);
    try {
      await save({ data: { ga, apiKeys: { openai, gemini, elevenlabs }, twoFactor } });
      toast.success("Settings saved");
      qc.invalidateQueries();
    } catch (e: any) { toast.error(e?.message ?? "Save failed"); }
    finally { setSaving(false); }
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
              <p className="text-xs text-slate-400">Keys are encrypted-at-rest in the backend and used server-side only. Never rendered to end users.</p>
              <div><Label>OpenAI API Key</Label><Input type="password" value={openai} onChange={(e) => setOpenai(e.target.value)} placeholder="sk-\u2026" className="bg-white/5 border-white/10 mt-1" /></div>
              <div><Label>Google Gemini API Key</Label><Input type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder="AIza\u2026" className="bg-white/5 border-white/10 mt-1" /></div>
              <div><Label>ElevenLabs API Key</Label><Input type="password" value={elevenlabs} onChange={(e) => setElevenlabs(e.target.value)} placeholder="\u2026" className="bg-white/5 border-white/10 mt-1" /></div>
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
