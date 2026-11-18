"use client";

import { useEffect, useState } from "react";

import { HomebrewItemForm } from "@/components/homebrew/homebrew-item-form";
import { Button } from "@/components/ui/button";
import {
  type HomebrewItem,
  homebrewItemSummary,
  randomSuffix,
} from "@/lib/homebrew";
import {
  type HomebrewLibrary,
  loadHomebrew,
  newHomebrewLibrary,
  removeItem,
  saveHomebrew,
  upsertItem,
} from "@/lib/homebrew-storage";

type State =
  | { status: "loading" }
  // `library` es null si todavía no hay nada guardado: el paquete se crea
  // con el primer objeto.
  | { status: "ready"; library: HomebrewLibrary | null }
  // Lo guardado no se pudo leer: no se deja guardar para no pisarlo.
  | { status: "invalid" }
  | { status: "unavailable" };

// "Mis objetos homebrew" (ADR 0019): crear, editar y borrar objetos. Es un
// Client Component porque todo vive en el navegador (localStorage).
export function HomebrewManager() {
  const [state, setState] = useState<State>({ status: "loading" });
  // El objeto que se está editando, o null si el formulario crea uno nuevo.
  const [editing, setEditing] = useState<HomebrewItem | null>(null);
  // Cambia cada vez que se guarda, para vaciar el formulario.
  const [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<string | null>(null);
  // El paquete que se usa si todavía no hay nada guardado. Se arma una sola
  // vez para que su id no cambie en cada render.
  const [freshLibrary] = useState(() => newHomebrewLibrary(randomSuffix()));

  useEffect(() => {
    let next: State;
    try {
      const result = loadHomebrew(window.localStorage);
      next =
        result.status === "invalid"
          ? { status: "invalid" }
          : {
              status: "ready",
              library: result.status === "loaded" ? result.library : null,
            };
    } catch {
      next = { status: "unavailable" };
    }
    // El efecto corre después del render: acá sí se puede cambiar el estado.
    queueMicrotask(() => setState(next));
  }, []);

  // Guarda en el navegador y, si salió bien, actualiza la pantalla.
  function store(library: HomebrewLibrary): boolean {
    try {
      saveHomebrew(window.localStorage, library);
    } catch {
      return false;
    }
    setState({ status: "ready", library });
    return true;
  }

  if (state.status === "loading") {
    return (
      <p className="text-muted-foreground" role="status">
        Buscando tus objetos…
      </p>
    );
  }
  if (state.status === "unavailable") {
    return (
      <p className="text-muted-foreground" role="status">
        Este navegador no permite guardar, así que no se pueden crear objetos.
      </p>
    );
  }
  if (state.status === "invalid") {
    return (
      <p className="text-destructive" role="alert">
        No se pudo leer el homebrew guardado en este navegador. Para no
        perderlo, no se puede guardar nada nuevo.
      </p>
    );
  }

  const library = state.library ?? freshLibrary;

  function handleSave(item: HomebrewItem): boolean {
    const ok = store(upsertItem(library, item));
    if (ok) {
      setSaved(
        editing
          ? `Se guardaron los cambios de ${item.name}.`
          : `Se creó ${item.name}.`,
      );
      setEditing(null);
      setFormKey((k) => k + 1);
    }
    return ok;
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="homebrew-form" className="grid gap-3">
        <h2
          id="homebrew-form"
          className="font-heading text-xl font-bold text-primary"
        >
          {editing ? `Editar ${editing.name}` : "Crear objeto"}
        </h2>
        <HomebrewItemForm
          key={editing ? `edit-${editing.id}` : `new-${formKey}`}
          packageId={library.package.id}
          editing={editing}
          onSave={handleSave}
          onCancel={editing ? () => setEditing(null) : undefined}
        />
        <p className="text-sm text-primary" role="status" aria-live="polite">
          {saved}
        </p>
      </section>

      <section aria-labelledby="homebrew-list" className="grid gap-3">
        <h2
          id="homebrew-list"
          className="font-heading text-xl font-bold text-primary"
        >
          Mis objetos
        </h2>
        {library.items.length === 0 ? (
          <p className="text-muted-foreground">
            Todavía no hay objetos. Creá el primero con el formulario.
          </p>
        ) : (
          <ul className="grid gap-2">
            {library.items.map((item) => (
              <HomebrewItemRow
                key={item.id}
                item={item}
                onEdit={() => {
                  setSaved(null);
                  setEditing(item);
                }}
                onDelete={() => {
                  if (editing?.id === item.id) setEditing(null);
                  return store(removeItem(library, item.id));
                }}
              />
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Para usar un objeto, abrí la hoja de un personaje y tocá “Dar” en
          “Objetos homebrew”. Se guardan solo en este navegador.
        </p>
      </section>
    </div>
  );
}

// Una fila con su confirmación para borrar, como en "Mis personajes"
// (ADR 0018): en la misma fila y sin `confirm()` del navegador.
function HomebrewItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: HomebrewItem;
  onEdit: () => void;
  onDelete: () => boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <li className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-heading text-lg font-bold">{item.name}</span>
          <span className="text-sm text-muted-foreground">
            {homebrewItemSummary(item)}
          </span>
        </span>
        {!confirming && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              aria-label={`Editar ${item.name}`}
            >
              Editar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
              aria-label={`Borrar ${item.name}`}
            >
              Borrar
            </Button>
          </>
        )}
      </div>
      {confirming && (
        <div
          role="group"
          aria-label={`Confirmar borrado de ${item.name}`}
          className="grid gap-2 border-t border-border pt-2"
        >
          <p className="text-sm">
            ¿Borrar <strong>{item.name}</strong>? Los personajes que lo tengan
            dejan de recibir su efecto.
          </p>
          {failed && (
            <p className="text-sm text-destructive" role="alert">
              No se pudo borrar. Probá de nuevo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setFailed(!onDelete())}
            >
              Sí, borrar
            </Button>
            <Button
              // El foco pasa a la opción segura al abrir la confirmación.
              autoFocus
              variant="outline"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
