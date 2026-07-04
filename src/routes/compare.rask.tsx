import { createFileRoute } from "@tanstack/react-router";
import { ComparePage } from "@/components/ComparePage";

const TITLE = "TongueSync AI vs Rask AI — Cultural dubbing & viral shorts";
const DESC = "How TongueSync AI compares to Rask AI for translating videos into 130+ languages, with cultural rewrites and automatic short-form clipping built in.";
const URL = "https://tonguesync-ai-clips.lovable.app/compare/rask";

export const Route = createFileRoute("/compare/rask")({
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
      competitor="Rask AI"
      tagline="One video → localized shorts your audience actually shares."
      intro="Rask AI is a popular multi-language dubbing tool with 130+ language support and lip-sync. TongueSync AI goes further for short-form creators: automatic viral-clip extraction plus cultural rewrites so your Arabic sounds Egyptian and your Spanish sounds Mexican, not textbook."
      rows={ROWS}
      verdict={`Pick Rask AI if you need long-form dubbing into the widest possible language list and heavy lip-sync editing.\n\nPick TongueSync AI if your growth channel is Reels, TikTok and YouTube Shorts and you want cultural voice, regional dialects and viral-clip extraction in one place — without stitching multiple tools together.`}
      faqs={FAQS}
    />
  ),
});

const ROWS = [
  { label: "Best for", us: "Short-form creators & regional growth", them: "Multi-language long-form dubbing" },
  { label: "Auto viral-clip extraction from long video", us: true, them: false, highlight: true },
  { label: "Cultural rewrites (idioms, slang, humor)", us: true, them: "Literal translation", highlight: true },
  { label: "Regional Arabic dialects", us: true, them: "Standard Arabic" },
  { label: "Regional Spanish variants (MX, AR, ES)", us: true, them: "Neutral Spanish" },
  { label: "Total languages supported", us: "30+ (curated, native quality)", them: "130+" },
  { label: "Lip-sync", us: "Coming soon", them: true },
  { label: "Voice cloning", us: true, them: true },
  { label: "Free tier", us: "Yes — clips + dubs", them: "Limited free minutes" },
  { label: "Captions styled for TikTok/Reels", us: true, them: "Basic subtitles" },
  { label: "Community + PDF playbooks", us: true, them: false },
];

const FAQS = [
  { q: "Is TongueSync AI a Rask AI alternative?", a: "Yes — especially if you make short-form content. Rask covers more raw languages; TongueSync covers fewer but rewrites for culture, dialect and short-form pacing." },
  { q: "Does Rask AI support cultural rewrites?", a: "Rask primarily translates literally and lip-syncs. TongueSync rewrites the script into how a native creator in that region would actually say it, then dubs it." },
  { q: "Can I clip a long podcast into shorts here?", a: "Yes. Our AI clipper turns long videos into vertical shorts with animated captions automatically — then you can dub each one into another culture in a click." },
  { q: "Is there a free plan?", a: "Yes, no credit card required. You get free clips and free dubs to test the cultural quality before upgrading." },
];