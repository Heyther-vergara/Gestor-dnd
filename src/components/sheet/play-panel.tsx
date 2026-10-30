"use client";

import { type ActionDispatch, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { damageTypeNames } from "@/lib/format";
import type { PlayAction, PlayMessage } from "@/lib/play-reducer";
import type { ComputedSheet, HitDie } from "@/rules-engine/engine";
import { type DamageType, damageTypeSchema } from "@/rules-engine/schemas";

import { DeathSaves } from "./death-saves";

const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// Los tipos de daño en orden alfabético en español, para el selector.
const damageTypes = [...damageTypeSchema.options].sort((a, b) =>
  damageTypeNames[a].localeCompare(damageTypeNames[b], "es"),
);

// Un campo vacío o con texto no es un número: se manda NaN y el motor lo rechaza.
const toNumber = (value: string) => (value.trim() === "" ? NaN : Number(value));

// Controles de partida: daño, curación, PG temporales, descansos y
// salvaciones contra muerte. Solo
// manda acciones; qué pasa con cada una lo decide el motor.
export function PlayPanel({
  hitDice,
  deathSaves,
  message,
  dispatch,
}: {
  hitDice: ComputedSheet["hitDice"];
  deathSaves: ComputedSheet["deathSaves"];
  message: PlayMessage | null;
  dispatch: ActionDispatch<[PlayAction]>;
}) {
  const ids = {
    amount: useId(),
    critical: useId(),
    damageType: useId(),
    die: useId(),
    roll: useId(),
  };
  const [amount, setAmount] = useState("");
  const [critical, setCritical] = useState(false);
  // "" = sin tipo: el daño se aplica tal cual, sin resistencias.
  const [damageType, setDamageType] = useState<DamageType | "">("");
  const [roll, setRoll] = useState("");

  const availableDice = (
    Object.entries(hitDice.byDie) as [HitDie, { remaining: number }][]
  ).filter(([, count]) => count.remaining > 0);
  const [chosenDie, setChosenDie] = useState<HitDie | undefined>();
  // Si el dado elegido se agotó, se pasa al primero que quede.
  const die = availableDice.some(([d]) => d === chosenDie)
    ? chosenDie
    : availableDice[0]?.[0];

  const sendAmount = (type: "damage" | "heal" | "temp-hp") => {
    if (type === "damage") {
      dispatch({
        type,
        amount: toNumber(amount),
        critical,
        damageType: damageType || undefined,
      });
      setCritical(false);
    } else {
      dispatch({ type, amount: toNumber(amount) });
    }
    setAmount("");
  };

  return (
    <div className="grid gap-3 rounded-sm border border-border bg-card p-3">
      <DeathSaves deathSaves={deathSaves} dispatch={dispatch} />
      <div className="grid gap-1.5">
        <label
          htmlFor={ids.amount}
          className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase"
        >
          Cantidad
        </label>
        <div className="grid grid-cols-[4.5rem_1fr_1fr_1fr] gap-1.5">
          <input
            id={ids.amount}
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
          <Button variant="destructive" onClick={() => sendAmount("damage")}>
            Daño
          </Button>
          <Button variant="secondary" onClick={() => sendAmount("heal")}>
            Curar
          </Button>
          <Button variant="outline" onClick={() => sendAmount("temp-hp")}>
            PG temp.
          </Button>
        </div>
        {/* Con tipo, el motor aplica resistencias, vulnerabilidades e inmunidades. */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-2">
          <label
            htmlFor={ids.damageType}
            className="text-sm text-muted-foreground"
          >
            Tipo de daño
          </label>
          <select
            id={ids.damageType}
            value={damageType}
            onChange={(e) => setDamageType(e.target.value as DamageType | "")}
            className={inputClass}
          >
            <option value="">Sin tipo</option>
            {damageTypes.map((type) => (
              <option key={type} value={type}>
                {damageTypeNames[type]}
              </option>
            ))}
          </select>
        </div>
        {/* Solo cambia algo con 0 PG: un crítico cuenta como dos fallos. */}
        <label
          htmlFor={ids.critical}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <input
            id={ids.critical}
            type="checkbox"
            checked={critical}
            onChange={(e) => setCritical(e.target.checked)}
            className="size-4 accent-primary"
          />
          El daño es de un golpe crítico
        </label>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Descanso corto: gastar dado de golpe
        </legend>
        {die ? (
          <div className="grid grid-cols-[5.75rem_4.5rem_1fr] items-center gap-1.5">
            <label htmlFor={ids.die} className="sr-only">
              Dado
            </label>
            <select
              id={ids.die}
              value={die}
              onChange={(e) => setChosenDie(e.target.value as HitDie)}
              className={inputClass}
            >
              {availableDice.map(([d, count]) => (
                <option key={d} value={d}>
                  {d} ({count.remaining})
                </option>
              ))}
            </select>
            <label htmlFor={ids.roll} className="sr-only">
              Resultado de la tirada
            </label>
            <input
              id={ids.roll}
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Tirada"
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
              className={inputClass}
            />
            <Button
              variant="secondary"
              onClick={() => {
                dispatch({ type: "spend-hit-die", die, roll: toNumber(roll) });
                setRoll("");
              }}
            >
              Gastar dado
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No te quedan dados de golpe.
          </p>
        )}
      </fieldset>

      <Button variant="outline" onClick={() => dispatch({ type: "long-rest" })}>
        Descanso largo
      </Button>

      {/* aria-live: el lector de pantalla anuncia el resultado de cada acción. */}
      <p
        aria-live="polite"
        className={
          message?.tone === "danger"
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {message?.text}
      </p>
    </div>
  );
}
