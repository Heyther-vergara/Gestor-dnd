import type { ArmorPenalties } from "@/rules-engine/engine";

// ADR 0007: consecuencias de la armadura que no cambian un número de la hoja.
const messages: Record<keyof ArmorPenalties, string> = {
  untrainedArmor:
    "Armadura sin entrenamiento: desventaja en pruebas de Fuerza y Destreza, y no podés lanzar conjuros.",
  untrainedShield: "Escudo sin entrenamiento: no suma a la CA.",
  insufficientStrength: "Fuerza insuficiente para la armadura: velocidad −3 m.",
};

export function ArmorWarnings({ penalties }: { penalties: ArmorPenalties }) {
  const active = (Object.keys(messages) as (keyof ArmorPenalties)[]).filter(
    (key) => penalties[key],
  );
  if (active.length === 0) return null;
  return (
    <ul className="grid gap-1 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      {active.map((key) => (
        <li key={key}>{messages[key]}</li>
      ))}
    </ul>
  );
}
