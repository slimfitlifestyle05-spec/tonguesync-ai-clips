import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { useI18n } from "@/lib/i18n";
import { Check, Sparkles, ShieldCheck, Wand2, Languages, Rocket, Play, Volume2, Zap, Brain, Mic } from "lucide-react";
import { FeatureCard, ClipperVisual, DubbingVisual } from "@/components/FeatureShowcase";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrustBar } from "@/components/TrustBar";
import { Reveal } from "@/components/Reveal";
import { SocialProofToast } from "@/components/SocialProofToast";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getPromoVideo } from "@/lib/admin.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useI18n();
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => setIsDark(document.documentElement.classList.contains("dark") || !document.documentElement.classList.contains("light"));
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return (
    <div className={
      "min-h-screen transition-colors duration-500 " +
      (isDark
        ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white"
        : "bg-gradient-to-b from-white via-slate-50 to-white text-slate-900")
    }>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
          <Link to="/auth"><Button variant="ghost" className="text-white hover:bg-white/10">{t("sign_in")}</Button></Link>
          <Link to="/auth"><Button className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">{t("get_started")}</Button></Link>
        </nav>
      </header>

      <Reveal as="section" className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles className="h-3 w-3 text-amber-300" /> {t("hero_badge")}
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 via-white to-amber-200 bg-clip-text text-transparent">
          {t("tagline")}
        </h1>
        <p className={"mt-6 text-lg max-w-2xl mx-auto " + (isDark ? "text-slate-300" : "text-slate-600")}>{t("hero_sub")}</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/auth"><Button size="lg" className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold">{t("get_started")}</Button></Link>
        </div>
      </Reveal>

      <Reveal delay={80}><TrustBar isDark={isDark} /></Reveal>

      <PromoVideoSection />

      <section className="mx-auto max-w-6xl px-6 pb-16 grid gap-6 md:grid-cols-2">
        <Reveal delay={0}>
          <FeatureCard
            to="/clipper"
            title={t("feat_clipper_title")}
            desc={t("feat_clipper_desc")}
            visual={<ClipperVisual />}
          />
        </Reveal>
        <Reveal delay={120}>
          <FeatureCard
            to="/dubbing"
            title={t("feat_dubbing_title")}
            desc={t("feat_dubbing_desc")}
            visual={<DubbingVisual />}
          />
        </Reveal>
      </section>

      <Reveal as="section" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-white/[0.03] to-amber-400/10 p-8 md:p-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <Sparkles className="h-3 w-3 text-amber-300" /> {t("how_badge")}
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              {t("how_h2_a")}{" "}
              <span className="bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                {t("how_h2_b")}
              </span>
            </h2>
            <p className="mt-4 text-slate-300 leading-relaxed">{t("how_p")}</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <StepCard n="01" icon={<Wand2 className="h-4 w-4" />} title={t("step_1_title")} text={t("step_1_text")} />
            <StepCard n="02" icon={<Languages className="h-4 w-4" />} title={t("step_2_title")} text={t("step_2_text")} />
            <StepCard n="03" icon={<Rocket className="h-4 w-4" />} title={t("step_3_title")} text={t("step_3_text")} />
          </div>
        </div>
      </Reveal>

      <Reveal><BeforeAfterSection /></Reveal>

      <Reveal><BentoGrid /></Reveal>

      <Reveal as="section" className="mx-auto max-w-5xl px-6 pb-24">
        <div id="pricing" />
        <h2 className="text-3xl font-bold text-center mb-10">{t("pricing")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <PriceCard tier={t("free_tier")} price="$0" perks={[t("perk_free_1"), t("perk_free_2"), t("perk_free_3"), t("perk_free_4")]} />
          <PriceCard
            highlight
            tier={t("pro_tier")}
            price={"$10" + t("per_month")}
            originalPrice={"$20" + t("per_month")}
            launchBadge={t("launch_badge")}
            launchNote={t("launch_note")}
            launchPill={t("launch_pill")}
            perks={[t("perk_pro_1"), t("perk_pro_2"), t("perk_pro_3"), t("perk_pro_4")]}
          />
        </div>
        <div className="mt-12 flex justify-center">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 text-black font-semibold px-10 py-6 text-base shadow-[0_10px_40px_-10px_rgba(217,70,239,0.6)] hover:opacity-90 hover:shadow-[0_15px_50px_-10px_rgba(217,70,239,0.8)] transition-all">
              {t("pricing_cta")}
            </Button>
          </Link>
        </div>
      </Reveal>

      <Reveal><FAQSection /></Reveal>

      <Footer />
      <SocialProofToast />
    </div>
  );
}

function BeforeAfterSection() {
  const { t } = useI18n();
  const [isLocalized, setIsLocalized] = useState(false);
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          {t("ba_h2_a")}{" "}
          <span className="bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
            {t("ba_h2_b")}
          </span>
        </h2>
        <p className="mt-4 text-slate-400 max-w-xl mx-auto">{t("ba_sub")}</p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-6 md:p-8 shadow-2xl">
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-fuchsia-950/50 via-slate-900 to-amber-950/30 border border-white/5">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur border border-white/20 mb-4">
                <Play className="h-7 w-7 text-white ml-1" fill="currentColor" />
              </div>
              <div className="text-2xl font-semibold">
                {isLocalized ? t("ba_caption_ar") : t("ba_caption_en")}
              </div>
              <div className="mt-2 text-sm text-slate-400 flex items-center justify-center gap-2">
                <Volume2 className="h-4 w-4" />
                {isLocalized ? t("ba_lang_local") : t("ba_lang_orig")}
              </div>
            </div>
          </div>
          <div className="absolute bottom-4 left-4 right-4 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-2/5 bg-gradient-to-r from-fuchsia-400 to-amber-300" />
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/80 p-1 backdrop-blur">
            <button
              onClick={() => setIsLocalized(false)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${!isLocalized ? "bg-white text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              {t("toggle_original")}
            </button>
            <button
              onClick={() => setIsLocalized(true)}
              className={`px-5 py-2 text-sm font-medium rounded-full transition-all ${isLocalized ? "bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              {t("toggle_localized")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const { t } = useI18n();
  const faqs = [
    { q: t("faq_q1"), a: t("faq_a1") },
    { q: t("faq_q2"), a: t("faq_a2") },
    { q: t("faq_q3"), a: t("faq_a3") },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 pb-24">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-10">
        {t("faq_h2_a")}{" "}
        <span className="bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
          {t("faq_h2_b")}
        </span>
      </h2>
      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((f, i) => (
          <AccordionItem
            key={i}
            value={`item-${i}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 backdrop-blur data-[state=open]:bg-white/[0.06] data-[state=open]:border-fuchsia-400/30"
          >
            <AccordionTrigger className="text-left text-base font-medium hover:no-underline py-5">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-slate-400 leading-relaxed pb-5">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
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

function PriceCard({
  tier,
  price,
  perks,
  highlight,
  originalPrice,
  launchBadge,
  launchNote,
  launchPill,
}: {
  tier: string;
  price: string;
  perks: string[];
  highlight?: boolean;
  originalPrice?: string;
  launchBadge?: string;
  launchNote?: string;
  launchPill?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border p-8 ${highlight ? "border-amber-400/40 bg-gradient-to-br from-fuchsia-950/40 to-amber-950/20 shadow-[0_20px_60px_-20px_rgba(217,70,239,0.35)]" : "border-white/10 bg-white/5"}`}
    >
      {launchPill && (
        <div className="absolute -top-3 start-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black shadow-lg animate-pulse">
          <span>🔥</span>
          <span>{launchPill}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{tier}</h3>
        {highlight && <ShieldCheck className="h-5 w-5 text-amber-300" />}
      </div>
      <div className="mt-2 flex items-baseline gap-3 flex-wrap">
        <div className="text-4xl font-bold">{price}</div>
        {originalPrice && (
          <div className="text-lg font-medium text-slate-500 line-through">{originalPrice}</div>
        )}
      </div>
      {launchNote && (
        <p className="mt-2 text-xs font-medium text-amber-300/90">{launchNote}</p>
      )}
      {launchBadge && (
        <div className="mt-4 rounded-xl border border-fuchsia-400/30 bg-gradient-to-r from-fuchsia-500/15 via-pink-500/10 to-amber-400/15 p-3 text-xs leading-relaxed text-slate-100">
          {launchBadge}
        </div>
      )}
      <ul className="mt-6 space-y-3 text-sm">
        {perks.map((p) => (
          <li key={p} className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />{p}</li>
        ))}
      </ul>
    </div>
  );
}


function PromoVideoSection() {
  const getPromo = useServerFn(getPromoVideo);
  const { data } = useQuery({ queryKey: ["promo-video"], queryFn: () => getPromo() });
  if (!data?.url) return null;
  return (
    <Reveal>
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl shadow-fuchsia-500/10">
          <video src={data.url} controls className="w-full aspect-video" />
        </div>
        {data.title ? (
          <p className="text-center text-sm text-slate-400 mt-3">{data.title}</p>
        ) : null}
      </section>
    </Reveal>
  );
}

function BentoGrid() {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="grid gap-4 md:grid-cols-3">
        <BentoCard
          icon={<Brain className="h-5 w-5" />}
          title={t("bento_1_title")}
          desc={t("bento_1_desc")}
        />
        <BentoCard
          icon={<Mic className="h-5 w-5" />}
          title={t("bento_2_title")}
          desc={t("bento_2_desc")}
        />
        <BentoCard
          icon={<Zap className="h-5 w-5" />}
          title={t("bento_3_title")}
          desc={t("bento_3_desc")}
        />
      </div>
    </section>
  );
}

function BentoCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur hover:bg-white/[0.05] transition-colors">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-amber-400/20 border border-white/10 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-white/10 bg-slate-950/50">
      <div className="mx-auto max-w-6xl px-6 py-12 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <h4 className="font-semibold text-white mb-3">{t("footer_product")}</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link to="/clipper" className="hover:text-white transition-colors">{t("link_ai_clipper")}</Link></li>
            <li><Link to="/dubbing" className="hover:text-white transition-colors">{t("link_cultural_dubber")}</Link></li>
            <li><Link to="/" className="hover:text-white transition-colors">{t("link_pricing")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">{t("footer_legal")}</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link to="/privacy" className="hover:text-white transition-colors">{t("link_privacy")}</Link></li>
            <li><Link to="/terms" className="hover:text-white transition-colors">{t("link_terms")}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-white mb-3">{t("footer_company")}</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link to="/about" className="hover:text-white transition-colors">{t("link_about")}</Link></li>
            <li><Link to="/contact" className="hover:text-white transition-colors">{t("link_contact")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-sm text-slate-500">
        {t("footer_copy")}
      </div>
    </footer>
  );
}