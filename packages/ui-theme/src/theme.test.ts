import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const source = async (file: string) =>
  readFile(new URL(file, import.meta.url), "utf8");

describe("ui theme contract", () => {
  it("exports the shared semantic tokens needed by TV and controller", async () => {
    const css = await source("./tokens.css");
    for (const token of [
      "--os-color-canvas",
      "--os-color-surface",
      "--os-color-primary",
      "--os-color-budget",
      "--os-color-drunkenness",
      "--os-color-dignity",
      "--os-font-display",
      "--os-space-4",
      "--os-radius-md",
      "--os-texture-parchment",
    ]) {
      expect(css).toContain(token);
    }
  });

  it("keeps the comic burst opt-in and motion accessible", async () => {
    const css = await source("./components.css");
    expect(css).toContain(".os-event-burst");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/\.os-event-burst\s*\{\s*animation: none;/);
  });

  it("uses only local CSS textures and font fallbacks", async () => {
    const css = `${await source("./tokens.css")}\n${await source("./components.css")}`;
    expect(css).not.toMatch(/url\s*\(/i);
    expect(css).not.toMatch(/@font-face/i);
    expect(css).toContain("radial-gradient");
  });
});
