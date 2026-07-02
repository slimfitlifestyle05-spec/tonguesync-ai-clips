import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { ArrowLeft, Mail, MessageCircle, Twitter } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — TongueSync AI" },
      { name: "description", content: "Get in touch with the TongueSync AI team — support, partnerships, and press." },
      { property: "og:title", content: "Contact TongueSync AI" },
      { property: "og:description", content: "Support, partnerships, and press." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Logo />
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </header>

      <section className="mx-auto max-w-3xl px-6 pt-12 pb-24">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-fuchsia-300 to-amber-200 bg-clip-text text-transparent text-center">
          Let's talk.
        </h1>
        <p className="mt-4 text-center text-slate-300">We usually respond within one business day.</p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <ContactCard icon={<Mail className="h-5 w-5" />} title="Support" text="support@tonguesync.ai" href="mailto:support@tonguesync.ai" />
          <ContactCard icon={<MessageCircle className="h-5 w-5" />} title="Partnerships" text="partners@tonguesync.ai" href="mailto:partners@tonguesync.ai" />
          <ContactCard icon={<Twitter className="h-5 w-5" />} title="Press & social" text="@tonguesyncai" href="https://twitter.com/tonguesyncai" />
        </div>
      </section>
    </div>
  );
}

function ContactCard({ icon, title, text, href }: { icon: React.ReactNode; title: string; text: string; href: string }) {
  return (
    <a
      href={href}
      className="block rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur hover:bg-white/[0.06] hover:border-fuchsia-400/30 transition-all"
    >
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-amber-400/20 border border-white/10 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
    </a>
  );
}