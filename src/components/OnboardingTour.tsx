import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Rocket, X, Video, Globe2, Crown } from "lucide-react";

const KEY = "ts-onboarding-dismissed-v1";

type Step = { id: string; title: string; desc: string; icon: any; to: string; check: (p: any) => boolean };

const STEPS: Step[] = [
  {
    id: "clip",
    title: "Create your first clip",
    desc: "Turn a long video into vertical shorts with animated captions.",
    icon: Video,
    to: "/clipper",
    check: (p) => (p?.clips_used ?? 0) > 0,
  },
  {
    id: "dub",
    title: "Dub in a new language",
    desc: "Translate & re-voice your video into a native dialect.",
    icon: Globe2,
    to: "/dubbing",
    check: (p) => (p?.dubs_used ?? 0) > 0,
  },
  {
    id: "pro",
    title: "Unlock Pro features",
    desc: "Longer videos, no watermark, batch dubs, Social Kit AI.",
    icon: Crown,
    to: "/dashboard",
    check: (p) => p?.tier === "pro",
  },
];

export function OnboardingTour({ profile }: { profile: any }) {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(KEY) === "1");
  }, []);
  if (dismissed) return null;
  const doneCount = STEPS.filter((s) => s.check(profile)).length;
  if (doneCount === STEPS.length) return null;
  function dismiss() {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setDismissed(true);
  }
  return (
    <div className="relative rounded-2xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/5 to-amber-400/10 p-5">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-300"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="mb-3 flex items-center gap-2">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
          <Rocket className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-fuchsia-300/80 font-semibold">Getting started</div>
          <div className="text-base font-semibold">Complete your setup — {doneCount}/{STEPS.length}</div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {STEPS.map((s) => {
          const done = s.check(profile);
          const Icon = s.icon;
          return (
            <Link
              key={s.id}
              to={s.to}
              className={`group rounded-xl border p-3 transition ${
                done
                  ? "border-emerald-400/30 bg-emerald-500/5"
                  : "border-white/10 bg-white/5 hover:border-fuchsia-400/30 hover:bg-white/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${done ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-300"}`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                <div className="text-sm font-medium">{s.title}</div>
              </div>
              <div className="text-xs text-slate-400">{s.desc}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}