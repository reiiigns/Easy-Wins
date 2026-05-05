import { useEffect, useState } from "react";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showPercent?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export default function ScoreRing({ score, size = 64, strokeWidth = 4, showPercent = false }: ScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const color = getScoreColor(score);
  const displayScore = Math.round(score);
  const label = showPercent ? `${displayScore}%` : `${displayScore}`;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 50);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--bg-elevated)"
        strokeWidth={strokeWidth}
      />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-800 ease-out"
      />
      {/* Score text */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="transform rotate-90"
        fill="var(--text-primary)"
        fontSize={showPercent ? Math.max(13, Math.round(size * 0.22)) : size === 64 ? 18 : size === 80 ? 22 : 16}
        fontWeight={700}
      >
        {label}
      </text>
    </svg>
  );
}
