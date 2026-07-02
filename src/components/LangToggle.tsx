import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Button variant="ghost" size="sm" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
      <Languages className="h-4 w-4 mr-1" />
      {lang === "en" ? "\u0639\u0631\u0628\u064a" : "English"}
    </Button>
  );
}
