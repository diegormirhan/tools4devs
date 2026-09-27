/**
 * CSS and HTML minifying and formatting.
 *
 * No JavaScript minifier here: a regex pass over CSS or HTML can be made
 * safe by working outside string/comment boundaries it understands
 * completely, but JavaScript's grammar (regex literals that look like
 * division, template strings, ASI) has enough sharp edges that a
 * hand-rolled pass risks silently producing something that runs
 * differently from what was typed in — the one failure mode worse than
 * this tool not existing at all.
 */

import type { Options } from "./text";

// ── CSS ─────────────────────────────────────────────────────────────────

export function minifyCss(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "") // comments
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}") // the last declaration needs no trailing semicolon
    .replace(/}\s*/g, "}")
    .trim();
}

export function formatCss(text: string): string {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines: string[] = [];
  let depth = 0;
  let buffer = "";
  // Character by character rather than split-by-delimiter: a selector and a
  // declaration both end in a plain word up to a delimiter, and the only way
  // to tell which one just finished is to still be holding it when the `{`,
  // `;` or `}` that ends it arrives, instead of deciding beforehand.
  for (const character of withoutComments) {
    if (character === "{") {
      const selector = buffer.trim();
      if (selector) lines.push(`${"  ".repeat(depth)}${selector} {`);
      depth += 1;
      buffer = "";
    } else if (character === ";" || character === "}") {
      const declaration = buffer.trim();
      if (declaration) lines.push(`${"  ".repeat(depth)}${declaration};`);
      buffer = "";
      if (character === "}") {
        depth = Math.max(0, depth - 1);
        lines.push(`${"  ".repeat(depth)}}`);
      }
    } else {
      buffer += character;
    }
  }
  return lines.join("\n");
}

// ── HTML ────────────────────────────────────────────────────────────────

/** Tags whose content is never touched: whitespace there is meaningful. */
const RAW_TEXT_TAGS = new Set(["pre", "script", "style", "textarea"]);
const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

export function minifyHtml(text: string): string {
  let result = text.replace(/<!--[\s\S]*?-->/g, "");
  // Protect raw-text elements before collapsing whitespace elsewhere, so a
  // script or a <pre> block never has its own content touched. The marker
  // is a token that cannot occur inside HTML text on its own (angle
  // brackets are always the start of a tag or an entity), so it survives
  // every whitespace pass below undisturbed and unambiguous — a bare
  // number would not have been: any real digits already in the page could
  // collide with it.
  const protectedBlocks: string[] = [];
  result = result.replace(
    /<(pre|script|style|textarea)([^>]*)>([\s\S]*?)<\/\1>/gi,
    (whole) => {
      protectedBlocks.push(whole);
      return `<!--tools4devs:${protectedBlocks.length - 1}-->`;
    },
  );
  result = result
    .replace(/>\s+</g, "><")
    .replace(/[ \t\n\r]+/g, " ")
    // A space right after an opening tag or right before a closing one is
    // indentation that leaked in, not a word boundary the page renders — the
    // collapse above already treats the space *between* two tags the same
    // way, so this is the same rule applied to a tag's own edges.
    .replace(/>\s+/g, ">")
    .replace(/\s+</g, "<")
    .trim();
  result = result.replace(
    /<!--tools4devs:(\d+)-->/g,
    (_, index: string) => protectedBlocks[Number(index)]!,
  );
  return result;
}

export function formatHtml(text: string, options: Options): string {
  const indentUnit = options.indent === "tabs" ? "\t" : " ".repeat(Number(options.indent ?? "2") || 2);
  const withoutComments = text.replace(/<!--[\s\S]*?-->/g, "").trim();

  const lines: string[] = [];
  let depth = 0;
  let cursor = 0;
  const tagPattern = /<\/?([a-zA-Z][\w-]*)([^>]*?)\/?>/g;

  while (cursor < withoutComments.length) {
    tagPattern.lastIndex = cursor;
    const match = tagPattern.exec(withoutComments);
    if (!match) {
      const rest = withoutComments.slice(cursor).trim();
      if (rest) lines.push(`${indentUnit.repeat(depth)}${rest}`);
      break;
    }

    const before = withoutComments.slice(cursor, match.index).trim();
    if (before) lines.push(`${indentUnit.repeat(depth)}${before}`);

    const [whole, name = ""] = match;
    // The lazy `[^>]*?` before an optional `/` can pull that slash's own
    // leading whitespace into the capture, which is why this is trimmed
    // rather than used as `match[2]` directly.
    const attributes = (match[2] ?? "").trim();
    const isClosing = whole.startsWith("</");
    const isSelfClosing = whole.endsWith("/>") || VOID_TAGS.has(name.toLowerCase());

    if (isClosing) {
      depth = Math.max(0, depth - 1);
      lines.push(`${indentUnit.repeat(depth)}${whole}`);
    } else {
      const attributeText = attributes ? ` ${attributes}` : "";
      lines.push(`${indentUnit.repeat(depth)}<${name}${attributeText}${isSelfClosing ? " />" : ">"}`);
      if (!isSelfClosing) {
        if (RAW_TEXT_TAGS.has(name.toLowerCase())) {
          const closeTag = `</${name}>`;
          const closeIndex = withoutComments.indexOf(closeTag, tagPattern.lastIndex);
          const inner = withoutComments.slice(tagPattern.lastIndex, closeIndex < 0 ? undefined : closeIndex);
          if (inner.trim()) lines.push(inner);
          lines.push(`${indentUnit.repeat(depth)}${closeTag}`);
          cursor = closeIndex < 0 ? withoutComments.length : closeIndex + closeTag.length;
          tagPattern.lastIndex = cursor;
          continue;
        }
        depth += 1;
      }
    }
    cursor = tagPattern.lastIndex;
  }

  return lines.join("\n");
}
