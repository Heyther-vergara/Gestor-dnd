"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Fieldset, Option } from "@/components/characters/choice-fields";
import { Button } from "@/components/ui/button";
import { toSavedCharacter, writeSavedCharacter } from "@/lib/character-storage";
import { loadAndSync } from "@/lib/character-sync";
import { abilityNames, contentName } from "@/lib/format";
import {
  applyLevelUp,
  emptyLevelUpDraft,
  hitPointGain,
  type ImprovementPlan,
  type LevelUpDraft,
  type LevelUpPlan,
  levelUpErrors,
  planLevelUp,
} from "@/lib/level-up";
import { srd2024Index } from "@/lib/srd-2024";
import { getCharacterStore } from "@/lib/supabase/character-store";
import { calculateSheet } from "@/rules-engine/engine";
import type { Ability, Character } from "@/rules-engine/schemas";

const ABILITIES = Object.keys(abilityNames) as Ability[];

type LoadState =
  | { status: "loading" }
  | { status: "found"; character: Character }
  | { status: "missing" };

// Pantalla de subir de nivel (ADR 0016). Las reglas están en `lib/level-up`:
// este componente busca el personaje guardado, muestra lo que trae el nivel,
// junta las elecciones y guarda el resultado.
export function LevelUpScreen({ characterId }: { characterId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let local: Storage;
    try {
      local = window.localStorage;
    } catch {
      queueMicrotask(() => setState({ status: "missing" }));
      return;
    }
    loadAndSync(local, getCharacterStore(), characterId)
      .then(({ character }) => {
        if (cancelled) return;
        setState(
          character ? { status: "found", character } : { status: "missing" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  if (state.status === "loading") {
    return (
      <p className="px-4 py-6 text-center text-muted-foreground" role="status">
        Cargando personaje…
      </p>
    );
  }
  if (state.status === "missing") {
    return (
      <div className="grid justify-items-center gap-4 px-4 py-16 text-center">
        <p>No encontramos este personaje.</p>
        <Button asChild variant="outline">
          <Link href="/characters">Volver a mis personajes</Link>
        </Button>
      </div>
    );
  }

  const check = planLevelUp(state.character, srd2024Index);
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5 px-4 py-6">
      <header className="grid gap-0.5">
        <h1 className="font-heading text-3xl leading-tight font-bold tracking-wide text-balance">
          Subir de nivel
        </h1>
        <p className="text-muted-foreground">{state.character.name}</p>
      </header>
      {check.ok ? (
        <LevelUpForm character={state.character} plan={check.plan} />
      ) : (
        <p>{check.reason}</p>
      )}
    </div>
  );
}

function LevelUpForm({
  character,
  plan,
}: {
  character: Character;
  plan: LevelUpPlan;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<LevelUpDraft>(emptyLevelUpDraft);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const errors = useMemo(
    () => levelUpErrors(character, plan, draft, srd2024Index),
    [character, plan, draft],
  );
  const gain = useMemo(
    () => hitPointGain(character, plan, draft, srd2024Index),
    [character, plan, draft],
  );
  const scores = useMemo(
    () => calculateSheet(character, srd2024Index).abilities,
    [character],
  );
  const cls = srd2024Index.get(plan.classId);
  const className = cls ? contentName(cls) : plan.classId;

  async function save() {
    const result = applyLevelUp(character, plan, draft, srd2024Index);
    if (!result.ok) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSaveError(false);
    // Igual que el creador: el mismo sobre (con fecha nueva) en el navegador
    // y en la nube. Al ser el más nuevo, la hoja lo elige al abrirse.
    const saved = toSavedCharacter(result.character);
    let savedSomewhere = false;
    try {
      writeSavedCharacter(window.localStorage, saved);
      savedSomewhere = true;
    } catch {
      // Navegador sin almacenamiento: queda la nube.
    }
    const store = getCharacterStore();
    if (store) {
      try {
        await store.save(saved);
        savedSomewhere = true;
      } catch {
        // Sin conexión: la copia del navegador se sube al abrir la hoja.
      }
    }
    if (!savedSomewhere) {
      setSaving(false);
      setSaveError(true);
      return;
    }
    router.push(`/characters/${character.id}`);
  }

  const setImprovement = (improvement: ImprovementPlan) =>
    setDraft((d) => ({ ...d, improvement }));

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className="grid gap-1 rounded-lg border border-border bg-card p-3">
        <h2 className="font-heading text-lg font-bold text-primary">
          {className} {plan.level}
        </h2>
        {/* SRD 5.2.1, "Subir de nivel": un dado de golpe más y los PG del
            valor fijo de la tabla (ADR 0016). */}
        <p>
          Puntos de golpe máximos <b className="tabular-nums">+{gain}</b> y un
          dado de golpe más.
        </p>
      </section>

      {plan.features.length > 0 && (
        <section className="grid gap-2">
          <h2 className="font-heading text-lg font-bold text-primary">
            Rasgos nuevos
          </h2>
          {plan.features.map((feature) => (
            <details
              key={feature.name}
              className="rounded-lg border border-border bg-card p-3"
            >
              <summary className="cursor-pointer font-medium">
                {feature.name}
              </summary>
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                {feature.description}
              </p>
            </details>
          ))}
        </section>
      )}

      {plan.subclassOptions.length > 0 && (
        <Fieldset legend="Elegí una subclase">
          {plan.subclassOptions.map((subclass) => (
            <Option
              key={subclass.id}
              type="radio"
              name="subclass"
              checked={draft.subclassId === subclass.id}
              onChange={() =>
                setDraft((d) => ({ ...d, subclassId: subclass.id }))
              }
              title={contentName(subclass)}
              detail={subclass.data.features
                .filter((f) => f.level <= plan.level)
                .map((f) => f.name)
                .join(" · ")}
            />
          ))}
          {showErrors && errors.subclass && (
            <p className="text-sm text-destructive">{errors.subclass}</p>
          )}
        </Fieldset>
      )}

      {plan.needsImprovement && (
        <ImprovementFields
          plan={draft.improvement}
          setPlan={setImprovement}
          scores={scores}
          error={showErrors ? errors.improvement : undefined}
        />
      )}

      <p
        className="min-h-5 text-sm text-destructive"
        role="alert"
        aria-live="assertive"
      >
        {saveError &&
          "No se pudo guardar el personaje. Probá de nuevo en un rato."}
      </p>

      <div className="flex justify-between gap-2">
        <Button asChild variant="outline">
          <Link href={`/characters/${character.id}`}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando…" : `Subir a nivel ${plan.level}`}
        </Button>
      </div>
    </form>
  );
}

// SRD 5.2.1, dote "Mejora de característica": +2 a una o +1 a dos.
function ImprovementFields({
  plan,
  setPlan,
  scores,
  error,
}: {
  plan: ImprovementPlan;
  setPlan: (plan: ImprovementPlan) => void;
  scores: Record<Ability, { score: number }>;
  error: string | undefined;
}) {
  const label = (a: Ability) => `${abilityNames[a].name} (${scores[a].score})`;
  return (
    <Fieldset
      legend="Mejora de característica"
      hint="Subí una característica en 2 o dos en 1. Ninguna puede pasar de 20."
    >
      <div className="grid grid-cols-2 gap-2">
        <Option
          type="radio"
          name="improvement-mode"
          checked={plan.mode === "plus-two"}
          onChange={() => setPlan({ mode: "plus-two", ability: null })}
          title="+2 a una"
        />
        <Option
          type="radio"
          name="improvement-mode"
          checked={plan.mode === "one-one"}
          onChange={() =>
            setPlan({ mode: "one-one", first: null, second: null })
          }
          title="+1 a dos"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ABILITIES.map((a) => {
          if (plan.mode === "plus-two") {
            return (
              <Option
                key={a}
                type="radio"
                name="improvement-ability"
                checked={plan.ability === a}
                disabled={scores[a].score >= 19}
                onChange={() => setPlan({ mode: "plus-two", ability: a })}
                title={label(a)}
              />
            );
          }
          const picked = [plan.first, plan.second].filter(
            (x): x is Ability => x !== null,
          );
          const checked = picked.includes(a);
          return (
            <Option
              key={a}
              type="checkbox"
              name="improvement-ability"
              checked={checked}
              disabled={
                (!checked && picked.length >= 2) || scores[a].score >= 20
              }
              onChange={() => {
                const next = checked
                  ? picked.filter((x) => x !== a)
                  : [...picked, a];
                setPlan({
                  mode: "one-one",
                  first: next[0] ?? null,
                  second: next[1] ?? null,
                });
              }}
              title={label(a)}
            />
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </Fieldset>
  );
}
