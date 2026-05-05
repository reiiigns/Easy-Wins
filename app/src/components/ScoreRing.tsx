import { useEffect, useState } from "react";

interface ScoreRingProps {
  score: number;
  label?: string;
  size?: number;
  strokeWidth?: number;
  showPercent?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export default function ScoreRing({ score, label = "Score", size = 64, strokeWidth = 4, showPercent = false }: ScoreRingProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const color = getScoreColor(normalizedScore);
  const displayScore = normalizedScore;
  const displayLabel = showPercent ? `${displayScore}%` : `${displayScore}`;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(normalizedScore), 50);
    return () => clearTimeout(timer);
  }, [normalizedScore]);

  return (
    <svg
      width={size}
      height={size}
      role="img"
      aria-label={`${label}: ${displayScore} out of 100`}
      className="transform -rotate-90"
    >
      <title>{`${label}: ${displayScore} out of 100`}</title>
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
        {displayLabel}
      </text>
    </svg>
  );
}
