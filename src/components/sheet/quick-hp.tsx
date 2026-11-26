"use client";

import { type ActionDispatch, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PlayAction, PlayMessage } from "@/lib/play-reducer";

// Daño y curación rápidos desde la cabecera fija (ADR 0029): un botón abre
// una fila con la cantidad y dos botones. Lo demás (tipo de daño, crítico,
// PG temporales, descansos) sigue en el panel de partida, más abajo.
export function QuickHp({
  message,
  dispatch,
}: {
  message: PlayMessage | null;
  dispatch: ActionDispatch<[PlayAction]>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  // El mensaje se muestra solo si llegó después de usar esta fila: el de
  // otra acción de la hoja ya se ve en el panel de partida.
  const [sent, setSent] = useState(false);
  const inputId = useId();
  const rowId = useId();

  const send = (type: "damage" | "heal") => {
    // Vacío no es un número: se manda NaN y el motor lo rechaza con un aviso.
    const value = amount.trim() === "" ? NaN : Number(amount);
    dispatch({ type, amount: value });
    setAmount("");
    setSent(true);
  };

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={rowId}
        onClick={() => {
          setOpen(!open);
          setSent(false);
        }}
        className="grid size-10 shrink-0 place-items-center rounded-sm border border-border bg-card text-lg leading-none font-bold outline-ring hover:bg-muted focus-visible:outline-2"
      >
        <span aria-hidden="true">±</span>
        <span className="sr-only">
          {open ? "Cerrar daño y curación" : "Daño y curación rápidos"}
        </span>
      </button>
      {open && (
        <div id={rowId} className="col-span-full grid gap-1.5 pt-2">
          <div className="grid grid-cols-[minmax(0,5rem)_1fr_1fr] gap-1.5">
            <label htmlFor={inputId} className="sr-only">
              Cantidad de PG
            </label>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="PG"
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9 w-full min-w-0 rounded-lg border border-input bg-card px-2 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button
              variant="destructive"
              className="h-9"
              onClick={() => send("damage")}
            >
              Daño
            </Button>
            <Button
              variant="secondary"
              className="h-9"
              onClick={() => send("heal")}
            >
              Curar
            </Button>
          </div>
          <p
            role="status"
            aria-live="polite"
            className={
              message?.tone === "danger"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
            }
          >
            {sent && message ? message.text : ""}
          </p>
        </div>
      )}
    </>
  );
}
