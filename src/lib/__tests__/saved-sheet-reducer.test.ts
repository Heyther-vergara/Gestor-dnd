import { describe, expect, it } from "vitest";

import { sampleCharacter } from "@/lib/sample-character";
import {
  createSavedSheetReducer,
  initialSavedSheetState,
} from "@/lib/saved-sheet-reducer";
import { srd2024Index } from "@/lib/srd-2024";

const reducer = createSavedSheetReducer(srd2024Index);
const start = initialSavedSheetState(sampleCharacter);

describe("saved sheet reducer", () => {
  it("starts loading, with the initial character", () => {
    expect(start.saveStatus).toBe("loading");
    expect(start.session.character).toBe(sampleCharacter);
  });

  it("replaces the character with the saved one when loading finishes", () => {
    const saved = {
      ...sampleCharacter,
      playState: { ...sampleCharacter.playState, damageTaken: 25 },
    };
    const next = reducer(start, { type: "storage-loaded", character: saved });
    expect(next.saveStatus).toBe("saved");
    expect(next.session.character).toBe(saved);
  });

  it("keeps the initial character when nothing was saved", () => {
    const next = reducer(start, { type: "storage-loaded", character: null });
    expect(next.saveStatus).toBe("saved");
    expect(next.session.character).toBe(sampleCharacter);
  });

  it("marks storage as unavailable without touching the character", () => {
    const next = reducer(start, { type: "storage-failed" });
    expect(next.saveStatus).toBe("unavailable");
    expect(next.session).toBe(start.session);
  });

  it("passes play actions to the play reducer and keeps the save status", () => {
    const loaded = reducer(start, { type: "storage-loaded", character: null });
    const next = reducer(loaded, { type: "damage", amount: 5 });
    expect(next.saveStatus).toBe("saved");
    expect(next.session.character.playState.damageTaken).toBe(
      sampleCharacter.playState.damageTaken + 5,
    );
  });
});
