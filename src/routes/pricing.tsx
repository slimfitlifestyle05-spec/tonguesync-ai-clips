import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { upgradeToPro } from "@/lib/video.functions";
import { getEnabledPaymentProviders } from "@/lib/admin.functions";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { ArrowLeft, Check, Crown, CreditCard, Wallet, Smartphone, Zap, ShieldCheck, Sparkles } from "lucide-react";

const PROVIDER_ICON: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-4 w-4" />,
  paypal: <Wallet className="h-4 w-4" />,
  fawry: <Zap className="h-4 w-4" />,
  vodafone_cash: <Smartphone className="h-4 w-4" />,
  instapay: <Zap className="h-4 w-4" />,
};

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — TongueSync AI Coach, Clipper & Dubbing" },
      {
        name: "description",
        content:
          "Simple pricing for TongueSync — Free plan with 10 AI Coach credits/day, or Pro at $10/month for 50 credits/day, 30 videos, no watermark, and viral PDF playbooks.",
      },
      { property: "og:title", content: "TongueSync Pricing — Free vs Pro" },
      { property: "og:description", content: "Upgrade to Pro: 50 AI Coach credits/day, 30 videos/month, all premium styles, and no watermark." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { t, dir } = useI18n();
  const upgrade = useServerFn(upgradeToPro);
  const getProviders = useServerFn(getEnabledPaymentProviders);
  const qc = useQueryClient();
  const { data: payment } = useQuery({ queryKey: ["public-payments"], queryFn: () => getProviders() });
  const providers = payment?.providers ?? [];

  async function doUpgrade() {
    try {
      await upgrade();
      toast.success("You're on Pro. Enjoy! 🎉");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Please sign in to upgrade");
    }
  }

  return (
    <div dir={dir} className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <nav className="flex items-center gap-2">
          <LangToggle />
          <Link to="/"><Button variant="ghost" className="text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4 mr-1" /> {t("link_home") ?? "Home"}</Button></Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-6 pb-24">
        <div className="text-center mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-amber-300" /> {t("launch_pill") ?? "Launch offer"}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-fuchsia-300 via-white to-amber-200 bg-clip-text text-transparent">
            {t("pricing")}
          </h1>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto text-sm">
            {t("limit_reached_desc")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <PlanCard
            tier={t("free_tier")}
            price="$0"
            perks={[t("perk_free_1"), t("perk_free_2"), t("perk_free_3"), t("perk_free_4")]}
            cta={<Link to="/auth" className="w-full"><Button variant="outline" className="w-full">{t("get_started")}</Button></Link>}
          />
          <PlanCard
            highlight
            tier={t("pro_tier")}
            price={"$10" + t("per_month")}
            originalPrice={"$20" + t("per_month")}
            launchNote={t("launch_note")}
            launchPill={t("launch_pill")}
            perks={[t("perk_pro_1"), t("perk_pro_2"), t("perk_pro_3"), t("perk_pro_4")]}
            cta={
              <Button
                onClick={doUpgrade}
                className="w-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 text-black font-semibold hover:opacity-90"
              >
                <Crown className="h-4 w-4 mr-1" /> {t("upgrade")}
              </Button>
            }
          />
        </div>

        {providers.length > 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-slate-400 mb-3 text-center">Accepted payment methods</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  {PROVIDER_ICON[p.id] ?? <CreditCard className="h-4 w-4" />}
                  <span>{p.label}</span>
                  {!p.connected ? <span className="ms-auto text-[9px] text-amber-300 font-semibold">SOON</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <p className="mt-10 text-center text-xs text-slate-500 max-w-md mx-auto">
          Cancel anytime. Pro billing renews monthly at $10 (launch price). Includes: 50 AI Coach credits/day, 30 videos/month, full caption styles, and viral idea PDFs.
        </p>
      </section>
    </div>
  );
}

function PlanCard({
  tier,
  price,
  perks,
  highlight,
  originalPrice,
  launchNote,
  launchPill,
  cta,
}: {
  tier: string;
  price: string;
  perks: string[];
  highlight?: boolean;
  originalPrice?: string;
  launchNote?: string;
  launchPill?: string;
  cta: React.ReactNode;
}) {
  return (
    <div
      className={
        "relative rounded-2xl border p-8 flex flex-col " +
        (highlight
          ? "border-amber-400/40 bg-gradient-to-br from-fuchsia-950/40 to-amber-950/20 shadow-[0_20px_60px_-20px_rgba(217,70,239,0.35)]"
          : "border-white/10 bg-white/5")
      }
    >
      {launchPill && (
        <div className="absolute -top-3 start-6 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black shadow-lg">
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
        {originalPrice && <div className="text-lg font-medium text-slate-500 line-through">{originalPrice}</div>}
      </div>
      {launchNote && <p className="mt-2 text-xs font-medium text-amber-300/90">{launchNote}</p>}
      <ul className="mt-6 space-y-3 text-sm flex-1">
        {perks.map((p) => (
          <li key={p} className="flex gap-2"><Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />{p}</li>
        ))}
      </ul>
      <div className="mt-6">{cta}</div>
    </div>
  );
}