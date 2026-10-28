"use client";

import { type ActionDispatch, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlayAction } from "@/lib/play-reducer";
import type { ComputedSheet } from "@/rules-engine/engine";

const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const statusText = {
  dying: "Inconsciente: al empezar tu turno, tirá 1d20.",
  stable: "Estable con 0 PG: sigue inconsciente, sin tirar salvaciones.",
  dead: "El personaje está muerto.",
} as const;

// Tres casillas: llenas hasta `count`. Solo muestran; no se tocan a mano.
function Marks({
  label,
  count,
  filledClass,
}: {
  label: string;
  count: number;
  filledClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-sm text-muted-foreground">{label}</span>
      {/* El lector de pantalla lee "Éxitos: 2 de 3" en lugar de las casillas. */}
      <span className="sr-only">
        {label}: {count} de 3
      </span>
      <span aria-hidden className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`size-4 rounded-full border-2 ${
              i < count ? filledClass : "border-border bg-card"
            }`}
          />
        ))}
      </span>
    </div>
  );
}

// Salvaciones contra muerte: aparece solo con 0 PG o muerto. El jugador tira
// el d20 en la mesa y carga el resultado; el motor decide qué pasa (ADR 0010).
export function DeathSaves({
  deathSaves,
  dispatch,
}: {
  deathSaves: ComputedSheet["deathSaves"];
  dispatch: ActionDispatch<[PlayAction]>;
}) {
  const rollId = useId();
  const [roll, setRoll] = useState("");
  const { status, successes, failures } = deathSaves;
  if (status === "conscious") return null;

  return (
    <fieldset className="grid gap-2 rounded-sm border border-destructive/40 bg-destructive/5 p-3">
      <legend className="px-1 text-[0.7rem] font-semibold tracking-wider text-destructive uppercase">
        Salvaciones contra muerte
      </legend>
      <p className="text-sm">{statusText[status]}</p>
      <Marks
        label="Éxitos"
        count={successes}
        filledClass="border-success bg-success"
      />
      <Marks
        label="Fallos"
        count={failures}
        filledClass="border-destructive bg-destructive"
      />
      {status === "dying" && (
        <div className="grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1.5">
          <label htmlFor={rollId} className="sr-only">
            Resultado del d20
          </label>
          <input
            id={rollId}
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            placeholder="d20"
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
            className={inputClass}
          />
          <Button
            variant="secondary"
            onClick={() => {
              const value = roll.trim() === "" ? NaN : Number(roll);
              dispatch({ type: "death-save", roll: value });
              setRoll("");
            }}
          >
            Tirar salvación
          </Button>
          {/* Otro personaje superó Sabiduría (Medicina) CD 10. */}
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "stabilize" })}
          >
            Estabilizar
          </Button>
        </div>
      )}
    </fieldset>
  );
}
