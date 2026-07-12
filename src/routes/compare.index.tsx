import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ArrowLeft, ArrowRight } from "lucide-react";

const URL = "https://tonguesyncai.com/compare";

export const Route = createFileRoute("/compare/")({
  head: () => ({
    meta: [
      { title: "Compare TongueSync AI — vs HeyGen, vs Rask AI" },
      { name: "description", content: "See how TongueSync AI compares to HeyGen and Rask AI for cultural dubbing and viral short-form video." },
      { property: "og:title", content: "Compare TongueSync AI" },
      { property: "og:description", content: "How TongueSync stacks up against HeyGen and Rask AI." },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: CompareHub,
});

function CompareHub() {
  const items = [
    { to: "/compare/heygen" as const, name: "TongueSync vs HeyGen", desc: "Short-form cultural dubbing vs enterprise AI avatars." },
    { to: "/compare/rask" as const, name: "TongueSync vs Rask AI", desc: "Cultural rewrites and viral clipping vs literal multi-language dubbing." },
  ];
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/"><Logo /></Link>
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </header>
      <section className="mx-auto max-w-3xl px-6 pt-12 pb-8 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 via-white to-amber-200 bg-clip-text text-transparent">Compare TongueSync AI</h1>
        <p className="mt-6 text-lg text-slate-300">Honest, up-to-date comparisons against the tools creators ask about most.</p>
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-24 grid gap-4 md:grid-cols-2">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-fuchsia-400/40 transition">
            <div className="text-lg font-semibold">{it.name}</div>
            <p className="mt-2 text-sm text-slate-400">{it.desc}</p>
            <div className="mt-4 inline-flex items-center gap-1 text-sm text-fuchsia-300 group-hover:gap-2 transition-all">Read comparison <ArrowRight className="h-4 w-4" /></div>
          </Link>
        ))}
      </section>
    </div>
  );
}