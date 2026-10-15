import { z } from "zod";

// Identificador en kebab-case: "fighter", "magic-missile", "srd-2024".
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Debe estar en kebab-case");

export const editionSchema = z.enum(["2014", "2024"]);

// Los seis atributos, con abreviaturas en inglés como en el SRD.
export const abilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

// Las 18 habilidades del SRD.
export const skillSchema = z.enum([
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
]);

// SRD 5.2.1, "Cómo jugar", tabla "Habilidades": la característica que usa cada una.
export const skillAbilities = {
  acrobatics: "dex",
  "animal-handling": "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  "sleight-of-hand": "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<Skill, Ability>;

export type Slug = z.infer<typeof slugSchema>;
export type Edition = z.infer<typeof editionSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type Skill = z.infer<typeof skillSchema>;
