import { useEffect, useState } from "react";

const MESSAGES = [
  { emoji: "🔥", text: "Ahmed from Riyadh just upgraded to Pro" },
  { emoji: "✨", text: "Marie from Cairo just generated 3 viral clips" },
  { emoji: "🎬", text: "Yusuf from Dubai just dubbed a reel in Khaleeji" },
  { emoji: "🚀", text: "Sofia from Madrid just published to TikTok" },
  { emoji: "🎙️", text: "Karim from Casablanca localized 5 shorts in Darija" },
  { emoji: "💥", text: "Layla from Beirut hit 1M views with a synced short" },
  { emoji: "⭐", text: "Omar from Amman just joined the Pro plan" },
  { emoji: "🌍", text: "Isabella from Mexico City dubbed into LATAM Spanish" },
];

export function SocialProofToast() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const showOne = () => {
      if (!mounted) return;
      setIdx((i) => (i + 1) % MESSAGES.length);
      setVisible(true);
      window.setTimeout(() => mounted && setVisible(false), 5000);
    };
    const first = window.setTimeout(showOne, 3500);
    const interval = window.setInterval(showOne, 12000);
    return () => {
      mounted = false;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  const msg = MESSAGES[idx];
  return (
    <div
      aria-live="polite"
      className={
        "fixed bottom-6 left-6 z-50 max-w-xs pointer-events-none transition-all duration-500 " +
        (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")
      }
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl px-4 py-3 shadow-2xl">
        <div className="text-2xl leading-none">{msg.emoji}</div>
        <div>
          <div className="text-sm text-white font-medium">{msg.text}</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mt-0.5">Just now</div>
        </div>
      </div>
    </div>
  );
}