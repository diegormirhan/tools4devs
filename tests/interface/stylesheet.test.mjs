import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const stylesheet = readFileSync(
  fileURLToPath(new URL("../../apps/desktop/src/styles/app.css", import.meta.url)),
  "utf8",
);

test("never writes a vendor prefix by hand", () => {
  // The minifier adds whatever prefix this WebView needs. Writing one by hand
  // makes it collapse the pair down to the prefixed declaration alone, which
  // Chromium then does not apply at all -- which is how the modal quietly
  // stopped blurring its background in a release build while dev looked right.
  const handWritten = stylesheet
    .split("\n")
    .map((line, index) => [index + 1, line.trim()])
    .filter(([, line]) => /^-(webkit|moz|ms|o)-/.test(line));

  assert.deepEqual(handWritten, []);
});

test("never hardcodes a colour outside a mockup", () => {
  // theme.css owns every colour; a hex here means a rule that does not follow
  // the theme. The one deliberate exception is a mockup: a WhatsApp bubble has
  // to be WhatsApp green and a tweet's card has to be Twitter's own off-white,
  // whichever theme the app
  // itself is in, the same way a flag does not recolour for dark mode. That
  // exemption has to track which rule a line is *inside*, not just whether
  // the selector's own text sits on the same line — a multi-line rule's
  // declarations do not repeat it.
  const body = stylesheet;
  let insideMockupPhone = false;
  let depth = 0;
  const literals = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!insideMockupPhone && (line.includes(".mockup-phone") || line.includes(".mockup-post")) && line.includes("{")) {
      insideMockupPhone = true;
      depth = 0;
    }
    if (insideMockupPhone) {
      depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      if (depth <= 0) insideMockupPhone = false;
      continue;
    }
    if (/#[0-9a-f]{3,8}\b/i.test(line) && !line.startsWith("/*")) literals.push(line);
  }

  assert.deepEqual(literals, []);
});
