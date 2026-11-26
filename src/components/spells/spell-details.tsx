import { plainText, spellComponentsText, spellSummary } from "@/lib/format";
import type { SpellContent } from "@/rules-engine/engine";

// Los datos y el texto de un conjuro (ADR 0021). Nombre y texto son los del
// SRD 5.2.1 en español (ADR 0031), con distancias en metros como el libro.
export function SpellBody({ spell }: { spell: SpellContent }) {
  const { castingTime, range, duration } = spell.data;
  return (
    <div className="grid gap-2 text-sm text-muted-foreground">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt>Tiempo de lanzamiento</dt>
        <dd className="text-foreground">{castingTime}</dd>
        <dt>Alcance</dt>
        <dd className="text-foreground">{range}</dd>
        <dt>Componentes</dt>
        <dd className="text-foreground">{spellComponentsText(spell)}</dd>
        <dt>Duración</dt>
        <dd className="text-foreground">{duration}</dd>
      </dl>
      <p className="whitespace-pre-line">{plainText(spell.description)}</p>
    </div>
  );
}

// Un conjuro que se abre al tocarlo, para que la hoja no sea larguísima en
// el celular (como los rasgos).
export function SpellDetails({ spell }: { spell: SpellContent }) {
  return (
    <details className="rounded-lg border border-border bg-card p-3">
      <summary className="cursor-pointer">
        <span className="font-medium">{spell.name}</span>{" "}
        <span className="text-sm text-muted-foreground">
          · {spellSummary(spell)}
        </span>
      </summary>
      <div className="mt-2">
        <SpellBody spell={spell} />
      </div>
    </details>
  );
}

// Una lista de conjuros con título y "2 de 4". Vacía, avisa con `empty`.
export function SpellList({
  title,
  spells,
  max,
  empty,
}: {
  title: string;
  spells: readonly SpellContent[];
  max?: number;
  empty: string;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="font-medium">
        {title}
        {max !== undefined && (
          <span className="text-sm font-normal text-muted-foreground tabular-nums">
            {" "}
            · {spells.length} de {max}
          </span>
        )}
      </h3>
      {spells.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {spells.map((spell) => (
            <li key={spell.id}>
              <SpellDetails spell={spell} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
