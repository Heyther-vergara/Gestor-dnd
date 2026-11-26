import { describe, expect, it } from "vitest";

import { supabaseProjectUrl } from "@/lib/supabase/project-url";

const BASE = "https://abcdefghijklmnop.supabase.co";

describe("supabaseProjectUrl", () => {
  it("keeps a base URL as it is", () => {
    expect(supabaseProjectUrl(BASE)).toBe(BASE);
  });

  // Pasó en Vercel el 2026-11-26: el login con Google iba a
  // `…/rest/v1/auth/v1/authorize` y Supabase respondía "No API key found".
  it("drops the REST path, a trailing slash and spaces", () => {
    expect(supabaseProjectUrl(`${BASE}/rest/v1/`)).toBe(BASE);
    expect(supabaseProjectUrl(`${BASE}/`)).toBe(BASE);
    expect(supabaseProjectUrl(`  ${BASE}  `)).toBe(BASE);
  });

  it("allows a local Supabase over http", () => {
    expect(supabaseProjectUrl("http://127.0.0.1:54321")).toBe(
      "http://127.0.0.1:54321",
    );
  });

  it("returns null when missing or not a web URL", () => {
    expect(supabaseProjectUrl(undefined)).toBeNull();
    expect(supabaseProjectUrl("")).toBeNull();
    expect(supabaseProjectUrl("no es una url")).toBeNull();
    expect(supabaseProjectUrl("ftp://abcdefghijklmnop.supabase.co")).toBeNull();
  });
});
