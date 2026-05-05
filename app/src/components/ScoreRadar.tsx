import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { Scores } from "../types/report";

interface ScoreRadarProps {
  scores: Scores;
}

export default function ScoreRadar({ scores }: ScoreRadarProps) {
  const data = [
    { subject: "Core", label: "Core functionality", A: scores.coreFunctionality, fullMark: 100 },
    { subject: "UI/UX", label: "UI/UX polish", A: scores.uiUxPolish, fullMark: 100 },
    { subject: "Quality", label: "Code quality", A: scores.codeQuality, fullMark: 100 },
    { subject: "Stability", label: "Stability and bugs", A: scores.stabilityBugs, fullMark: 100 },
    { subject: "Perf", label: "Performance", A: scores.performance, fullMark: 100 },
    { subject: "Docs", label: "Documentation", A: scores.documentation, fullMark: 100 },
    { subject: "Deploy", label: "Deployment readiness", A: scores.deploymentReadiness, fullMark: 100 },
  ];

  return (
    <figure aria-label="Score overview by category">
      <div aria-hidden="true">
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
      </div>
      <figcaption className="sr-only">
        Score overview: {data.map(item => `${item.label} ${item.A} out of 100`).join(", ")}.
      </figcaption>
    </figure>
  );
}
