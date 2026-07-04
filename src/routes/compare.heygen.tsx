import { createFileRoute } from "@tanstack/react-router";
import { ComparePage } from "@/components/ComparePage";

const TITLE = "TongueSync AI vs HeyGen — Cultural dubbing for viral shorts";
const DESC = "How TongueSync AI compares to HeyGen for translating and dubbing short videos into culturally authentic Arabic, Spanish and more.";
const URL = "https://tonguesync-ai-clips.lovable.app/compare/heygen";

export const Route = createFileRoute("/compare/heygen")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: () => (
    <ComparePage
      competitor="HeyGen"
      tagline="Cultural voice, viral clips, one workflow."
      intro="HeyGen is a strong AI avatar and dubbing platform focused on translated video for enterprise and marketing. TongueSync AI is purpose-built for creators making short-form video — with cultural rewrites, regional dialects and automatic viral-clip extraction bundled together."
      rows={ROWS}
      verdict={`Pick HeyGen if your priority is a talking AI avatar or an enterprise dubbing pipeline with SSO and seat pricing.\n\nPick TongueSync AI if you make Reels, TikToks or YouTube Shorts and need clips + dubs that sound like a native creator from Cairo, Riyadh or Mexico City — not a literal translation of your English script.`}
      faqs={FAQS}
    />
  ),
});

const ROWS = [
  { label: "Best for", us: "Short-form creators & agencies", them: "Enterprise avatars & training video" },
  { label: "Auto viral-clip extraction", us: true, them: false, highlight: true },
  { label: "Cultural rewrites (not literal translation)", us: true, them: false, highlight: true },
  { label: "Regional Arabic dialects (Egyptian, Khaleeji, Levantine)", us: true, them: "Modern Standard Arabic" },
  { label: "Latin American Spanish variants", us: true, them: "Neutral Spanish" },
  { label: "AI avatar / talking head", us: false, them: true },
  { label: "Voice cloning", us: true, them: true },
  { label: "Free tier", us: "Yes — clips + dubs", them: "Limited watermark trial" },
  { label: "Starting paid plan", us: "Simple Pro subscription", them: "From $24/mo (Creator)" },
  { label: "Built-in captions styled for TikTok/Reels", us: true, them: "Basic subtitles" },
  { label: "PDF playbooks & trending idea community", us: true, them: false },
];

const FAQS = [
  { q: "Is TongueSync AI a HeyGen alternative?", a: "Yes — for creators focused on short-form video. HeyGen leans toward AI avatars and enterprise dubbing; TongueSync focuses on clipping long videos into shorts and dubbing them with culturally authentic voice." },
  { q: "Does TongueSync support Arabic dialects?", a: "Yes. TongueSync dubs into Egyptian, Khaleeji, and Levantine Arabic with rewritten slang and idioms — not the Modern Standard Arabic that most translation tools default to." },
  { q: "Can I try TongueSync for free?", a: "Yes. You get free clips and dubs on the free plan without a credit card. Upgrade only when you need higher monthly volume." },
  { q: "Do you offer AI avatars like HeyGen?", a: "Not today — we intentionally focus on voice, dialect and viral clipping instead of avatar generation." },
];