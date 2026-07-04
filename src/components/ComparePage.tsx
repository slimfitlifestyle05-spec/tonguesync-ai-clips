import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, Sparkles, ArrowRight } from "lucide-react";

export type CompareRow = {
  label: string;
  us: string | boolean;
  them: string | boolean;
  highlight?: boolean;
};

export function ComparePage({
  competitor,
  tagline,
  intro,
  rows,
  verdict,
  faqs,
}: {
  competitor: string;
  tagline: string;
  intro: string;
  rows: CompareRow[];
  verdict: string;
  faqs: { q: string; a: string }[];
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pt-10 pb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles className="h-3 w-3 text-amber-300" /> Comparison
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 via-white to-amber-200 bg-clip-text text-transparent">
          TongueSync AI vs {competitor}
        </h1>
        <p className="mt-4 text-lg text-amber-200/90 italic">{tagline}</p>
        <p className="mt-6 text-slate-300 leading-relaxed max-w-2xl mx-auto">{intro}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth">
            <Button className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
              Try TongueSync free <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <Link to="/showcase">
            <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">See real examples</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur">
          <div className="grid grid-cols-3 border-b border-white/10 bg-white/5 text-sm font-semibold">
            <div className="p-4 text-slate-400">Feature</div>
            <div className="p-4 text-fuchsia-200">TongueSync AI</div>
            <div className="p-4 text-slate-300">{competitor}</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              className={
                "grid grid-cols-3 border-b border-white/5 text-sm " +
                (r.highlight ? "bg-fuchsia-500/5" : "")
              }
            >
              <div className="p-4 text-slate-300">{r.label}</div>
              <Cell value={r.us} tone="us" />
              <Cell value={r.them} tone="them" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-slate-400 text-center">
          Comparison based on publicly available information from {competitor}'s website as of 2026. Features change — verify current specs on their site.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">The verdict</h2>
        <p className="text-slate-300 leading-relaxed whitespace-pre-line">{verdict}</p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Frequently asked</h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 group">
              <summary className="cursor-pointer font-semibold text-white list-none flex items-center justify-between">
                {f.q}
                <span className="text-slate-500 group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-3 text-sm text-slate-300 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 to-amber-400/10 p-6 text-center">
          <h3 className="text-xl font-bold">Try it on your own video — free.</h3>
          <p className="mt-2 text-sm text-slate-300">No credit card. See the cultural dubbing difference in minutes.</p>
          <Link to="/auth">
            <Button className="mt-4 bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
              Start free <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Cell({ value, tone }: { value: string | boolean; tone: "us" | "them" }) {
  if (typeof value === "boolean") {
    return (
      <div className="p-4">
        {value ? (
          <Check className={"h-5 w-5 " + (tone === "us" ? "text-fuchsia-300" : "text-emerald-300")} />
        ) : (
          <X className="h-5 w-5 text-slate-500" />
        )}
      </div>
    );
  }
  return (
    <div className={"p-4 " + (tone === "us" ? "text-white" : "text-slate-300")}>{value}</div>
  );
}