import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Globe2, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — TongueSync AI" },
      { name: "description", content: "TongueSync AI helps creators speak every culture — turning one video into localized shorts for the world." },
      { property: "og:title", content: "About TongueSync AI" },
      { property: "og:description", content: "Turning one video into localized shorts for every culture." },
      { property: "og:url", content: "https://tonguesyncai.com/about" },
    ],
    links: [{ rel: "canonical", href: "https://tonguesyncai.com/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-12 pb-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 via-white to-amber-200 bg-clip-text text-transparent">
          We help creators speak every culture.
        </h1>
        <p className="mt-6 text-lg text-slate-300 leading-relaxed">
          TongueSync AI was built for a simple belief: great stories shouldn't stop at a language border.
          We combine viral-clip AI with culturally-aware dubbing so a single video can resonate authentically in Cairo, Riyadh, Madrid, and Mexico City — all in one afternoon.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24 grid gap-4 md:grid-cols-3">
        <h2 className="sr-only col-span-full">Our values</h2>
        <ValueCard icon={<Globe2 className="h-5 w-5" />} title="Cultural, not literal" desc="Idioms, slang, humor — translated the way real people speak, not the way a dictionary does." />
        <ValueCard icon={<Sparkles className="h-5 w-5" />} title="Creator-first" desc="Every feature is shipped after real feedback from creators, agencies, and brand teams." />
        <ValueCard icon={<Users className="h-5 w-5" />} title="Global team" desc="Distributed across MENA, Europe, and LATAM — the same regions we help our users reach." />
      </section>
    </div>
  );
}

function ValueCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-amber-400/20 border border-white/10 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}