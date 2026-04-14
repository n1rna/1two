import { describe, it, expect } from "vitest";
import { formatJson, minifyJson, smartParseJson, buildJsonPath } from "../json";

describe("formatJson", () => {
  it("formats a minified JSON string with 2-space indent", () => {
    const input = '{"name":"John","age":30}';
    const result = formatJson(input, 2);
    expect(result).toBe('{\n  "name": "John",\n  "age": 30\n}');
  });

  it("formats with 4-space indent", () => {
    const input = '{"a":1}';
    const result = formatJson(input, 4);
    expect(result).toBe('{\n    "a": 1\n}');
  });

  it("handles nested objects", () => {
    const input = '{"a":{"b":{"c":1}}}';
    const result = formatJson(input, 2);
    expect(result).toContain('"c": 1');
    expect(result.split("\n").length).toBe(7);
  });

  it("handles arrays", () => {
    const input = "[1,2,3]";
    const result = formatJson(input, 2);
    expect(result).toBe("[\n  1,\n  2,\n  3\n]");
  });

  it("throws on invalid JSON", () => {
    expect(() => formatJson("{invalid}")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => formatJson("")).toThrow();
  });
});

describe("minifyJson", () => {
  it("minifies a formatted JSON string", () => {
    const input = '{\n  "name": "John",\n  "age": 30\n}';
    expect(minifyJson(input)).toBe('{"name":"John","age":30}');
  });

  it("minifies an already minified string (no-op)", () => {
    const input = '{"a":1}';
    expect(minifyJson(input)).toBe('{"a":1}');
  });

  it("throws on invalid JSON", () => {
    expect(() => minifyJson("not json")).toThrow();
  });
});

describe("smartParseJson", () => {
  it("parses valid JSON without corrections", () => {
    const result = smartParseJson('{"name": "John"}');
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ name: "John" });
    expect(result.corrected).toBeFalsy();
  });

  it("returns error for empty input", () => {
    const result = smartParseJson("");
    expect(result.valid).toBe(false);
    expect(result.error?.message).toBe("Empty input");
  });

  it("fixes single quotes", () => {
    const result = smartParseJson("{'name': 'John'}");
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ name: "John" });
    expect(result.corrected).toBe(true);
    expect(result.corrections).toContain("Replaced single quotes with double quotes");
  });

  it("fixes trailing commas", () => {
    const result = smartParseJson('{"a": 1, "b": 2,}');
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ a: 1, b: 2 });
    expect(result.corrected).toBe(true);
    expect(result.corrections).toContain("Removed trailing commas");
  });

  it("fixes trailing commas in arrays", () => {
    const result = smartParseJson("[1, 2, 3,]");
    expect(result.valid).toBe(true);
    expect(result.value).toEqual([1, 2, 3]);
    expect(result.corrected).toBe(true);
  });

  it("fixes unquoted keys", () => {
    const result = smartParseJson("{name: \"John\"}");
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ name: "John" });
    expect(result.corrected).toBe(true);
    expect(result.corrections).toContain("Added quotes around unquoted keys");
  });

  it("fixes escaped double quotes from copying", () => {
    const result = smartParseJson('{\\\"name\\\": \\\"John\\\"}');
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ name: "John" });
    expect(result.corrected).toBe(true);
  });

  it("fixes JSON wrapped in quotes", () => {
    const result = smartParseJson("'{\"name\": \"John\"}'");
    expect(result.valid).toBe(true);
    expect(result.value).toEqual({ name: "John" });
    expect(result.corrected).toBe(true);
    expect(result.corrections).toContain(
      "Removed wrapping quotes and unescaped content"
    );
  });

  it("returns formatted output", () => {
    const result = smartParseJson('{"a":1}');
    expect(result.formatted).toBe('{\n  "a": 1\n}');
  });

  it("reports error with position for truly invalid JSON", () => {
    const result = smartParseJson('{"a": }');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toBeTruthy();
  });

  it("handles nested structures", () => {
    const result = smartParseJson(
      '{"users": [{"name": "Alice"}, {"name": "Bob"}]}'
    );
    expect(result.valid).toBe(true);
    const val = result.value as { users: { name: string }[] };
    expect(val.users).toHaveLength(2);
    expect(val.users[0].name).toBe("Alice");
  });
});

describe("buildJsonPath", () => {
  it("returns $ for empty path", () => {
    expect(buildJsonPath([])).toBe("$");
  });

  it("builds path with simple keys", () => {
    expect(buildJsonPath(["users", "name"])).toBe("$.users.name");
  });

  it("builds path with array indices", () => {
    expect(buildJsonPath(["users", 0, "name"])).toBe("$.users[0].name");
  });

  it("brackets keys with special characters", () => {
    expect(buildJsonPath(["my key", "a.b"])).toBe('$["my key"]["a.b"]');
  });

  it("handles mixed paths", () => {
    expect(buildJsonPath(["data", 2, "items", 0, "value"])).toBe(
      "$.data[2].items[0].value"
    );
  });
});
