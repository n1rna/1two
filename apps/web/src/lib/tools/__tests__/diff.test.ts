import { describe, it, expect } from "vitest";
import { computeDiff, getDiffStats } from "../diff";

describe("computeDiff", () => {
  it("returns equal lines for identical texts", () => {
    const diff = computeDiff("hello\nworld", "hello\nworld");
    expect(diff).toHaveLength(2);
    expect(diff[0]).toMatchObject({ text: "hello", type: "equal" });
    expect(diff[1]).toMatchObject({ text: "world", type: "equal" });
  });

  it("detects added lines", () => {
    const diff = computeDiff("a\nb", "a\nb\nc");
    const added = diff.filter((l) => l.type === "added");
    expect(added).toHaveLength(1);
    expect(added[0].text).toBe("c");
  });

  it("detects removed lines", () => {
    const diff = computeDiff("a\nb\nc", "a\nb");
    const removed = diff.filter((l) => l.type === "removed");
    expect(removed).toHaveLength(1);
    expect(removed[0].text).toBe("c");
  });

  it("detects changed lines", () => {
    const diff = computeDiff("a\nb\nc", "a\nB\nc");
    // b is removed, B is added
    expect(diff).toHaveLength(4);
    expect(diff.filter((l) => l.type === "removed")).toHaveLength(1);
    expect(diff.filter((l) => l.type === "added")).toHaveLength(1);
    expect(diff.filter((l) => l.type === "equal")).toHaveLength(2);
  });

  it("handles empty left text", () => {
    const diff = computeDiff("", "hello");
    expect(diff).toHaveLength(2);
    // empty string splits to [""], so removed empty + added "hello"
    const added = diff.filter((l) => l.type === "added");
    expect(added.some((l) => l.text === "hello")).toBe(true);
  });

  it("handles empty right text", () => {
    const diff = computeDiff("hello", "");
    const removed = diff.filter((l) => l.type === "removed");
    expect(removed.some((l) => l.text === "hello")).toBe(true);
  });

  it("handles both empty", () => {
    const diff = computeDiff("", "");
    expect(diff).toHaveLength(1);
    expect(diff[0].type).toBe("equal");
  });

  it("assigns correct line numbers", () => {
    const diff = computeDiff("a\nb\nc", "a\nX\nc");
    const equalA = diff.find((l) => l.text === "a");
    expect(equalA?.lineNumLeft).toBe(1);
    expect(equalA?.lineNumRight).toBe(1);

    const removed = diff.find((l) => l.type === "removed");
    expect(removed?.lineNumLeft).toBe(2);
    expect(removed?.lineNumRight).toBeUndefined();

    const added = diff.find((l) => l.type === "added");
    expect(added?.lineNumRight).toBe(2);
    expect(added?.lineNumLeft).toBeUndefined();
  });
});

describe("getDiffStats", () => {
  it("counts added, removed, and unchanged lines", () => {
    const diff = computeDiff("a\nb\nc", "a\nB\nc\nd");
    const stats = getDiffStats(diff);
    expect(stats.unchanged).toBe(2); // a, c
    expect(stats.removed).toBe(1); // b
    expect(stats.added).toBe(2); // B, d
  });

  it("returns zeros for identical texts", () => {
    const diff = computeDiff("a\nb", "a\nb");
    const stats = getDiffStats(diff);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
    expect(stats.unchanged).toBe(2);
  });
});
