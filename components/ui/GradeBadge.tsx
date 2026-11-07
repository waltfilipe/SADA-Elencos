import { letterGradePillColor } from "@/lib/gradeColors";

type Props = {
  letter: string | null | undefined;
  displayScore?: number | null;
  size?: "sm" | "md" | "lg";
};

export function GradeBadge({ letter, displayScore, size = "md" }: Props) {
  const l = letter ?? "—";
  const bg = letterGradePillColor(letter, displayScore);
  return (
    <span
      className={`grade-badge grade-badge-${size}`}
      style={{ color: "#f8fafc", background: bg, borderColor: `${bg}88` }}
    >
      {l}
    </span>
  );
}
