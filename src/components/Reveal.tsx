import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: keyof HTMLElementTagNameMap;
};

export function Reveal({ children, delay = 0, className = "", as = "div" }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const Tag = as as any;
  return (
    <Tag
      ref={ref as any}
      style={{ transitionDelay: `${delay}ms` }}
      className={
        `transition-all duration-700 ease-out will-change-transform ` +
        (visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6") +
        (className ? " " + className : "")
      }
    >
      {children}
    </Tag>
  );
}