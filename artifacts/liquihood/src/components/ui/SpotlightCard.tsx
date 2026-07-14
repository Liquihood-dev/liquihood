import { useRef } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SpotlightCard({
  children,
  className = "",
  style,
  onMouseMove: extOnMouseMove,
  onMouseLeave: extOnMouseLeave,
  ...rest
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const { left, top } = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - left}px`);
    el.style.setProperty("--y", `${e.clientY - top}px`);
    extOnMouseMove?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--x", "-200px");
    el.style.setProperty("--y", "-200px");
    extOnMouseLeave?.(e);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        background:
          "radial-gradient(240px at var(--x,-200px) var(--y,-200px), rgba(208,239,25,0.07), transparent 70%), #0A0A0A",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
