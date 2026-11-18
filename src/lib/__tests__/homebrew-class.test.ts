import { describe, expect, it } from "vitest";

import type { KeyValueStorage } from "@/lib/character-storage";
import { withHomebrew } from "@/lib/homebrew";
import { parseClassFile, removeClass, upsertClass } from "@/lib/homebrew-class";
import {
  homebrewContentFrom,
  loadHomebrew,
  newHomebrewLibrary,
  saveHomebrew,
} from "@/lib/homebrew-storage";
import { srd2024Index } from "@/lib/srd-2024";

import { PACKAGE_ID, tinkererFile } from "./homebrew-class-fixture";

const text = (value: unknown) => JSON.stringify(value);
const parse = (value: unknown, existing = srd2024Index) =>
  parseClassFile(text(value), PACKAGE_ID, existing);

describe("parseClassFile", () => {
  it("reads the class and its subclasses into the homebrew package", () => {
    const result = parse(tinkererFile);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.parsed.cls).toMatchObject({
      id: "tinkerer",
      packageId: PACKAGE_ID,
      type: "class",
    });
    expect(result.parsed.subclasses.map((s) => s.packageId)).toEqual([
      PACKAGE_ID,
    ]);
  });

  it("rejects text that is not JSON", () => {
    expect(parseClassFile("{nope", PACKAGE_ID, srd2024Index)).toEqual({
      ok: false,
      errors: ["El archivo no es un JSON válido."],
    });
  });

  it("rejects a JSON file that is not a homebrew class", () => {
    const result = parse({ hello: "world" });
    expect(result.ok).toBe(false);
  });

  it("explains what is wrong inside the class", () => {
    const broken = structuredClone(tinkererFile);
    broken.class.data.hitDie = 7;
    const result = parse(broken);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/^Clase \(data\.hitDie\)/);
  });

  it("rejects a subclass of another class", () => {
    const wrong = structuredClone(tinkererFile);
    const [sub] = wrong.subclasses;
    if (sub) sub.data.classId = "wizard";
    const result = parse(wrong);
    expect(result).toEqual({
      ok: false,
      errors: ['La subclase "Relojero" es de "wizard", no de "tinkerer".'],
    });
  });

  // Un homebrew no puede pisar contenido del SRD.
  it("rejects an id already used by the SRD", () => {
    const clash = structuredClone(tinkererFile);
    clash.class.id = "wizard";
    const [sub] = clash.subclasses;
    if (sub) sub.data.classId = "wizard";
    const result = parse(clash);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'El id "wizard" ya lo usa "Wizard". Cambialo.',
    );
  });

  // Volver a importar el mismo archivo actualiza la clase.
  it("accepts the same class again from the same package", () => {
    const first = parse(tinkererFile);
    if (!first.ok) throw new Error(first.errors.join(" "));
    const index = withHomebrew(srd2024Index, [
      first.parsed.cls,
      ...first.parsed.subclasses,
    ]);
    expect(parse(tinkererFile, index).ok).toBe(true);
  });
});

describe("homebrew classes in the library", () => {
  const parsed = (() => {
    const result = parse(tinkererFile);
    if (!result.ok) throw new Error(result.errors.join(" "));
    return result.parsed;
  })();

  it("replaces a class and its subclasses when imported again", () => {
    const once = upsertClass([], parsed);
    const twice = upsertClass(once, parsed);
    expect(twice.map((c) => c.id)).toEqual(["tinkerer", "clockmaker"]);
  });

  it("removes a class with its subclasses", () => {
    expect(removeClass(upsertClass([], parsed), "tinkerer")).toEqual([]);
  });

  it("saves and loads classes with the items", () => {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key),
    };
    const library = {
      ...newHomebrewLibrary("abc123"),
      classes: upsertClass([], parsed),
    };
    saveHomebrew(storage, library);
    const loaded = loadHomebrew(storage);
    expect(loaded.status === "loaded" && loaded.library.classes).toEqual(
      library.classes,
    );
    expect(homebrewContentFrom(storage).map((c) => c.id)).toEqual([
      "tinkerer",
      "clockmaker",
    ]);
  });
});
