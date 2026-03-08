import { describe, it, expect } from "vitest";
import { tools, getToolBySlug, getToolsByCategory, searchTools } from "../registry";

describe("tools registry", () => {
  it("has unique slugs", () => {
    const slugs = tools.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all tools have required fields", () => {
    for (const tool of tools) {
      expect(tool.slug).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.icon).toBeTruthy();
      expect(tool.keywords.length).toBeGreaterThan(0);
    }
  });
});

describe("getToolBySlug", () => {
  it("finds a tool by slug", () => {
    const tool = getToolBySlug("jwt");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("JWT Parser");
  });

  it("returns undefined for unknown slug", () => {
    expect(getToolBySlug("nonexistent")).toBeUndefined();
  });
});

describe("getToolsByCategory", () => {
  it("groups tools by category", () => {
    const grouped = getToolsByCategory();
    expect(grouped.parsing).toBeDefined();
    expect(grouped.parsing.some((t) => t.slug === "jwt")).toBe(true);
    expect(grouped.encoding.some((t) => t.slug === "b64")).toBe(true);
  });
});

describe("searchTools", () => {
  it("finds tools by name", () => {
    const results = searchTools("jwt");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe("jwt");
  });

  it("finds tools by keyword", () => {
    const results = searchTools("bearer");
    expect(results.length).toBe(1);
    expect(results[0].slug).toBe("jwt");
  });

  it("finds tools by description", () => {
    const results = searchTools("beautify");
    expect(results.length).toBeGreaterThan(0);
  });

  it("returns empty for no match", () => {
    expect(searchTools("zzzznonexistent")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(searchTools("JWT").length).toBe(searchTools("jwt").length);
  });
});
