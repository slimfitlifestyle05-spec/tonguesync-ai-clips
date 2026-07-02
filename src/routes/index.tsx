import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { useI18n } from "@/lib/i18n";
import { Check, Sparkles, ShieldCheck, Wand2, Languages, Rocket } from "lucide-react";
import { FeatureCard, ClipperVisual, DubbingVisual } from "@/components/FeatureShowcase";

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

      <section className="mx-auto max-w-6xl px-6 pb-16 grid gap-6 md:grid-cols-2">
        <FeatureCard
          to="/clipper"
          title="AI Video Clipper"
          desc="Automatically split long videos into highly engaging vertical shorts with animated captions."
          visual={<ClipperVisual />}
        />
        <FeatureCard
          to="/dubbing"
          title="Cultural AI Dubbing"
          desc="Translate, rewrite, and re-voice your video into localized regional dialects and accents instantly."
          visual={<DubbingVisual />}
        />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-white/[0.03] to-amber-400/10 p-8 md:p-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <Sparkles className="h-3 w-3 text-amber-300" /> How it works
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              One video in.{" "}
              <span className="bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                A whole content engine out.
              </span>
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">
              Upload a single long video and TongueSync AI handles the rest — it finds the viral
              moments, cuts vertical shorts with animated captions, dubs them into the exact
              regional dialect your audience speaks, and even writes SEO-ready titles, descriptions,
              and hashtags. No editors, no translators, no guesswork.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <StepCard n="01" icon={<Wand2 className="h-4 w-4" />} title="Analyze" text="Our AI reads the transcript, detects the hook, and picks the highest-retention moments." />
            <StepCard n="02" icon={<Languages className="h-4 w-4" />} title="Localize" text="Translate and re-voice into 40+ regional accents — Khaleeji, Egyptian, Darija, LATAM Spanish, and more." />
            <StepCard n="03" icon={<Rocket className="h-4 w-4" />} title="Publish" text="Download platform-ready vertical shorts with captions and an auto-generated Social Kit." />
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="text-3xl font-bold text-center mb-10">{t("pricing")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <PriceCard tier={t("free_tier")} price="$0" perks={["3 clip generations", "1 dub (\u226430s)", "Watermark", "Basic caption styles"]} />
          <PriceCard highlight tier={t("pro_tier")} price={"$10" + t("per_month")} perks={["30 videos / month", "Dubs up to 60s", "No watermark", "All premium styles + Social Kit"]} />
        </div>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-slate-400">© {new Date().getFullYear()} TongueSync AI</footer>
    </div>
  );
}

function StepCard({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-slate-500 tracking-widest">{n}</span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
          {icon}
        </span>
      </div>
      <h4 className="text-base font-semibold">{title}</h4>
      <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{text}</p>
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