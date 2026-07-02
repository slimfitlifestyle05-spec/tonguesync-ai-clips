import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — TongueSync AI" },
      { name: "description", content: "How TongueSync AI collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — TongueSync AI" },
      { property: "og:description", content: "How TongueSync AI collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </header>
      <article className="mx-auto max-w-3xl px-6 pb-24 pt-8 prose prose-invert">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent">Privacy Policy</h1>
        <p className="mt-4 text-sm text-slate-400">Last updated: July 2026</p>

        <section className="mt-10 space-y-6 text-slate-300 leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold text-white">1. Information we collect</h2>
            <p className="mt-2">We collect the video URLs you submit, transcripts generated from them, your account email, and basic usage analytics needed to run and improve TongueSync AI.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">2. How we use your data</h2>
            <p className="mt-2">Your content is processed solely to generate clips, dubs, captions, titles, and descriptions for you. We do not sell or share your data with advertisers.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">3. Third-party services</h2>
            <p className="mt-2">We use best-in-class AI providers (transcription, translation, TTS) as sub-processors. They only receive the minimum data required to fulfill a request and are contractually bound not to train on it.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">4. Data retention</h2>
            <p className="mt-2">Generated assets are cached to your workspace so you can revisit them. You may delete any project or your entire account at any time from your dashboard.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">5. Contact</h2>
            <p className="mt-2">Questions? Email privacy@tonguesync.ai and we'll respond within 5 business days.</p>
          </div>
        </section>
      </article>
    </div>
  );
}