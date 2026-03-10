import { describe, it, expect } from "vitest";
import { encodeBase64, decodeBase64 } from "../base64";

describe("encodeBase64", () => {
  it("encodes a simple string", () => {
    expect(encodeBase64("Hello, World!")).toBe("SGVsbG8sIFdvcmxkIQ==");
  });

  it("encodes an empty string", () => {
    expect(encodeBase64("")).toBe("");
  });

  it("encodes unicode characters", () => {
    const encoded = encodeBase64("Hello 🌍");
    const decoded = decodeBase64(encoded);
    expect(decoded).toBe("Hello 🌍");
  });

  it("produces URL-safe output when flag is set", () => {
    // btoa("n>~") = "bj5+" - contains +
    // btoa("n~?") = "bn4/" - contains /
    const standard1 = encodeBase64("n>~", false);
    expect(standard1).toContain("+");

    const urlSafe1 = encodeBase64("n>~", true);
    expect(urlSafe1).not.toContain("+");
    expect(urlSafe1).toContain("-");

    const standard2 = encodeBase64("n~?", false);
    expect(standard2).toContain("/");

    const urlSafe2 = encodeBase64("n~?", true);
    expect(urlSafe2).not.toContain("/");
    expect(urlSafe2).toContain("_");
  });
});

describe("decodeBase64", () => {
  it("decodes a simple string", () => {
    expect(decodeBase64("SGVsbG8sIFdvcmxkIQ==")).toBe("Hello, World!");
  });

  it("decodes an empty string", () => {
    expect(decodeBase64("")).toBe("");
  });

  it("handles whitespace in input", () => {
    expect(decodeBase64("  SGVsbG8sIFdvcmxkIQ==  ")).toBe("Hello, World!");
  });

  it("decodes URL-safe base64 when flag is set", () => {
    const original = "subjects?_d";
    const urlSafe = encodeBase64(original, true);
    expect(decodeBase64(urlSafe, true)).toBe(original);
  });

  it("throws on invalid base64", () => {
    expect(() => decodeBase64("not-valid-base64!@#$")).toThrow();
  });
});

describe("roundtrip", () => {
  const testStrings = [
    "Hello, World!",
    "",
    "Line 1\nLine 2\nLine 3",
    '{"key": "value", "number": 42}',
    "Special chars: <>&\"'",
    "Unicode: café résumé naïve",
  ];

  it.each(testStrings)("roundtrips %s (standard)", (input) => {
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  it.each(testStrings)("roundtrips %s (URL-safe)", (input) => {
    expect(decodeBase64(encodeBase64(input, true), true)).toBe(input);
  });
});
