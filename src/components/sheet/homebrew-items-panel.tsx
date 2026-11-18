import Link from "next/link";

import { Button } from "@/components/ui/button";
import { type HomebrewItem, homebrewItemSummary } from "@/lib/homebrew";
import type { InventoryItem } from "@/rules-engine/schemas";

// Los objetos homebrew de este navegador, con un botón para dárselos al
// personaje o sacárselos (ADR 0019). Al darlo, el motor recalcula la hoja y
// el efecto (por ejemplo, +1 a la CA) se ve al instante arriba.
export function HomebrewItemsPanel({
  items,
  inventory,
  disabled,
  onGive,
  onTake,
}: {
  items: readonly HomebrewItem[];
  inventory: readonly InventoryItem[];
  // Mientras se lee lo guardado no se puede cambiar nada.
  disabled: boolean;
  onGive: (item: HomebrewItem) => void;
  onTake: (itemId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no creaste objetos homebrew.{" "}
        <Link href="/homebrew" className="underline underline-offset-4">
          Crear uno
        </Link>
      </p>
    );
  }

  const owned = new Set(inventory.map((entry) => entry.itemId));
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {items.map((item) => {
          const has = owned.has(item.id);
          return (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {homebrewItemSummary(item)}
                </span>
              </span>
              <Button
                size="sm"
                variant={has ? "outline" : "default"}
                disabled={disabled}
                aria-label={has ? `Quitar ${item.name}` : `Dar ${item.name}`}
                onClick={() => (has ? onTake(item.id) : onGive(item))}
              >
                {has ? "Quitar" : "Dar"}
              </Button>
            </li>
          );
        })}
      </ul>
      <Link
        href="/homebrew"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        Crear o editar objetos homebrew
      </Link>
    </div>
  );
}
