import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Sparkles } from "lucide-react";

export const Route = createFileRoute("/showcase")({
  head: () => ({
    meta: [
      { title: "Showcase — Real dubbed shorts by TongueSync AI creators" },
      { name: "description", content: "Explore vertical shorts dubbed into Arabic, Spanish, French, Hindi and more — all made by real creators with TongueSync AI." },
      { property: "og:title", content: "TongueSync AI Showcase" },
      { property: "og:description", content: "Real vertical shorts dubbed into local dialects by creators around the world." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tonguesyncai.com/showcase" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://tonguesyncai.com/showcase" }],
  }),
  component: ShowcasePage,
});

type Item = {
  id: string;
  title: string;
  creator: string;
  language: string;
  region: string;
  poster: string;
  video: string;
  desc: string;
};

const SAMPLES: Item[] = [
  {
    id: "1",
    title: "AI workflow secrets — Arabic (Egypt)",
    creator: "@AhmedFounder",
    language: "AR",
    region: "EG",
    poster: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&h=1067&fit=crop",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    desc: "Original English tutorial re-voiced in Egyptian Arabic — landed 480K views in 2 days.",
  },
  {
    id: "2",
    title: "Pricing tip — Spanish (Mexico)",
    creator: "@CarlaBiz",
    language: "ES",
    region: "MX",
    poster: "https://images.unsplash.com/photo-1554774853-b414d2ad2c1a?w=600&h=1067&fit=crop",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    desc: "Business coach doubled her audience by dubbing weekly tips into LATAM Spanish.",
  },
  {
    id: "3",
    title: "Retention hook — Hindi",
    creator: "@PriyaCreates",
    language: "HI",
    region: "IN",
    poster: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&h=1067&fit=crop",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    desc: "Creator strategy dubbed into Hindi + burned subtitles — 3.2× watch time.",
  },
  {
    id: "4",
    title: "Productivity hack — French",
    creator: "@LucieMakes",
    language: "FR",
    region: "FR",
    poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&h=1067&fit=crop",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    desc: "US tech tips localized into Parisian French with native intonation.",
  },
  {
    id: "5",
    title: "Fitness mindset — Portuguese (BR)",
    creator: "@RafaFit",
    language: "PT",
    region: "BR",
    poster: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=1067&fit=crop",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    desc: "Coach's mindset shorts re-voiced into Brazilian Portuguese, tripled engagement.",
  },
  {
    id: "6",
    title: "Investing 101 — Turkish",
    creator: "@EminInvest",
    language: "TR",
    region: "TR",
    poster: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=1067&fit=crop",
    video: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    desc: "Finance educator built a Turkish audience by re-dubbing top posts weekly.",
  },
];

function ShowcasePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 border-b border-white/5">
        <Link to="/"><Logo /></Link>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Home</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-400/20 px-3 py-1 text-xs text-fuchsia-300 mb-4">
            <Sparkles className="h-3 w-3" /> Real creator results
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Shorts dubbed into <span className="bg-gradient-to-r from-fuchsia-400 to-amber-400 bg-clip-text text-transparent">every dialect</span>
          </h1>
          <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
            Explore how creators around the world use TongueSync AI to reach new audiences with culturally-native dubbing.
          </p>
          <div className="mt-6">
            <Link to="/auth">
              <Button className="bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black font-semibold hover:opacity-90">
                Start dubbing your own
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SAMPLES.map((item) => (
            <ShowcaseCard key={item.id} item={item} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ShowcaseCard({ item }: { item: Item }) {
  return (
    <div className="group rounded-xl border border-white/10 bg-white/5 overflow-hidden hover:border-fuchsia-400/40 transition">
      <div className="relative">
        <video
          src={item.video}
          poster={item.poster}
          controls
          preload="none"
          className="w-full aspect-[9/16] object-cover bg-black"
        />
        <div className="pointer-events-none absolute top-2 left-2 flex gap-1.5">
          <span className="rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-white">
            {item.language} · {item.region}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="text-sm font-medium">{item.title}</div>
        <div className="text-[11px] text-fuchsia-300 mt-0.5">{item.creator}</div>
        <div className="text-xs text-slate-400 mt-2">{item.desc}</div>
      </div>
    </div>
  );
}