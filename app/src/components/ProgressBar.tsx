import { useEffect, useState, useRef } from "react";

interface ProgressBarProps {
  value: number;
  label?: string;
  height?: number;
  className?: string;
  animated?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export default function ProgressBar({ value, label = "Progress", height = 8, className = "", animated = true }: ProgressBarProps) {
  const normalizedValue = Math.max(0, Math.min(100, Math.round(value)));
  const [width, setWidth] = useState(animated ? 0 : normalizedValue);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!animated) return;

    const timer = setTimeout(() => {
      hasAnimated.current = true;
      setWidth(normalizedValue);
    }, hasAnimated.current ? 0 : 50);

    return () => clearTimeout(timer);
  }, [normalizedValue, animated]);

  const displayWidth = animated ? width : normalizedValue;
  const color = getScoreColor(normalizedValue);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalizedValue}
      className={`w-full rounded-full ${className}`}
      style={{ height, backgroundColor: "var(--bg-elevated)" }}
    >
      <div
        aria-hidden="true"
        className="h-full rounded-full transition-all duration-600 ease-out"
        style={{ width: `${displayWidth}%`, backgroundColor: color }}
      />
    </div>
  );
}
