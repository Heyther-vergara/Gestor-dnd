// Clases homebrew importadas desde un archivo JSON (ADR 0020).
//
// Una clase tiene demasiados datos para un formulario (rasgos por nivel,
// tablas, subclases), así que se escribe en un archivo y se importa. El
// archivo puede quedar solo en la compu del usuario: así se usa contenido de
// terceros sin publicarlo en el repositorio.
//
// Como con los objetos (ADR 0019), la clase no es un caso especial: se valida
// con el mismo `contentSchema` que el SRD y el motor la trata igual.

import { z } from "zod";

import type { ContentIndex } from "@/rules-engine/engine";
import { type Content, contentSchema } from "@/rules-engine/schemas";

export type HomebrewClass = Extract<Content, { type: "class" }>;
export type HomebrewSubclass = Extract<Content, { type: "subclass" }>;
export type HomebrewClassContent = HomebrewClass | HomebrewSubclass;

export const HOMEBREW_CLASS_FORMAT = "gestor-dnd/homebrew-class";

// El sobre del archivo. La clase y las subclases se validan después, con el
// esquema de contenido, una vez que se les pone el paquete homebrew.
const classFileSchema = z.strictObject({
  format: z.literal(HOMEBREW_CLASS_FORMAT),
  version: z.literal(1),
  class: z.record(z.string(), z.unknown()),
  subclasses: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type ParsedClassFile = {
  cls: HomebrewClass;
  subclasses: HomebrewSubclass[];
};

export type ParseClassFileResult =
  { ok: true; parsed: ParsedClassFile } | { ok: false; errors: string[] };

// Muestra pocos errores: si el archivo está muy mal, con los primeros alcanza.
const MAX_ERRORS = 5;

const issuesToText = (prefix: string, error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `${prefix}${path ? ` (${path})` : ""}: ${issue.message}`;
  });

// Del texto del archivo a la clase y sus subclases, ya validadas y dentro del
// paquete homebrew `packageId`. `existing` es el contenido que ya hay (SRD y
// otro homebrew): un id repetido pisaría otra cosa, salvo que sea la misma
// clase que se vuelve a importar para actualizarla.
export function parseClassFile(
  text: string,
  packageId: string,
  existing: ContentIndex,
): ParseClassFileResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["El archivo no es un JSON válido."] };
  }
  const envelope = classFileSchema.safeParse(json);
  if (!envelope.success) {
    return {
      ok: false,
      errors: [
        `El archivo no es una clase homebrew (tiene que tener "format": "${HOMEBREW_CLASS_FORMAT}", "version": 1 y "class").`,
      ],
    };
  }

  const errors: string[] = [];
  const cls = contentSchema.safeParse({
    ...envelope.data.class,
    packageId,
  });
  if (!cls.success) errors.push(...issuesToText("Clase", cls.error));
  else if (cls.data.type !== "class") {
    errors.push('La clase tiene que tener "type": "class".');
  }

  const subclasses: HomebrewSubclass[] = [];
  for (const [i, raw] of envelope.data.subclasses.entries()) {
    const sub = contentSchema.safeParse({ ...raw, packageId });
    if (!sub.success) {
      errors.push(...issuesToText(`Subclase ${i + 1}`, sub.error));
    } else if (sub.data.type !== "subclass") {
      errors.push(`La subclase ${i + 1} tiene que tener "type": "subclass".`);
    } else {
      subclasses.push(sub.data);
    }
  }
  if (errors.length > 0 || !cls.success || cls.data.type !== "class") {
    return { ok: false, errors: errors.slice(0, MAX_ERRORS) };
  }
  const clsData = cls.data;

  for (const sub of subclasses) {
    if (sub.data.classId !== clsData.id) {
      errors.push(
        `La subclase "${sub.name}" es de "${sub.data.classId}", no de "${clsData.id}".`,
      );
    }
  }

  // Ids repetidos dentro del archivo o con contenido que ya existe.
  const ids = [clsData.id, ...subclasses.map((s) => s.id)];
  if (new Set(ids).size !== ids.length) {
    errors.push("Hay dos cosas con el mismo id en el archivo.");
  }
  for (const id of ids) {
    const other = existing.get(id);
    const sameClass =
      other !== undefined &&
      other.packageId === packageId &&
      (other.id === clsData.id ||
        (other.type === "subclass" && other.data.classId === clsData.id));
    if (other !== undefined && !sameClass) {
      errors.push(`El id "${id}" ya lo usa "${other.name}". Cámbialo.`);
    }
  }

  const resourceIds = clsData.data.resources.map((r) => r.id);
  if (new Set(resourceIds).size !== resourceIds.length) {
    errors.push("Hay dos recursos con el mismo id.");
  }

  if (errors.length > 0)
    return { ok: false, errors: errors.slice(0, MAX_ERRORS) };
  return { ok: true, parsed: { cls: clsData, subclasses } };
}

// Agrega la clase importada, o la reemplaza (con sus subclases) si ya estaba:
// volver a importar el archivo es la forma de actualizarla.
export function upsertClass(
  classes: readonly HomebrewClassContent[],
  { cls, subclasses }: ParsedClassFile,
): HomebrewClassContent[] {
  return [...removeClass(classes, cls.id), cls, ...subclasses];
}

// Saca la clase y sus subclases.
export function removeClass(
  classes: readonly HomebrewClassContent[],
  classId: string,
): HomebrewClassContent[] {
  return classes.filter(
    (c) =>
      c.id !== classId &&
      !(c.type === "subclass" && c.data.classId === classId),
  );
}
