import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Provide a valid 64-char hex key for all tests
const TEST_KEY = "a".repeat(64);

beforeEach(() => {
  vi.stubEnv("ENCRYPTION_KEY", TEST_KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Dynamic import so the module picks up the stubbed env
async function getLib() {
  const mod = await import("@/lib/crypto");
  return mod;
}

describe("encrypt / decrypt round-trip", () => {
  it("decrypts back to the original plaintext", async () => {
    const { encrypt, decrypt } = await getLib();
    const plain = "hello world";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("encrypts empty string and decrypts it correctly", async () => {
    const { encrypt, decrypt } = await getLib();
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("handles long strings", async () => {
    const { encrypt, decrypt } = await getLib();
    const plain = "x".repeat(10_000);
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("handles special characters and unicode", async () => {
    const { encrypt, decrypt } = await getLib();
    const plain = "🔒 Pří job applicant <test> & \"data\"";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const { encrypt } = await getLib();
    const plain = "same input";
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it("throws if ENCRYPTION_KEY is missing", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "");
    const { encrypt } = await getLib();
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });

  it("throws if ENCRYPTION_KEY is wrong length", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "abcd1234");
    const { encrypt } = await getLib();
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY");
  });

  it("throws when decrypting tampered ciphertext", async () => {
    const { encrypt, decrypt } = await getLib();
    const enc = encrypt("valid plaintext");
    // Flip last character
    const tampered = enc.slice(0, -1) + (enc.at(-1) === "a" ? "b" : "a");
    expect(() => decrypt(tampered)).toThrow();
  });
});
