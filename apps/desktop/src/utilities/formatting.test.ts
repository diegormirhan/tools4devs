import { describe, expect, it } from "vitest";
import { formatCss, formatHtml, minifyCss, minifyHtml } from "./formatting";

describe("CSS minifying", () => {
  it("strips comments and collapses whitespace", () => {
    const input = `
      /* header */
      .card {
        color: red;
        padding: 4px 8px;
      }
    `;
    expect(minifyCss(input)).toBe(".card{color:red;padding:4px 8px}");
  });
});

describe("CSS formatting", () => {
  it("puts each declaration on its own indented line", () => {
    const result = formatCss(".card{color:red;padding:4px}");
    expect(result).toBe(".card {\n  color:red;\n  padding:4px;\n}");
  });

  it("indents a nested rule one level deeper", () => {
    const result = formatCss("@media (min-width: 600px){.card{color:red}}");
    const lines = result.split("\n");
    expect(lines[0]).toBe("@media (min-width: 600px) {");
    expect(lines[1]).toBe("  .card {");
    expect(lines[2]).toBe("    color:red;");
    expect(lines[3]).toBe("  }");
    expect(lines[4]).toBe("}");
  });
});

describe("HTML minifying", () => {
  it("strips comments and the whitespace between tags", () => {
    const input = "<div>\n  <!-- note -->\n  <p>Hello</p>\n</div>";
    expect(minifyHtml(input)).toBe("<div><p>Hello</p></div>");
  });

  it("never touches whitespace inside a <pre> block", () => {
    const input = "<pre>\n  line one\n    line two\n</pre>";
    expect(minifyHtml(input)).toBe(input.trim());
  });

  it("never touches whitespace inside a <script> block", () => {
    const input = "<script>\n  if (a) {\n    b();\n  }\n</script>";
    expect(minifyHtml(input)).toContain("if (a) {\n    b();\n  }");
  });

  it("collapses runs of internal whitespace in ordinary text", () => {
    expect(minifyHtml("<p>a   b\n\nc</p>")).toBe("<p>a b c</p>");
  });
});

describe("HTML formatting", () => {
  it("indents a child one level deeper than its parent", () => {
    const result = formatHtml("<div><p>Hello</p></div>", {});
    expect(result).toBe("<div>\n  <p>\n    Hello\n  </p>\n</div>");
  });

  it("does not indent past a void element", () => {
    const result = formatHtml("<div><img src=\"x.png\"><p>text</p></div>", {});
    const lines = result.split("\n");
    expect(lines[1]).toBe('  <img src="x.png" />');
    expect(lines[2]).toBe("  <p>");
  });

  it("does not indent past a self-closing tag", () => {
    const result = formatHtml('<svg><path d="M0 0" /></svg>', {});
    expect(result.split("\n")[1]).toBe('  <path d="M0 0" />');
  });

  it("keeps a <pre> block's own content untouched", () => {
    const result = formatHtml("<div><pre>  keep\n  this</pre></div>", {});
    expect(result).toContain("  keep\n  this");
  });

  it("uses the requested indent width", () => {
    const result = formatHtml("<div><p>x</p></div>", { indent: "4" });
    expect(result.split("\n")[1]).toBe('    <p>');
  });

  it("uses tabs when asked to", () => {
    const result = formatHtml("<div><p>x</p></div>", { indent: "tabs" });
    expect(result.split("\n")[1]).toBe("\t<p>");
  });
});

describe("round trips", () => {
  it("minifying what formatCss produced is still valid, equivalent CSS", () => {
    const original = ".a{color:red;padding:4px 8px}.b{color:blue}";
    expect(minifyCss(formatCss(original))).toBe(
      ".a{color:red;padding:4px 8px}.b{color:blue}",
    );
  });

  it("minifying what formatHtml produced keeps the same tags and text", () => {
    const original = "<div><p>Hello</p><span>World</span></div>";
    expect(minifyHtml(formatHtml(original, {}))).toBe(original);
  });
});
