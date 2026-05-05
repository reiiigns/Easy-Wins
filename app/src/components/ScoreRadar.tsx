import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { Scores } from "../types/report";

interface ScoreRadarProps {
  scores: Scores;
}

export default function ScoreRadar({ scores }: ScoreRadarProps) {
  const data = [
    { subject: "Core", A: scores.coreFunctionality, fullMark: 100 },
    { subject: "UI/UX", A: scores.uiUxPolish, fullMark: 100 },
    { subject: "Quality", A: scores.codeQuality, fullMark: 100 },
    { subject: "Stability", A: scores.stabilityBugs, fullMark: 100 },
    { subject: "Perf", A: scores.performance, fullMark: 100 },
    { subject: "Docs", A: scores.documentation, fullMark: 100 },
    { subject: "Deploy", A: scores.deploymentReadiness, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--border-subtle)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
        />
        <Radar
          name="Scores"
          dataKey="A"
          stroke="var(--accent-blue)"
          fill="var(--accent-blue)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
