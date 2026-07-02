export const STYLE_TEMPLATES = [
  { id: "hormozi", name: "Alex Hormozi", preview: "bg-black text-yellow-300", free: false },
  { id: "neon", name: "Neon", preview: "bg-fuchsia-900 text-cyan-300", free: false },
  { id: "modern", name: "Clean Modern", preview: "bg-white text-slate-900 border", free: true },
  { id: "beast", name: "Bold Impact", preview: "bg-red-600 text-white", free: false },
  { id: "minimal", name: "Minimal", preview: "bg-slate-900 text-white", free: true },
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ar", label: "\u0627\u0644\u0639\u0631\u0628\u064a\u0629" },
  { code: "es", label: "Espa\u00f1ol" },
  { code: "fr", label: "Fran\u00e7ais" },
  { code: "de", label: "Deutsch" },
  { code: "hi", label: "\u0939\u093f\u0928\u094d\u0926\u0940" },
  { code: "pt", label: "Portugu\u00eas" },
  { code: "tr", label: "T\u00fcrk\u00e7e" },
];

export const REGIONS = [
  { code: "SA", label: "Saudi Arabia (Khaleeji)" },
  { code: "EG", label: "Egypt" },
  { code: "MA", label: "Morocco (Darija)" },
  { code: "US", label: "United States" },
  { code: "UK", label: "United Kingdom" },
  { code: "MX", label: "Mexico" },
  { code: "BR", label: "Brazil" },
  { code: "IN", label: "India" },
  { code: "TR", label: "Turkey" },
];

// Topic profiles used by the mock content-analysis pipeline. In production the
// transcript is fed to Gemini and it returns the same shape; here we pattern-
// match keywords so the demo output always looks topical and professional.
type TopicProfile = {
  id: string;
  keywords: string[];
  hook: string;
  titles: string[];
  descriptions: string[];
  hashtags: string[];
};

const TOPIC_PROFILES: TopicProfile[] = [
  {
    id: "ai_tools",
    keywords: ["ai", "chatgpt", "gemini", "prompt", "automation", "agent", "llm", "model"],
    hook: "The AI workflow that replaces 4 hours of work",
    titles: [
      "This AI Tool Just Killed My 4-Hour Workflow (Try It Free)",
      "I Replaced My Whole Team With These 3 AI Agents — Here's How",
      "The ChatGPT Prompt Every Founder Should Steal in 2026",
    ],
    descriptions: [
      "A breakdown of the exact AI stack top operators are using right now to automate research, writing, and outreach in minutes instead of hours. Watch until the end for the prompt template that quietly does 80% of the work — copy it, tweak it, and ship it the same day.",
      "If you're still doing this manually in 2026, you're leaving hours on the table. This clip walks through a real automation built with modern AI agents, why it converts, and the small tweak that made engagement jump overnight. Save it before the algorithm buries it.",
    ],
    hashtags: ["#AI", "#AITools", "#ChatGPT", "#Automation", "#Productivity", "#FutureOfWork", "#TechTips"],
  },
  {
    id: "business",
    keywords: ["business", "startup", "revenue", "sales", "founder", "profit", "sme", "entrepreneur", "cash", "client"],
    hook: "The pricing tweak that doubled our revenue",
    titles: [
      "The Pricing Tweak That Doubled Our Revenue in 30 Days",
      "This Simple Offer Change Turned $0 Into $27K/Month",
      "Every Broke Founder Skips This One Sales Habit",
    ],
    descriptions: [
      "A field-tested pricing move used by 7-figure operators to reposition an existing offer without adding a single new feature. Real numbers, real timeline, and the exact objection-handling script we swapped in — steal it and test it against your current funnel this week.",
      "Most founders scale traffic before fixing the offer. This clip shows the reverse — a tiny structural change to the pitch, why it works on cold audiences, and how to roll it out without confusing your existing customers.",
    ],
    hashtags: ["#Business", "#Entrepreneur", "#StartupTips", "#SmallBusiness", "#SalesStrategy", "#MoneyTips", "#FounderMode"],
  },
  {
    id: "marketing",
    keywords: ["marketing", "content", "brand", "ads", "seo", "funnel", "conversion", "audience", "growth"],
    hook: "Why your content isn't converting (and the fix)",
    titles: [
      "Why 99% of Content Doesn't Convert (Fix It in 60 Seconds)",
      "The Hook Formula Top Creators Are Quietly Using in 2026",
      "Stop Writing Captions Like This — Do This Instead",
    ],
    descriptions: [
      "A tight breakdown of the exact hook-and-payoff pattern used by high-retention creators right now, why the algorithm rewards it, and how to rebuild your last three posts around it before you publish anything new. High-signal, zero fluff.",
      "Most marketing dies in the first three seconds. This clip decodes what actually holds attention in 2026, the structural mistake almost everyone makes, and a repeatable template you can apply to your next launch.",
    ],
    hashtags: ["#Marketing", "#ContentStrategy", "#SocialMediaMarketing", "#DigitalMarketing", "#GrowthHacks", "#CreatorEconomy", "#SEO"],
  },
  {
    id: "tech",
    keywords: ["tech", "app", "software", "iphone", "android", "gadget", "device", "code", "developer"],
    hook: "The hidden feature no one is talking about",
    titles: [
      "The Hidden Feature Almost No One Knows About",
      "3 Under-the-Radar Tools That Feel Illegal to Use for Free",
      "This Tiny Setting Changed How I Use My Phone Forever",
    ],
    descriptions: [
      "A quick walk-through of a genuinely useful feature most people miss on day one, what it unlocks in real workflows, and the exact steps to enable it. Bookmark this — you'll come back to it the next time someone asks you 'how did you do that?'",
      "Tech shouldn't feel this hidden. This clip surfaces a legitimately powerful capability, why it matters for anyone who works from a laptop or phone, and how to plug it into your daily setup in under a minute.",
    ],
    hashtags: ["#Tech", "#TechTips", "#Gadgets", "#Innovation", "#Software", "#TechTok", "#ProductivityHacks"],
  },
  {
    id: "fitness",
    keywords: ["fitness", "workout", "gym", "diet", "protein", "muscle", "training", "cardio", "health"],
    hook: "The 10-minute routine that actually works",
    titles: [
      "The 10-Minute Routine That Beats an Hour at the Gym",
      "Stop Doing Cardio Like This — Do This Instead",
      "The Protein Mistake Killing Your Progress",
    ],
    descriptions: [
      "A no-nonsense breakdown of a short, high-output routine you can slot into a busy day, why it hits the right muscle groups, and the recovery tweak that quietly compounds results week over week. Save it, run it for two weeks, thank yourself later.",
      "Most people train hard and progress slowly because of one fixable pattern. This clip explains the mechanic, the science in plain English, and the exact adjustment you can make in your next session.",
    ],
    hashtags: ["#Fitness", "#Workout", "#GymTok", "#HealthTips", "#Training", "#FitnessMotivation", "#WellnessJourney"],
  },
];

const GENERIC_PROFILE: TopicProfile = {
  id: "general",
  keywords: [],
  hook: "The insight most people scroll past",
  titles: [
    "The One Insight Most People Scroll Right Past",
    "You'll Wish You Watched This 6 Months Ago",
    "Everyone's Talking About This — Here's Why It Matters",
  ],
  descriptions: [
    "A concise, high-signal breakdown of the idea driving this clip, why it lands right now, and how to apply it before the trend cycles out. Watch to the end for the practical takeaway you can act on today.",
    "Short, sharp, and built for retention — this clip distills the core point into something you can share with one friend and actually change how they think about the topic.",
  ],
  hashtags: ["#Viral", "#MustWatch", "#TrendingNow", "#Insights", "#SelfImprovement", "#Tips2026"],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function analyzeTranscript(transcript: string): TopicProfile {
  const text = (transcript || "").toLowerCase();
  let best: { profile: TopicProfile; score: number } = { profile: GENERIC_PROFILE, score: 0 };
  for (const profile of TOPIC_PROFILES) {
    let score = 0;
    for (const kw of profile.keywords) {
      const re = new RegExp(`\\b${kw}\\b`, "g");
      const matches = text.match(re);
      if (matches) score += matches.length;
    }
    if (score > best.score) best = { profile, score };
  }
  return best.profile;
}

/**
 * Generates a Social Kit by analyzing the actual (mock) transcribed/translated
 * text of the video — not the manual title — so the viral title, description,
 * and hashtags reflect the real topic, hook, and SEO surface of the content.
 */
export function generateSocialKit(transcript: string) {
  const profile = analyzeTranscript(transcript);
  const seed = hashString(transcript || profile.id);
  return {
    topic: profile.id,
    hook: profile.hook,
    title: pick(profile.titles, seed),
    description: pick(profile.descriptions, seed >> 3),
    hashtags: profile.hashtags,
  };
}

export function withEmojis(text: string) {
  return text
    .replace(/\bmoney\b/gi, "money \ud83d\udcb0")
    .replace(/\bfire\b/gi, "fire \ud83d\udd25")
    .replace(/\blove\b/gi, "love \u2764\ufe0f")
    .replace(/\bnew\b/gi, "new \u2728");
}
