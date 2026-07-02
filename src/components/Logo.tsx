import { cn } from "@/lib/utils";

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="tsg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8b5cf6" />
            <stop offset="0.5" stopColor="#ec4899" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="url(#tsg)" />
        <g stroke="white" strokeWidth="2.4" strokeLinecap="round">
          <path d="M8 24h3" />
          <path d="M13 20v8" />
          <path d="M17 16v16" />
          <path d="M21 20v8" />
          <path d="M25 22v4" />
        </g>
        <path d="M31 16l12 8-12 8V16z" fill="white" />
      </svg>
      <span className="font-bold tracking-tight text-lg">TongueSync AI</span>
    </div>
  );
}
