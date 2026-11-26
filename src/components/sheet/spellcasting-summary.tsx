import { SpellList } from "@/components/spells/spell-details";
import { abilityNames, formatModifier } from "@/lib/format";
import type { SpellcastingStats } from "@/rules-engine/engine";

// CD, ataque, espacios y conjuros de cada clase que lanza conjuros.
// SRD 5.2.1, tabla "Rasgos de mago", "Espacios de conjuro por cada nivel de
// conjuro". Contar los espacios gastados queda para la fase 5 (partida).
// Los trucos, los preparados y el libro son las listas del personaje (ADR
// 0021); se cambian con el panel de la hoja, no aquí.
export function SpellcastingSummary({
  spellcasting,
}: {
  spellcasting: SpellcastingStats[];
}) {
  return (
    <div className="grid gap-3">
      {spellcasting.map((stats) => (
        <div key={stats.classId} className="grid gap-2">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
            <span>
              Aptitud{" "}
              <b className="text-foreground">
                {abilityNames[stats.ability].name}
              </b>
            </span>
            <span>
              CD de salvación <b className="text-foreground">{stats.saveDc}</b>
            </span>
            <span>
              Ataque{" "}
              <b className="text-foreground">
                {formatModifier(stats.attackBonus)}
              </b>
            </span>
          </p>
          {stats.slots.length > 0 && (
            <div className="grid gap-1">
              <h3 className="font-medium">Espacios de conjuro</h3>
              {/* Un círculo por espacio, para verlos de un vistazo. Todavía
                  no se marcan como gastados (queda para más adelante). */}
              <dl className="grid gap-1">
                {stats.slots.map((count, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <dt className="w-16 text-muted-foreground">
                      Nivel {i + 1}
                    </dt>
                    <dd className="flex items-center gap-1.5">
                      <span className="sr-only">{count} espacios</span>
                      {Array.from({ length: count }, (_, slot) => (
                        <span
                          key={slot}
                          aria-hidden="true"
                          className="size-3.5 rounded-full border-2 border-gold bg-gold/80"
                        />
                      ))}
                      <span
                        aria-hidden="true"
                        className="ml-1 text-muted-foreground tabular-nums"
                      >
                        {count}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {stats.limits.cantrips > 0 && (
            <SpellList
              title="Trucos"
              spells={stats.cantrips}
              max={stats.limits.cantrips}
              empty="Todavía no elegiste trucos."
            />
          )}
          {stats.limits.prepared > 0 && (
            <SpellList
              title="Conjuros preparados"
              spells={stats.prepared}
              max={stats.limits.prepared}
              empty="Todavía no preparaste conjuros."
            />
          )}
          {stats.spellbook && (
            <SpellList
              title="Todos los conjuros del libro"
              spells={stats.spellbook}
              max={stats.limits.spellbook ?? undefined}
              empty="El libro está vacío."
            />
          )}
        </div>
      ))}
    </div>
  );
}
