// ADR 0024 (SOC 2 CC6.6 · ISO 27001 A.8.26): cabeceras de seguridad HTTP.
import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  supabaseOrigin,
} from "@/lib/security-headers";

const SUPABASE_URL = "https://abcdefgh.supabase.co";

describe("supabaseOrigin", () => {
  it("keeps only the https origin", () => {
    expect(supabaseOrigin(`${SUPABASE_URL}/rest/v1`)).toBe(SUPABASE_URL);
  });

  it("ignores a missing, invalid or plain http URL", () => {
    expect(supabaseOrigin(undefined)).toBeNull();
    expect(supabaseOrigin("not a url")).toBeNull();
    expect(supabaseOrigin("http://abcdefgh.supabase.co")).toBeNull();
  });
});

describe("buildContentSecurityPolicy", () => {
  const prod = buildContentSecurityPolicy({
    supabaseUrl: SUPABASE_URL,
    isDev: false,
  });

  it("lets the app talk only to itself and Supabase", () => {
    expect(prod).toContain(`connect-src 'self' ${SUPABASE_URL}`);
    expect(prod).toContain("default-src 'self'");
  });

  it("blocks framing, plugins and foreign form targets", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("base-uri 'self'");
  });

  it("does not allow eval in production, only in development", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).toContain("upgrade-insecure-requests");
    const dev = buildContentSecurityPolicy({
      supabaseUrl: SUPABASE_URL,
      isDev: true,
    });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("without Supabase, the app only connects to itself", () => {
    expect(
      buildContentSecurityPolicy({ supabaseUrl: undefined, isDev: false }),
    ).toContain("connect-src 'self';");
  });
});

describe("buildSecurityHeaders", () => {
  it("sends the expected headers", () => {
    const headers = buildSecurityHeaders({
      supabaseUrl: SUPABASE_URL,
      isDev: false,
    });
    expect(headers.map((h) => h.key)).toEqual([
      "Content-Security-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
    expect(headers.find((h) => h.key === "X-Content-Type-Options")?.value).toBe(
      "nosniff",
    );
  });
});
