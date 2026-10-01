import { describe, expect, it } from "vitest";
import {
  affixLines,
  bionicReading,
  changeCase,
  countText,
  findAndReplace,
  loremIpsum,
  numberLines,
  randomInteger,
  removeDuplicateLines,
  reverseText,
  shuffleLines,
  slugify,
  sortLines,
  tidyWhitespace,
  upsideDown,
} from "./text";

describe("changing case", () => {
  it("capitalises every word for a title, and only sentences for a sentence", () => {
    expect(changeCase("the tool that works", { case: "title" })).toBe("The Tool That Works");
    expect(changeCase("first one. second one!  third", { case: "sentence" })).toBe(
      "First one. Second one!  Third",
    );
  });
});

describe("reversing", () => {
  it("reverses each line without moving the lines", () => {
    expect(reverseText("abc\ndef", { scope: "lines" })).toBe("cba\nfed");
  });

  it("reverses everything when asked, lines included", () => {
    expect(reverseText("ab\ncd", { scope: "whole" })).toBe("dc\nba");
  });

  it("flips letters that have an upside-down shape and leaves the rest", () => {
    expect(upsideDown("hello!")).toBe("¡ollǝɥ");
  });
});

describe("lines", () => {
  it("keeps the first of each duplicate", () => {
    expect(removeDuplicateLines("a\nb\na\nc\nb", {})).toBe("a\nb\nc");
  });

  it("can ignore case and surrounding spaces when comparing", () => {
    expect(removeDuplicateLines("Sim\n sim \nnão", { caseSensitive: "no", trim: "yes" })).toBe(
      "Sim\nnão",
    );
  });

  it("sorts in the reader's alphabet, not by code point", () => {
    // Á sorts beside A rather than after Z, which is where a byte comparison
    // would put it.
    expect(sortLines("zebra\nÁrvore\nabelha", {})).toBe("abelha\nÁrvore\nzebra");
    expect(sortLines("a\nb", { order: "descending" })).toBe("b\na");
  });

  it("shuffles without losing or inventing a line", () => {
    const lines = Array.from({ length: 50 }, (_, index) => `line ${index}`);
    const shuffled = shuffleLines(lines.join("\n")).split("\n");
    expect(shuffled.slice().sort()).toEqual(lines.slice().sort());
    // A shuffle that returns the input is possible but not fifty lines' worth.
    expect(shuffled.join("\n")).not.toBe(lines.join("\n"));
  });

  it("numbers lines with the numbers aligned", () => {
    const numbered = numberLines(Array.from({ length: 10 }, () => "x").join("\n"), {});
    expect(numbered.split("\n")[0]).toBe(" 1. x");
    expect(numbered.split("\n")[9]).toBe("10. x");
  });

  it("puts a prefix and a suffix on each line, leaving blank ones alone", () => {
    expect(affixLines("a\n\nb", { prefix: "- ", suffix: ";" })).toBe("- a;\n\n- b;");
  });
});

describe("find and replace", () => {
  it("replaces every occurrence, not just the first", () => {
    expect(findAndReplace("a.a.a", { find: ".", replace: "-" })).toBe("a-a-a");
  });

  it("treats the search as text unless a pattern is asked for", () => {
    // "." is every character to a regular expression, and a full stop here.
    expect(findAndReplace("a.b", { find: ".", replace: "!", regex: "yes" })).toBe("!!!");
  });

  it("can ignore case", () => {
    expect(findAndReplace("Rua rua RUA", { find: "rua", replace: "av", caseSensitive: "no" })).toBe(
      "av av av",
    );
  });

  it("returns the text untouched when there is nothing to find", () => {
    expect(findAndReplace("unchanged", { find: "", replace: "x" })).toBe("unchanged");
  });
});

describe("whitespace", () => {
  it("collapses runs of spaces and trims each line", () => {
    expect(tidyWhitespace("  a    b  \n   c ", {})).toBe("a b\nc");
  });

  it("does what was asked with blank lines", () => {
    expect(tidyWhitespace("a\n\n\n\nb", { blankLines: "collapse" })).toBe("a\n\nb");
    expect(tidyWhitespace("a\n\n\n\nb", { blankLines: "remove" })).toBe("a\nb");
  });
});

describe("counting", () => {
  it("counts an emoji as one character", () => {
    const counted = countText("hi 👋");
    expect(counted.characters).toBe(4);
    expect(counted.words).toBe(2);
  });

  it("counts lines, paragraphs and sentences", () => {
    const counted = countText("One. Two!\n\nThird paragraph here");
    expect(counted.lines).toBe(3);
    expect(counted.paragraphs).toBe(2);
    expect(counted.sentences).toBe(3);
  });

  it("says nothing is there when nothing is", () => {
    expect(countText("")).toMatchObject({ characters: 0, words: 0, lines: 0, readingMinutes: 0 });
  });
});

describe("slugs", () => {
  it("drops accents and punctuation", () => {
    expect(slugify("Ação Rápida: 10 Coisas!", {})).toBe("acao-rapida-10-coisas");
  });

  it("uses the separator asked for, and never doubles it", () => {
    expect(slugify("a -- b", { separator: "underscore" })).toBe("a_b");
  });
});

describe("lorem ipsum", () => {
  it("refuses to generate a novel", () => {
    expect(loremIpsum({ count: "9999", unit: "sentences" }).split(". ").length).toBeLessThanOrEqual(200);
  });
});

describe("the random source", () => {
  it("stays inside the bound and reaches both ends", () => {
    const seen = new Set<number>();
    for (let attempt = 0; attempt < 400; attempt += 1) seen.add(randomInteger(4));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("has nothing to pick from a bound of zero", () => {
    expect(randomInteger(0)).toBe(0);
  });
});

describe("bionic reading", () => {
  it("bolds the leading part of each word", () => {
    expect(bionicReading("reading")).toBe("𝐫𝐞𝐚ding");
  });

  it("bolds at least one letter of a short word", () => {
    expect(bionicReading("a")).toBe("𝐚");
  });

  it("leaves punctuation and spacing untouched", () => {
    expect(bionicReading("hi, there!")).toContain(", ");
  });
});
