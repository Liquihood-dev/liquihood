interface BeamDividerProps {
  className?: string;
  delay?: boolean;
}

export function BeamDivider({ className = "", delay = false }: BeamDividerProps) {
  return (
    <div
      className={`relative w-full h-px overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div className={`beam-comet ${delay ? "beam-comet-delay" : ""}`} />
    </div>
  );
}
