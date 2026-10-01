import { describe, expect, it } from "vitest";
import { avatarColor, initials, nextMessageId } from "./mockup";

describe("message ids", () => {
  it("gives every message a different id", () => {
    const ids = new Set(Array.from({ length: 20 }, () => nextMessageId()));
    expect(ids.size).toBe(20);
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Maria Silva")).toBe("MS");
  });

  it("takes one letter for a single word", () => {
    expect(initials("Maria")).toBe("M");
  });

  it("has a fallback for an empty name", () => {
    expect(initials("")).toBe("?");
    expect(initials("   ")).toBe("?");
  });

  it("upper-cases even a lowercase name", () => {
    expect(initials("maria silva")).toBe("MS");
  });
});

describe("avatar colour", () => {
  it("gives the same name the same colour every time", () => {
    expect(avatarColor("Maria Silva")).toBe(avatarColor("Maria Silva"));
  });

  it("gives different names a real chance at different colours", () => {
    const colors = new Set(["Ana", "Bruno", "Carlos", "Diana", "Elis", "Felipe", "Gustavo"].map(avatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it("always returns one of the palette's own colours", () => {
    expect(avatarColor("anyone")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
