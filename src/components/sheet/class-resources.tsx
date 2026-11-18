"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ClassResourceStats } from "@/rules-engine/engine";

const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// Recursos de clase con usos contados (ADR 0020), como los Puntos de
// Catalizador. Muestra cuántos quedan y deja gastar; se recuperan con el
// descanso largo del panel de partida. Las reglas (límite por uso, no gastar
// de más) las aplica el motor.
export function ClassResources({
  resources,
  disabled,
  onSpend,
}: {
  resources: readonly ClassResourceStats[];
  disabled?: boolean;
  onSpend: (resourceId: string, amount: number) => void;
}) {
  return (
    <ul className="grid gap-2">
      {resources.map((resource) => (
        <ResourceRow
          key={resource.id}
          resource={resource}
          disabled={disabled}
          onSpend={(amount) => onSpend(resource.id, amount)}
        />
      ))}
    </ul>
  );
}

function ResourceRow({
  resource,
  disabled,
  onSpend,
}: {
  resource: ClassResourceStats;
  disabled?: boolean;
  onSpend: (amount: number) => void;
}) {
  const inputId = useId();
  const [amount, setAmount] = useState("1");
  const { name, remaining, max, perUseLimit } = resource;

  return (
    <li className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-heading text-lg font-bold">{name}</span>
        <span className="text-sm text-muted-foreground tabular-nums">
          <b className="font-heading text-xl text-foreground">{remaining}</b> de{" "}
          {max}
          {perUseLimit !== undefined && ` · hasta ${perUseLimit} por acción`}
        </span>
      </p>
      <div className="grid grid-cols-[auto_4.5rem_1fr] items-center gap-2">
        <label htmlFor={inputId} className="text-sm text-muted-foreground">
          Cantidad
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={perUseLimit ?? max}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
        <Button
          variant="secondary"
          aria-label={`Gastar ${name}`}
          disabled={disabled || remaining === 0}
          // Un campo vacío no es un número: NaN, y el motor lo rechaza.
          onClick={() =>
            onSpend(amount.trim() === "" ? Number.NaN : Number(amount))
          }
        >
          Gastar
        </Button>
      </div>
    </li>
  );
}
