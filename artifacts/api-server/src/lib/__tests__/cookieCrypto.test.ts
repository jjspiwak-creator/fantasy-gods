process.env["SESSION_ENCRYPTION_KEY"] =
  "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encryptCookie, decryptCookie } from "../cookieCrypto.ts";

describe("cookieCrypto", () => {
  it("T1 round-trip: decryptCookie(encryptCookie(x)) === x", () => {
    const plain = "test-cookie-value-12345";
    const encrypted = encryptCookie(plain);
    const decrypted = decryptCookie(encrypted);
    assert.equal(decrypted, plain);
  });

  it("T2 unique IVs: two encryptCookie calls produce different strings", () => {
    const plain = "same-input";
    const a = encryptCookie(plain);
    const b = encryptCookie(plain);
    assert.notEqual(a, b);
  });

  it("T3 tamper: flip one ciphertext hex char → decryptCookie returns null", () => {
    const encrypted = encryptCookie("tamper-me");
    const parts = encrypted.split(":");
    const ciphertextHex = parts[3]!;
    const flipped =
      ciphertextHex[0] === "a"
        ? "b" + ciphertextHex.slice(1)
        : "a" + ciphertextHex.slice(1);
    parts[3] = flipped;
    const tampered = parts.join(":");
    assert.equal(decryptCookie(tampered), null);
  });

  it("T4 legacy/plaintext input returns null", () => {
    assert.equal(decryptCookie("raw-cookie-value"), null);
  });
});
