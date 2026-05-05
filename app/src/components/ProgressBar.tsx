import { useEffect, useState, useRef } from "react";

interface ProgressBarProps {
  value: number;
  height?: number;
  className?: string;
  animated?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export default function ProgressBar({ value, height = 8, className = "", animated = true }: ProgressBarProps) {
  const [width, setWidth] = useState(animated ? 0 : value);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!animated) return;

    const timer = setTimeout(() => {
      hasAnimated.current = true;
      setWidth(value);
    }, hasAnimated.current ? 0 : 50);

    return () => clearTimeout(timer);
  }, [value, animated]);

  const displayWidth = animated ? width : value;
  const color = getScoreColor(value);

  return (
    <div
      className={`w-full rounded-full ${className}`}
      style={{ height, backgroundColor: "var(--bg-elevated)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-600 ease-out"
        style={{ width: `${displayWidth}%`, backgroundColor: color }}
      />
    </div>
  );
}
