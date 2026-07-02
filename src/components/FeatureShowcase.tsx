import { Link } from "@tanstack/react-router";
import { ChevronRight, Scissors as ScissorsIcon, Volume2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function FeatureCard({
  to,
  title,
  desc,
  visual,
}: {
  to: string;
  title: string;
  desc: string;
  visual: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Link
      to={to as any}
      className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.015] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_60px_-30px_rgba(0,0,0,0.8)] transition hover:border-fuchsia-400/40 hover:from-white/[0.06]"
    >
      <div className="relative h-52 overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-950/80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(217,70,239,0.12),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(251,191,36,0.10),transparent_55%)]" />
        <div className="relative h-full w-full">{visual}</div>
      </div>
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-slate-400 line-clamp-2">{desc}</p>
        </div>
        <div className="shrink-0 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-fuchsia-200 transition group-hover:border-fuchsia-400/50 group-hover:bg-fuchsia-500/10 group-hover:text-white">
          {t("try_now")}
          <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export function ClipperVisual() {
  return (
    <div className="flex h-full w-full items-center justify-between gap-4 px-6 py-5">
      <div className="flex flex-1 items-center gap-3">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-slate-700 to-slate-900 ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.15),transparent_40%)]" />
          <div className="absolute inset-x-2 bottom-2 h-1 rounded-full bg-white/20">
            <div className="h-full w-2/3 rounded-full bg-fuchsia-400/80" />
          </div>
          <ScissorsIcon className="absolute right-1.5 top-1.5 h-3 w-3 text-white/70" />
        </div>
        <svg width="26" height="20" viewBox="0 0 26 20" fill="none" className="shrink-0 text-fuchsia-300/80">
          <path d="M2 10 C 8 2, 18 2, 24 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M20 6 L24 10 L20 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <div className="relative flex h-28 flex-1 items-center justify-center">
          {[0, 1, 2].map((i) => {
            const rot = [-10, 0, 10][i];
            const tx = [-22, 0, 22][i];
            const grads = [
              "from-amber-300/40 to-fuchsia-500/40",
              "from-fuchsia-400/50 to-indigo-500/40",
              "from-emerald-300/40 to-cyan-500/40",
            ][i];
            return (
              <div
                key={i}
                className={`absolute h-24 w-[52px] rounded-md ring-1 ring-white/15 shadow-lg bg-gradient-to-br ${grads}`}
                style={{ transform: `translateX(${tx}px) rotate(${rot}deg)` }}
              >
                <div className="absolute inset-x-1 bottom-1 h-1 rounded-full bg-white/40" />
                <div className="absolute inset-x-1 top-1 h-1 rounded-full bg-white/20" />
              </div>
            );
          })}
        </div>
      </div>
      <div className="hidden shrink-0 rounded-lg border border-white/10 bg-slate-950/70 p-2.5 backdrop-blur sm:block">
        <div className="text-[10px] text-slate-400">How many viral clips?</div>
        <div className="mt-1.5 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className={
                "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium " +
                (n === 3
                  ? "bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black"
                  : "border border-white/10 bg-white/5 text-slate-300")
              }
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DubbingVisual() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-4 px-6 py-5">
      <div className="relative h-28 w-[86px] shrink-0 overflow-hidden rounded-md ring-1 ring-white/15 bg-gradient-to-br from-slate-600 to-slate-900">
        <div className="absolute inset-x-3 top-3 h-6 w-6 rounded-full bg-amber-200/70" />
        <div className="absolute inset-x-2 bottom-2 h-8 rounded bg-white/15" />
        <div className="absolute inset-1 rounded border border-dashed border-fuchsia-300/70" />
      </div>
      <div className="flex flex-1 items-center gap-2">
        <FlagBadge kind="global" />
        <Soundwave />
        <FlagBadge kind="local" />
      </div>
      <Volume2 className="h-4 w-4 shrink-0 text-fuchsia-300/80" />
    </div>
  );
}

function FlagBadge({ kind }: { kind: "global" | "local" }) {
  if (kind === "global") {
    return (
      <div className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/70 to-cyan-400/70 ring-1 ring-white/20">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white/95">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 12h18M12 3c3 3.5 3 14 0 18M12 3c-3 3.5-3 14 0 18" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
    );
  }
  return (
    <div className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-amber-400/80 ring-1 ring-white/20">
      <span className="text-[10px] font-bold text-black">SA</span>
      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" />
    </div>
  );
}

function Soundwave() {
  const bars = [4, 8, 14, 10, 18, 22, 16, 10, 14, 8, 4];
  return (
    <div className="flex flex-1 items-center justify-center gap-[3px]">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-b from-fuchsia-400 to-amber-300"
          style={{ height: `${h}px`, opacity: 0.5 + (h / 22) * 0.5 }}
        />
      ))}
    </div>
  );
}