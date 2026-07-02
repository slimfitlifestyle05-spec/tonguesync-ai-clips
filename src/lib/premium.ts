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

export function generateSocialKit(title: string) {
  const hook = title.trim() || "Watch this until the end";
  const hashtags = ["#fyp", "#viral", "#reels", "#tiktok", "#" + hook.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "")];
  return {
    title: `\u26a1 ${hook} \u2014 you won't believe #3`,
    description: `${hook}. Save this before it's gone. New drops daily on TongueSync AI.`,
    hashtags,
  };
}

export function withEmojis(text: string) {
  return text
    .replace(/\bmoney\b/gi, "money \ud83d\udcb0")
    .replace(/\bfire\b/gi, "fire \ud83d\udd25")
    .replace(/\blove\b/gi, "love \u2764\ufe0f")
    .replace(/\bnew\b/gi, "new \u2728");
}
