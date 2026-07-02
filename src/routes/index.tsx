import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { useI18n } from "@/lib/i18n";
import { Check, Scissors, Globe2, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <LangToggle />
          <Link to="/auth"><Button variant="ghost" className="text-white hover:bg-white/10">{t("sign_in")}</Button></Link>
          <Link to="/auth"><Button className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">{t("get_started")}</Button></Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles className="h-3 w-3 text-amber-300" /> AI shorts + cultural dubbing
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 via-white to-amber-200 bg-clip-text text-transparent">
          {t("tagline")}
        </h1>
        <p className="mt-6 text-lg text-slate-300 max-w-2xl mx-auto">{t("hero_sub")}</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/auth"><Button size="lg" className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">{t("get_started")}</Button></Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24 grid gap-6 md:grid-cols-2">
        <FeatureCard icon={<Scissors className="h-6 w-6" />} title={t("clipper")} desc={t("clipper_desc")} />
        <FeatureCard icon={<Globe2 className="h-6 w-6" />} title={t("dubbing")} desc={t("dubbing_desc")} />
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-10">{t("pricing")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <PriceCard tier={t("free_tier")} price="$0" perks={["3 clip generations", "1 dub (\u226430s)", "Watermark", "Basic caption styles"]} />
          <PriceCard highlight tier={t("pro_tier")} price={"$10" + t("per_month")} perks={["30 videos / month", "Dubs up to 60s", "No watermark", "All premium styles + Social Kit"]} />
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-slate-400">\u00a9 TongueSync AI</footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-amber-400/30">
        {icon}
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-slate-300 text-sm">{desc}</p>
    </div>
  );
}

function PriceCard({ tier, price, perks, highlight }: { tier: string; price: string; perks: string[]; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-8 ${highlight ? "border-amber-400/40 bg-gradient-to-br from-fuchsia-950/40 to-amber-950/20" : "border-white/10 bg-white/5"}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{tier}</h3>
        {highlight && <ShieldCheck className="h-5 w-5 text-amber-300" />}
      </div>
      <div className="mt-2 text-4xl font-bold">{price}</div>
      <ul className="mt-6 space-y-3 text-sm">
        {perks.map((p) => (
          <li key={p} className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />{p}</li>
        ))}
      </ul>
    </div>
  );
}