import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ar";

type Dict = Record<string, string>;

const en: Dict = {
  "brand": "TongueSync AI",
  "tagline": "Turn any video into viral, locally-dubbed shorts.",
  "hero_sub": "AI-powered vertical clipping and cultural dubbing for creators and brands \u2014 in English, Arabic, and beyond.",
  "get_started": "Get started",
  "sign_in": "Sign in",
  "sign_out": "Sign out",
  "sign_up": "Create account",
  "dashboard": "Dashboard",
  "clipper": "AI Video Clipper",
  "clipper_desc": "Upload a long video and get 3 vertical shorts with animated captions.",
  "dubbing": "Cultural AI Dubbing",
  "dubbing_desc": "Rewrite and re-voice your video in the local dialect and slang of any region.",
  "email": "Email",
  "password": "Password",
  "continue_with_google": "Continue with Google",
  "or": "or",
  "features": "Features",
  "pricing": "Pricing",
  "free_tier": "Free",
  "pro_tier": "Pro",
  "per_month": "/month",
  "upgrade": "Upgrade to Pro",
  "quota_used": "Quota used",
  "generate": "Generate",
  "processing": "Processing\u2026",
  "watermark_notice": "Free tier videos include a TongueSync AI watermark.",
  "style": "Caption style",
  "language": "Language",
  "target_language": "Target language",
  "target_country": "Target region",
  "auto_emojis": "Auto emojis",
  "highlight_keywords": "Highlight key words",
  "social_kit": "AI Social Kit",
  "premium_locked": "Unlock with Pro",
  "download": "Download",
  "title_placeholder": "Video title",
  "source_placeholder": "Paste a YouTube or video URL",
  "limit_reached": "You've reached your free limit",
  "limit_reached_desc": "Upgrade to Pro for 30 videos a month, no watermark, and premium styles.",
  "close": "Close",
  "back": "Back",
  "settings": "Settings",
};

const ar: Dict = {
  "brand": "TongueSync AI",
  "tagline": "\u062d\u0648\u0651\u0644 \u0623\u064a \u0641\u064a\u062f\u064a\u0648 \u0625\u0644\u0649 \u0645\u0642\u0627\u0637\u0639 \u0642\u0635\u064a\u0631\u0629 \u0645\u062f\u0628\u0644\u062c\u0629 \u0645\u062d\u0644\u064a\u0651\u0627\u064b.",
  "hero_sub": "\u062a\u0642\u0637\u064a\u0639 \u062a\u0644\u0642\u0627\u0626\u064a \u0648\u062f\u0628\u0644\u062c\u0629 \u062b\u0642\u0627\u0641\u064a\u0629 \u0644\u0644\u0641\u064a\u062f\u064a\u0648 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0644\u0644\u0645\u0628\u062f\u0639\u064a\u0646 \u0648\u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u062a\u062c\u0627\u0631\u064a\u0629.",
  "get_started": "\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646",
  "sign_in": "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644",
  "sign_out": "\u062e\u0631\u0648\u062c",
  "sign_up": "\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628",
  "dashboard": "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645",
  "clipper": "\u062a\u0642\u0637\u064a\u0639 \u0627\u0644\u0641\u064a\u062f\u064a\u0648 \u0627\u0644\u0630\u0643\u064a",
  "clipper_desc": "\u0627\u0631\u0641\u0639 \u0641\u064a\u062f\u064a\u0648 \u0637\u0648\u064a\u0644 \u0648\u0627\u062d\u0635\u0644 \u0639\u0644\u0649 3 \u0645\u0642\u0627\u0637\u0639 \u0639\u0645\u0648\u062f\u064a\u0629 \u0645\u0639 \u062a\u0631\u062c\u0645\u0627\u062a \u0645\u062a\u062d\u0631\u0643\u0629.",
  "dubbing": "\u0627\u0644\u062f\u0628\u0644\u062c\u0629 \u0627\u0644\u062b\u0642\u0627\u0641\u064a\u0629 \u0627\u0644\u0630\u0643\u064a\u0629",
  "dubbing_desc": "\u0623\u0639\u062f \u0635\u064a\u0627\u063a\u0629 \u0641\u064a\u062f\u064a\u0648\u0643 \u0628\u0627\u0644\u0644\u0647\u062c\u0629 \u0648\u0627\u0644\u062b\u0642\u0627\u0641\u0629 \u0627\u0644\u0645\u062d\u0644\u064a\u0629 \u0644\u0623\u064a \u0645\u0646\u0637\u0642\u0629.",
  "email": "\u0627\u0644\u0628\u0631\u064a\u062f",
  "password": "\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631",
  "continue_with_google": "\u062a\u0627\u0628\u0639 \u0628\u062d\u0633\u0627\u0628 \u062c\u0648\u062c\u0644",
  "or": "\u0623\u0648",
  "features": "\u0627\u0644\u0645\u064a\u0632\u0627\u062a",
  "pricing": "\u0627\u0644\u0623\u0633\u0639\u0627\u0631",
  "free_tier": "\u0645\u062c\u0627\u0646\u064a",
  "pro_tier": "\u0627\u062d\u062a\u0631\u0627\u0641\u064a",
  "per_month": "/\u0634\u0647\u0631",
  "upgrade": "\u062a\u0631\u0642\u064a\u0629 \u0625\u0644\u0649 \u0627\u0644\u0627\u062d\u062a\u0631\u0627\u0641\u064a",
  "quota_used": "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645",
  "generate": "\u0625\u0646\u0634\u0627\u0621",
  "processing": "\u062c\u0627\u0631\u064d \u0627\u0644\u0645\u0639\u0627\u0644\u062c\u0629\u2026",
  "watermark_notice": "\u0645\u0642\u0627\u0637\u0639 \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0645\u062c\u0627\u0646\u064a\u0629 \u062a\u062d\u062a\u0648\u064a \u0639\u0644\u0649 \u0639\u0644\u0627\u0645\u0629 \u0645\u0627\u0626\u064a\u0629.",
  "style": "\u0646\u0645\u0637 \u0627\u0644\u062a\u0631\u062c\u0645\u0629",
  "language": "\u0627\u0644\u0644\u063a\u0629",
  "target_language": "\u0627\u0644\u0644\u063a\u0629 \u0627\u0644\u0647\u062f\u0641",
  "target_country": "\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0647\u062f\u0641",
  "auto_emojis": "\u0625\u064a\u0645\u0648\u062c\u064a \u062a\u0644\u0642\u0627\u0626\u064a",
  "highlight_keywords": "\u062a\u0645\u064a\u064a\u0632 \u0627\u0644\u0643\u0644\u0645\u0627\u062a \u0627\u0644\u0645\u0641\u062a\u0627\u062d\u064a\u0629",
  "social_kit": "\u062d\u0632\u0645\u0629 \u0627\u0644\u0646\u0634\u0631",
  "premium_locked": "\u064a\u0641\u062a\u062d \u0641\u064a \u0627\u0644\u0628\u0627\u0642\u0629 \u0627\u0644\u0627\u062d\u062a\u0631\u0627\u0641\u064a\u0629",
  "download": "\u062a\u062d\u0645\u064a\u0644",
  "title_placeholder": "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0641\u064a\u062f\u064a\u0648",
  "source_placeholder": "\u0623\u0644\u0635\u0642 \u0631\u0627\u0628\u0637 \u064a\u0648\u062a\u064a\u0648\u0628 \u0623\u0648 \u0641\u064a\u062f\u064a\u0648",
  "limit_reached": "\u0627\u0646\u062a\u0647\u062a \u062d\u0635\u062a\u0643 \u0627\u0644\u0645\u062c\u0627\u0646\u064a\u0629",
  "limit_reached_desc": "\u062a\u0631\u0642\u0651 \u0625\u0644\u0649 \u0627\u0644\u0628\u0627\u0642\u0629 \u0627\u0644\u0627\u062d\u062a\u0631\u0627\u0641\u064a\u0629 \u0644\u062a\u062d\u0635\u0644 \u0639\u0644\u0649 30 \u0641\u064a\u062f\u064a\u0648 \u0634\u0647\u0631\u064a\u0651\u0627\u064b.",
  "close": "\u0625\u063a\u0644\u0627\u0642",
  "back": "\u0631\u062c\u0648\u0639",
  "settings": "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a",
};

const dicts: Record<Lang, Dict> = { en, ar };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: keyof typeof en) => string; dir: "ltr" | "rtl" };
const I18nCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (k) => en[k as string] ?? String(k), dir: "ltr" });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("ts_lang") as Lang | null;
    if (saved === "en" || saved === "ar") setLangState(saved);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") window.localStorage.setItem("ts_lang", l);
  };
  const t = (k: keyof typeof en) => dicts[lang][k as string] ?? en[k as string] ?? String(k);
  return <I18nCtx.Provider value={{ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }}>{children}</I18nCtx.Provider>;
}

export const useI18n = () => useContext(I18nCtx);