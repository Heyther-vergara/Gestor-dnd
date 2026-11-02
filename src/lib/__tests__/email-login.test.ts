import { describe, expect, it } from "vitest";

import {
  type EmailAuth,
  parseEmail,
  parseLoginCode,
  requestLoginCode,
} from "@/lib/email-login";

// Supabase falso: anota qué se llamó y deja elegir si el email ya tiene cuenta.
function fakeAuth(options: { anonymous: boolean; emailTaken?: boolean }) {
  const calls: string[] = [];
  const auth: EmailAuth = {
    async isAnonymous() {
      return options.anonymous;
    },
    async linkEmail(email) {
      calls.push(`link:${email}`);
      return options.emailTaken ? "email-taken" : "code-sent";
    },
    async sendSignInCode(email) {
      calls.push(`sign-in:${email}`);
    },
    async verifyCode(email, code, mode) {
      calls.push(`verify:${mode}:${email}:${code}`);
    },
  };
  return { auth, calls };
}

describe("requestLoginCode", () => {
  // El caso principal: la hoja anónima de este navegador pasa a la cuenta
  // porque el usuario sigue siendo el mismo (mismo id), solo gana un email.
  it("links the email to the anonymous user, keeping its sheet", async () => {
    const { auth, calls } = fakeAuth({ anonymous: true });
    expect(await requestLoginCode(auth, "julian@example.com")).toBe("link");
    expect(calls).toEqual(["link:julian@example.com"]);
  });

  // Otro dispositivo: el email ya es de una cuenta, así que se entra a ella.
  it("signs in to the existing account when the email is taken", async () => {
    const { auth, calls } = fakeAuth({ anonymous: true, emailTaken: true });
    expect(await requestLoginCode(auth, "julian@example.com")).toBe("sign-in");
    expect(calls).toEqual([
      "link:julian@example.com",
      "sign-in:julian@example.com",
    ]);
  });

  it("signs in directly when there is no anonymous user", async () => {
    const { auth, calls } = fakeAuth({ anonymous: false });
    expect(await requestLoginCode(auth, "julian@example.com")).toBe("sign-in");
    expect(calls).toEqual(["sign-in:julian@example.com"]);
  });
});

describe("parseEmail", () => {
  it("trims and lowercases a valid email", () => {
    expect(parseEmail("  Julian@Example.COM ")).toBe("julian@example.com");
  });

  it("rejects something that is not an email", () => {
    expect(parseEmail("julian")).toBeNull();
    expect(parseEmail("")).toBeNull();
  });
});

describe("parseLoginCode", () => {
  it("accepts the digits of the code, ignoring spaces", () => {
    expect(parseLoginCode(" 123 456 ")).toBe("123456");
  });

  it("rejects codes that are too short or have letters", () => {
    expect(parseLoginCode("12345")).toBeNull();
    expect(parseLoginCode("12a456")).toBeNull();
  });
});
