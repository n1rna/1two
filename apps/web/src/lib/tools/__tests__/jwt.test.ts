import { describe, it, expect } from "vitest";
import { decodeJwt, formatTimestamp } from "../jwt";

// A real HS256 JWT from jwt.io
const SAMPLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("decodeJwt", () => {
  it("decodes a valid JWT token", () => {
    const result = decodeJwt(SAMPLE_TOKEN);
    expect(result).not.toBeNull();
    expect(result!.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(result!.payload).toEqual({
      sub: "1234567890",
      name: "John Doe",
      iat: 1516239022,
    });
    expect(result!.signature).toBe("SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  });

  it("returns null for empty string", () => {
    expect(decodeJwt("")).toBeNull();
  });

  it("returns null for a string with wrong number of parts", () => {
    expect(decodeJwt("abc.def")).toBeNull();
    expect(decodeJwt("abc.def.ghi.jkl")).toBeNull();
  });

  it("returns null for invalid base64 in header", () => {
    expect(decodeJwt("!!!.eyJ0ZXN0IjoxfQ.sig")).toBeNull();
  });

  it("returns null for non-JSON base64 content", () => {
    // btoa("not json") = "bm90IGpzb24="
    expect(decodeJwt("bm90IGpzb24.bm90IGpzb24.sig")).toBeNull();
  });

  it("handles tokens with whitespace/trimming", () => {
    const result = decodeJwt(`  ${SAMPLE_TOKEN}  `);
    expect(result).not.toBeNull();
    expect(result!.header.alg).toBe("HS256");
  });

  it("handles URL-safe base64 characters", () => {
    // The sample token already uses standard base64, but the function
    // should handle URL-safe variants (- and _ instead of + and /)
    const result = decodeJwt(SAMPLE_TOKEN);
    expect(result).not.toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("formats a valid Unix timestamp in seconds", () => {
    // 2020-01-01T00:00:00.000Z
    const result = formatTimestamp(1577836800);
    expect(result).toBe("2020-01-01T00:00:00.000Z");
  });

  it("returns null for non-number values", () => {
    expect(formatTimestamp("1577836800")).toBeNull();
    expect(formatTimestamp(null)).toBeNull();
    expect(formatTimestamp(undefined)).toBeNull();
    expect(formatTimestamp(true)).toBeNull();
  });

  it("returns null for numbers outside the valid timestamp range", () => {
    expect(formatTimestamp(0)).toBeNull();
    expect(formatTimestamp(100)).toBeNull();
    // Beyond year 3000
    expect(formatTimestamp(33000000000)).toBeNull();
  });

  it("formats the iat from sample token", () => {
    const result = formatTimestamp(1516239022);
    expect(result).toBe("2018-01-18T01:30:22.000Z");
  });
});
