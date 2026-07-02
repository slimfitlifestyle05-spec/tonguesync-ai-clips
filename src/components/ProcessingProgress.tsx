import { useEffect, useRef, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Sparkles, Check, Loader2 } from "lucide-react";

type Props = {
  active: boolean;
  stages: string[];
  /** Total duration in ms for the fake progression. Default 4200ms. */
  duration?: number;
  /** How many skeleton result cards to render (0 to hide). Default 3. */
  skeletonCount?: number;
};

export function ProcessingProgress({ active, stages, duration = 4200, skeletonCount = 3 }: Props) {
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const announced = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!active) {
      // Snap to 100% for a satisfying finish, then reset shortly after unmount-worthy state.
      setProgress(100);
      const t = setTimeout(() => {
        setProgress(0);
        setStageIdx(0);
        announced.current = new Set();
      }, 350);
      return () => clearTimeout(t);
    }

    setProgress(0);
    setStageIdx(0);
    announced.current = new Set();

    const start = performance.now();
    // Cap the fake bar at 92% while the real server call is in flight,
    // so the last 8% happens on completion for a clean, honest finish.
    const cap = 92;
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(cap, (elapsed / duration) * cap);
      setProgress(pct);
      const idx = Math.min(stages.length - 1, Math.floor((pct / cap) * stages.length));
      setStageIdx(idx);
      if (!announced.current.has(idx)) {
        announced.current.add(idx);
        toast(stages[idx], { icon: <Sparkles className="h-4 w-4 text-fuchsia-400" /> });
      }
    };
    const id = setInterval(tick, 90);
    tick();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active && progress === 0) return null;

  return (
    <div className="mt-8 animate-fade-in">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-white/5 to-amber-400/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-amber-400 text-black">
              {active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {active && <span className="absolute inset-0 rounded-lg bg-fuchsia-400/40 blur-lg animate-pulse -z-10" />}
            </div>
            <div>
              <div className="text-sm font-semibold">
                {active ? stages[stageIdx] : "Done"}
              </div>
              <div className="text-xs text-slate-400">
                Step {Math.min(stageIdx + 1, stages.length)} of {stages.length}
              </div>
            </div>
          </div>
          <div className="text-sm font-mono text-slate-300">{Math.round(progress)}%</div>
        </div>

        <Progress value={progress} className="h-2 bg-white/10 [&>div]:bg-gradient-to-r [&>div]:from-fuchsia-500 [&>div]:to-amber-400 [&>div]:transition-all [&>div]:duration-300" />

        <div className="mt-4 flex flex-wrap gap-2">
          {stages.map((s, i) => {
            const done = i < stageIdx || !active;
            const current = i === stageIdx && active;
            return (
              <span
                key={s}
                className={
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors " +
                  (done
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                    : current
                    ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200"
                    : "border-white/10 bg-white/5 text-slate-400")
                }
              >
                {done ? <Check className="h-3 w-3" /> : current ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />}
                {s}
              </span>
            );
          })}
        </div>
      </div>

      {skeletonCount > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/5 overflow-hidden animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="relative aspect-[9/16] bg-black overflow-hidden">
                <Skeleton className="absolute inset-0 rounded-none bg-white/5" />
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
              </div>
              <div className="p-3 space-y-3">
                <Skeleton className="h-3 w-3/4 bg-white/10" />
                <Skeleton className="h-8 w-full bg-white/10" />
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-2">
                  <Skeleton className="h-2 w-1/2 bg-white/10" />
                  <Skeleton className="h-3 w-full bg-white/10" />
                  <Skeleton className="h-3 w-5/6 bg-white/10" />
                  <Skeleton className="h-3 w-2/3 bg-fuchsia-500/20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
