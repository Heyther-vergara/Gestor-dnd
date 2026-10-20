import { cn } from "@/lib/utils";

// Marca de competencia: círculo dorado lleno si sos competente, vacío si no.
// Pericia (doble competencia) se marca con un anillo extra.
export function ProficiencyDot({
  level,
}: {
  level: "none" | "proficient" | "expertise";
}) {
  const label =
    level === "expertise"
      ? "Pericia"
      : level === "proficient"
        ? "Competente"
        : "Sin competencia";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full border-[1.5px] border-gold",
        level !== "none" && "bg-gold",
        level === "expertise" &&
          "ring-2 ring-gold/40 ring-offset-1 ring-offset-card",
      )}
    />
  );
}
