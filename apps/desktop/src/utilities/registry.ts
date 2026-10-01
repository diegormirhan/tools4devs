import {
  Calculator,
  Calendar,
  Code,
  Dices,
  FlaskConical,
  Globe,
  Hash,
  Paintbrush,
  Palette,
  QrCode,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import * as text from "./text";
import type { Options } from "./text";
import type { Translate } from "../i18n/language";
import type { Preview } from "./css";
import type { ToolPreview } from "../catalog/catalog";
import * as codes from "./codes";
import * as dates from "./dates";
import * as math from "./math";
import * as generators from "./generators";
import * as colors from "./colors";
import * as misc from "./misc";
import * as css from "./css";
import * as network from "./network";
import * as formatting from "./formatting";
import * as qr from "./qrbarcode";
import * as random from "./random";

/**
 * The tools the app performs itself.
 *
 * Everything in here is a pure function of a string and some options. There is
 * no binary to download, no process to supervise and no file on disk: the work
 * is small enough that a panel can do it as you type. That is a different kind
 * of tool from the rest of the catalog, so it gets its own panel rather than
 * being bent into the one built around files and a queue.
 */

export type UtilityField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "color";
  defaultValue?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  choices?: Array<{ value: string; label: string }>;
  /** Shown only when this returns true, so a form has no dead controls. */
  showWhen?: (values: Options) => boolean;
  hint?: string;
};

export type Utility = {
  id: string;
  label: string;
  description: string;
  /** What the big box at the top is for. Some utilities generate, and take none. */
  input: "text" | "none";
  /**
   * "text" (the default) shows what `run` returns in a read-only box, meant
   * to be read or copied. "image" instead treats it as a `data:` URL and
   * shows it in an `<img>` — the shape a QR code or a barcode's result
   * actually is. Nothing here is ever HTML: an image source is loaded as a
   * picture, never parsed as markup, whatever the SVG behind the data URL
   * contains.
   */
  outputKind?: "text" | "image";
  inputLabel?: string;
  fields?: UtilityField[];
  /** File extensions this utility can read its input from, e.g. [".css"]. */
  acceptFiles?: string[];
  // A few utilities (the hashes) reach for the platform's crypto API, which is
  // asynchronous. Every result is awaited the same way, whether it resolves
  // immediately or not, so the panel does not need to know which is which.
  //
  // `t` is the panel's own translator, offered to the handful of utilities
  // that build a word like "Ethanol" or a phrase like "3 weeks, 2 days" into
  // the value rather than into a name — a name is translated automatically
  // wherever it is shown, but a value is exactly what the tool computed, and
  // most tools have no English in theirs to translate. The default matches
  // English exactly, so a utility ignoring `t` behaves the same either way,
  // and every existing test that calls `run`/`facts` with two arguments
  // keeps working unchanged.
  run: (input: string, options: Options, t?: Translate) => string | Promise<string>;
  /** A result shown as a list of name and value rather than as a block of text. */
  facts?: (
    input: string,
    options: Options,
    t?: Translate,
  ) => Array<[string, string]> | Promise<Array<[string, string]>>;
  /**
   * A handful of CSS generators earn a live look, not just a copyable block.
   * This is always a plain object of CSS properties applied through React's
   * own `style` prop — never markup, so there is nothing here that gets
   * parsed as HTML and nothing to sanitise.
   */
  preview?: (options: Options) => Preview;
  /**
   * The message for the same outbound-request notice reverse image search
   * and music recognition already show — set only on the handful of tools
   * here that actually leave the machine, so most utilities carry nothing
   * and show nothing.
   */
  outbound?: string;
};

export type UtilityGroup = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  preview?: ToolPreview;
  utilities: Utility[];
};

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** The encode/decode pair most of the codes utilities share. */
function directionField(defaultValue: string, encodeLabel = "Encode", decodeLabel = "Decode"): UtilityField {
  return {
    key: "direction",
    label: "Direction",
    type: "select",
    defaultValue,
    choices: [
      { value: "encode", label: encodeLabel },
      { value: "decode", label: decodeLabel },
    ],
  };
}

/** A plain date field, in the YYYY-MM-DD shape every date utility reads. */
function dateField(key: string, label: string): UtilityField {
  return { key, label, type: "text", placeholder: "YYYY-MM-DD" };
}

const baseChoices = [
  { value: "binary", label: "Binary" },
  { value: "octal", label: "Octal" },
  { value: "decimal", label: "Decimal" },
  { value: "hex", label: "Hexadecimal" },
];

export const utilityGroups: UtilityGroup[] = [
  {
    id: "text-tools",
    icon: Type,
    preview: { src: "/previews/text-tools.webm", poster: "/previews/text-tools.jpg" },
    title: "Work on text",
    description: "Case, order, duplicates, replacements and counts — as you type.",
    keywords: [
      "text", "case", "uppercase", "lowercase", "title", "sentence", "reverse", "upside down",
      "duplicate", "sort", "alphabetical", "shuffle", "random", "replace", "find", "whitespace",
      "trim", "prefix", "suffix", "number", "lines", "count", "characters", "words", "slug",
      "lorem", "ipsum", "placeholder",
    ],
    utilities: [
      {
        id: "case",
        label: "Change case",
        description: "Upper, lower, title or sentence case.",
        input: "text",
        fields: [
          {
            key: "case",
            label: "Case",
            type: "select",
            defaultValue: "upper",
            choices: [
              { value: "upper", label: "UPPERCASE" },
              { value: "lower", label: "lowercase" },
              { value: "title", label: "Title Case" },
              { value: "sentence", label: "Sentence case" },
            ],
          },
        ],
        run: text.changeCase,
      },
      {
        id: "reverse",
        label: "Reverse text",
        description: "Read the characters backwards.",
        input: "text",
        fields: [
          {
            key: "scope",
            label: "Reverse",
            type: "select",
            defaultValue: "lines",
            choices: [
              { value: "lines", label: "Each line on its own" },
              { value: "whole", label: "The whole text, lines included" },
            ],
          },
        ],
        run: text.reverseText,
      },
      {
        id: "upside-down",
        label: "Upside down",
        description: "Flip the letters for a caption or a bio.",
        input: "text",
        run: (value) => text.upsideDown(value),
      },
      {
        id: "duplicates",
        label: "Remove duplicate lines",
        description: "Keep the first of each line, drop the rest.",
        input: "text",
        fields: [
          {
            key: "caseSensitive",
            label: "Match the case",
            type: "select",
            defaultValue: "yes",
            choices: yesNo,
          },
          {
            key: "trim",
            label: "Ignore spaces at the ends",
            type: "select",
            defaultValue: "yes",
            choices: yesNo,
          },
        ],
        run: text.removeDuplicateLines,
      },
      {
        id: "sort",
        label: "Sort lines",
        description: "Alphabetical order, in your own alphabet.",
        input: "text",
        fields: [
          {
            key: "order",
            label: "Order",
            type: "select",
            defaultValue: "ascending",
            choices: [
              { value: "ascending", label: "A to Z" },
              { value: "descending", label: "Z to A" },
            ],
          },
        ],
        run: text.sortLines,
      },
      {
        id: "shuffle",
        label: "Shuffle lines",
        description: "Put the lines in a random order — a draw, from a list.",
        input: "text",
        run: (value) => text.shuffleLines(value),
      },
      {
        id: "replace",
        label: "Find and replace",
        description: "Every occurrence, plain or by pattern.",
        input: "text",
        fields: [
          { key: "find", label: "Find", type: "text", placeholder: "what to look for" },
          { key: "replace", label: "Replace with", type: "text", placeholder: "leave empty to delete" },
          {
            key: "caseSensitive",
            label: "Match the case",
            type: "select",
            defaultValue: "yes",
            choices: yesNo,
          },
          {
            key: "regex",
            label: "Treat it as a pattern",
            type: "select",
            defaultValue: "no",
            choices: yesNo,
            hint: "A regular expression, where $1 in the replacement is the first group.",
          },
        ],
        run: text.findAndReplace,
      },
      {
        id: "whitespace",
        label: "Tidy the spacing",
        description: "Collapse runs of spaces, tabs and blank lines.",
        input: "text",
        fields: [
          {
            key: "blankLines",
            label: "Blank lines",
            type: "select",
            defaultValue: "collapse",
            choices: [
              { value: "collapse", label: "At most one in a row" },
              { value: "keep", label: "Leave them alone" },
              { value: "remove", label: "Remove them all" },
            ],
          },
        ],
        run: text.tidyWhitespace,
      },
      {
        id: "affix",
        label: "Prefix and suffix",
        description: "Put something at the start or the end of every line.",
        input: "text",
        fields: [
          { key: "prefix", label: "Prefix", type: "text", placeholder: "before each line" },
          { key: "suffix", label: "Suffix", type: "text", placeholder: "after each line" },
          {
            key: "skipEmpty",
            label: "Skip empty lines",
            type: "select",
            defaultValue: "yes",
            choices: yesNo,
          },
        ],
        run: text.affixLines,
      },
      {
        id: "number-lines",
        label: "Number the lines",
        description: "1., 2., 3. — aligned, however many there are.",
        input: "text",
        fields: [
          { key: "start", label: "Start at", type: "number", defaultValue: "1", min: 0 },
          { key: "separator", label: "After the number", type: "text", defaultValue: ". " },
        ],
        run: text.numberLines,
      },
      {
        id: "count",
        label: "Count what is there",
        description: "Characters, words, lines and how long it takes to read.",
        input: "text",
        run: (value) => value,
        facts: (value) => {
          const counted = text.countText(value);
          return [
            ["Characters", String(counted.characters)],
            ["Characters without spaces", String(counted.charactersWithoutSpaces)],
            ["Words", String(counted.words)],
            ["Lines", String(counted.lines)],
            ["Paragraphs", String(counted.paragraphs)],
            ["Sentences", String(counted.sentences)],
            ["Reading time", `${counted.readingMinutes} min`],
          ];
        },
      },
      {
        id: "slug",
        label: "Make a slug",
        description: "A URL-safe version: no accents, no punctuation.",
        input: "text",
        fields: [
          {
            key: "separator",
            label: "Separator",
            type: "select",
            defaultValue: "hyphen",
            choices: [
              { value: "hyphen", label: "Hyphen (-)" },
              { value: "underscore", label: "Underscore (_)" },
            ],
          },
        ],
        run: text.slugify,
      },
      {
        id: "lorem",
        label: "Lorem ipsum",
        description: "Placeholder prose, by paragraph, sentence or word.",
        input: "none",
        fields: [
          { key: "count", label: "How many", type: "number", defaultValue: "3", min: 1, max: 200 },
          {
            key: "unit",
            label: "Of",
            type: "select",
            defaultValue: "paragraphs",
            choices: [
              { value: "paragraphs", label: "Paragraphs" },
              { value: "sentences", label: "Sentences" },
              { value: "words", label: "Words" },
            ],
          },
          {
            key: "classic",
            label: "Start with “Lorem ipsum”",
            type: "select",
            defaultValue: "yes",
            choices: yesNo,
          },
        ],
        run: (_input, options) => text.loremIpsum(options),
      },
      {
        id: "bionic",
        label: "Bionic reading",
        description: "Bolds the start of each word, to guide the eye.",
        input: "text",
        fields: [],
        run: (input) => text.bionicReading(input),
      },
      {
        id: "letter-style",
        label: "Letter styles",
        description: "Circled, full-width, or one letter per line.",
        input: "text",
        fields: [
          {
            key: "style",
            label: "Style",
            type: "select",
            defaultValue: "circled",
            choices: [
              { value: "circled", label: "Circled" },
              { value: "fullwidth", label: "Full-width" },
              { value: "stacked", label: "Stacked (one per line)" },
            ],
          },
        ],
        run: text.styleLetters,
      },
    ],
  },
  {
    id: "codes-hashes",
    icon: Hash,
    preview: { src: "/previews/codes-hashes.webm", poster: "/previews/codes-hashes.jpg" },
    title: "Codes and hashes",
    description: "Base64, URL, hashes, JWT, UUID, passwords and number bases.",
    keywords: [
      "base64", "url", "encode", "decode", "html", "entity", "binary", "morse", "hash",
      "md5", "sha1", "sha256", "sha384", "sha512", "checksum", "jwt", "token", "uuid", "guid",
      "password", "generator", "roman", "numeral", "base", "hex", "octal", "timestamp", "unix",
      "extenso", "numbers", "words",
    ],
    utilities: [
      {
        id: "base64",
        label: "Base64",
        description: "Encode or decode, safe with accents and emoji.",
        input: "text",
        fields: [directionField("encode")],
        run: codes.base64Convert,
      },
      {
        id: "url",
        label: "URL encode/decode",
        description: "Escape the characters that would break a link.",
        input: "text",
        fields: [directionField("encode")],
        run: codes.urlConvert,
      },
      {
        id: "html-entities",
        label: "HTML entities",
        description: "Escape or unescape the five reserved HTML characters.",
        input: "text",
        fields: [directionField("encode")],
        run: codes.htmlConvert,
      },
      {
        id: "binary",
        label: "Binary code",
        description: "Text to 8-bit binary and back.",
        input: "text",
        fields: [directionField("encode")],
        run: codes.binaryConvert,
      },
      {
        id: "morse",
        label: "Morse code",
        description: "Text to Morse and back.",
        input: "text",
        fields: [directionField("encode")],
        run: codes.morseConvert,
      },
      {
        id: "hash",
        label: "Hash generator",
        description: "MD5, SHA-1, SHA-256, SHA-384 and SHA-512, all at once.",
        input: "text",
        fields: [
          {
            key: "algorithm",
            label: "Copy which one",
            type: "select",
            defaultValue: "sha256",
            choices: [
              { value: "md5", label: "MD5" },
              { value: "sha1", label: "SHA-1" },
              { value: "sha256", label: "SHA-256" },
              { value: "sha384", label: "SHA-384" },
              { value: "sha512", label: "SHA-512" },
            ],
          },
        ],
        run: codes.hashText,
        facts: (input) => codes.hashFacts(input),
      },
      {
        id: "jwt",
        label: "JWT decoder",
        description: "Read a token's header and payload. Does not check the signature.",
        input: "text",
        run: (input) => codes.decodeJwt(input),
        facts: (input, _options, t) => codes.jwtFacts(input, t),
      },
      {
        id: "uuid",
        label: "UUID generator",
        description: "One or a batch of version-4 UUIDs.",
        input: "none",
        fields: [{ key: "count", label: "How many", type: "number", defaultValue: "1", min: 1, max: 100 }],
        run: (_input, options) => generators.generateUuidBatch(_input, options),
      },
      {
        id: "password",
        label: "Password generator",
        description: "Random, from the character sets you choose.",
        input: "none",
        fields: [
          { key: "length", label: "Length", type: "number", defaultValue: "16", min: 4, max: 128 },
          { key: "lower", label: "Lowercase", type: "select", defaultValue: "yes", choices: yesNo },
          { key: "upper", label: "Uppercase", type: "select", defaultValue: "yes", choices: yesNo },
          { key: "digits", label: "Digits", type: "select", defaultValue: "yes", choices: yesNo },
          { key: "symbols", label: "Symbols", type: "select", defaultValue: "no", choices: yesNo },
        ],
        run: codes.generatePassword,
        facts: (_input, options, t) => codes.passwordStrength(codes.generatePassword(_input, options), t),
      },
      {
        id: "roman",
        label: "Roman numerals",
        description: "1 to 3999, and back.",
        input: "text",
        inputLabel: "A number, or a numeral",
        fields: [directionField("encode", "To Roman", "From Roman")],
        run: codes.romanConvert,
      },
      {
        id: "number-base",
        label: "Number base conversion",
        description: "Decimal, binary, octal and hexadecimal.",
        input: "text",
        inputLabel: "A number",
        fields: [
          { key: "from", label: "From", type: "select", defaultValue: "decimal", choices: baseChoices },
          { key: "to", label: "To", type: "select", defaultValue: "binary", choices: baseChoices },
        ],
        run: codes.convertBase,
      },
      {
        id: "number-words",
        label: "Numbers written out",
        description: "In Portuguese — mil, um milhão, and so on.",
        input: "text",
        inputLabel: "A number",
        run: codes.numberWordsConvert,
      },
      {
        id: "timestamp",
        label: "Timestamp converter",
        description: "Unix time to a date, and a date to Unix time.",
        input: "text",
        fields: [
          {
            key: "direction",
            label: "Direction",
            type: "select",
            defaultValue: "toDate",
            choices: [
              { value: "toDate", label: "Timestamp to date" },
              { value: "toTimestamp", label: "Date to timestamp" },
            ],
          },
          {
            key: "unit",
            label: "Timestamp unit",
            type: "select",
            defaultValue: "seconds",
            choices: [
              { value: "seconds", label: "Seconds" },
              { value: "milliseconds", label: "Milliseconds" },
            ],
            showWhen: (values) => values.direction === "toDate",
          },
        ],
        run: (input, options) =>
          options.direction === "toTimestamp"
            ? codes.dateToTimestamp(input)
            : codes.timestampToDate(input, options),
      },
    ],
  },
  {
    id: "dates-time",
    icon: Calendar,
    preview: { src: "/previews/dates-time.webm", poster: "/previews/dates-time.jpg" },
    title: "Dates and time",
    description: "Day counts, business days, age, zodiac, moon phase and more.",
    keywords: [
      "date", "day", "counter", "business", "days", "add", "subtract", "age", "birthday",
      "zodiac", "sign", "moon", "phase", "season", "year", "week", "calendar", "holiday",
    ],
    utilities: [
      {
        id: "day-counter",
        label: "Day counter",
        description: "The difference between two dates.",
        input: "none",
        fields: [dateField("start", "Start"), dateField("end", "End")],
        run: () => "",
        facts: dates.dayCounterFacts,
      },
      {
        id: "business-days",
        label: "Business days",
        description: "Weekdays between two dates, minus Brazilian national holidays.",
        input: "none",
        fields: [dateField("start", "Start"), dateField("end", "End")],
        run: () => "",
        facts: dates.businessDaysFacts,
      },
      {
        id: "shift-date",
        label: "Add or subtract days",
        description: "Move a date forward or back.",
        input: "none",
        fields: [
          dateField("date", "Date"),
          { key: "amount", label: "Amount", type: "number", defaultValue: "1", min: 0 },
          {
            key: "unit",
            label: "Unit",
            type: "select",
            defaultValue: "days",
            choices: [
              { value: "days", label: "Days" },
              { value: "months", label: "Months" },
              { value: "years", label: "Years" },
            ],
          },
          {
            key: "direction",
            label: "Direction",
            type: "select",
            defaultValue: "add",
            choices: [
              { value: "add", label: "Add" },
              { value: "subtract", label: "Subtract" },
            ],
          },
        ],
        run: (_input, options) => dates.shiftDate(_input, options),
      },
      {
        id: "age",
        label: "Age calculator",
        description: "Years, months and days, as of today or another date.",
        input: "none",
        fields: [dateField("birth", "Date of birth"), dateField("today", "As of")],
        run: () => "",
        facts: dates.ageFacts,
      },
      {
        id: "zodiac",
        label: "Zodiac sign",
        description: "The sign for a date of birth.",
        input: "text",
        inputLabel: "Date of birth (YYYY-MM-DD)",
        run: (input, options, t) => dates.zodiacSign(input, options, t),
      },
      {
        id: "moon-phase",
        label: "Moon phase",
        description: "The phase and illumination for any date.",
        input: "text",
        inputLabel: "Date (leave empty for today)",
        run: () => "",
        facts: (input, options, t) => dates.moonPhaseFacts(input, options, t),
      },
      {
        id: "day-of-year",
        label: "Day and week of the year",
        description: "Which day and week a date falls on.",
        input: "text",
        inputLabel: "Date (leave empty for today)",
        run: () => "",
        facts: (input, options, t) => dates.dayOfYearFacts(input, options, t),
      },
      {
        id: "season",
        label: "Season of the year",
        description: "What season a date falls in, in either hemisphere.",
        input: "text",
        inputLabel: "Date (leave empty for today)",
        fields: [
          {
            key: "hemisphere",
            label: "Hemisphere",
            type: "select",
            defaultValue: "southern",
            choices: [
              { value: "southern", label: "Southern" },
              { value: "northern", label: "Northern" },
            ],
          },
        ],
        run: () => "",
        facts: dates.seasonFacts,
      },
    ],
  },
  {
    id: "math-finance",
    icon: Calculator,
    preview: { src: "/previews/math-finance.webm", poster: "/previews/math-finance.jpg" },
    title: "Math, finance and health",
    description: "Percentages, fractions, units, loans, BMI and pregnancy dates.",
    keywords: [
      "percentage", "percent", "rule of three", "fraction", "unit", "convert", "temperature",
      "savings", "financing", "loan", "installment", "bmi", "imc", "gestational", "pregnancy",
      "fertile", "ovulation", "mass", "length", "speed", "volume",
    ],
    utilities: [
      {
        id: "percentage",
        label: "Percentage calculator",
        description: "A% of B, what percent A is of B, or the change between them.",
        input: "none",
        fields: [
          {
            key: "mode",
            label: "Calculate",
            type: "select",
            defaultValue: "percentOf",
            choices: [
              { value: "percentOf", label: "A% of B" },
              { value: "whatPercent", label: "A is what % of B" },
              { value: "changeFrom", label: "% change from A to B" },
            ],
          },
          { key: "a", label: "A", type: "number", defaultValue: "10" },
          { key: "b", label: "B", type: "number", defaultValue: "100" },
        ],
        run: () => "",
        facts: math.percentageFacts,
      },
      {
        id: "rule-of-three",
        label: "Rule of three",
        description: "If A is to B, what is C to?",
        input: "none",
        fields: [
          { key: "a", label: "A", type: "number", defaultValue: "1" },
          { key: "b", label: "B", type: "number", defaultValue: "1" },
          { key: "c", label: "C", type: "number", defaultValue: "1" },
        ],
        run: math.ruleOfThree,
      },
      {
        id: "fraction",
        label: "Fraction calculator",
        description: "Add, subtract, multiply or divide, simplified.",
        input: "none",
        fields: [
          {
            key: "operation",
            label: "Operation",
            type: "select",
            defaultValue: "add",
            choices: [
              { value: "add", label: "Add" },
              { value: "subtract", label: "Subtract" },
              { value: "multiply", label: "Multiply" },
              { value: "divide", label: "Divide" },
            ],
          },
          { key: "n1", label: "Numerator 1", type: "number", defaultValue: "1" },
          { key: "d1", label: "Denominator 1", type: "number", defaultValue: "2" },
          { key: "n2", label: "Numerator 2", type: "number", defaultValue: "1" },
          { key: "d2", label: "Denominator 2", type: "number", defaultValue: "4" },
        ],
        run: () => "",
        facts: math.fractionFacts,
      },
      {
        id: "unit-converter",
        label: "Unit converter",
        description: "Mass, length, speed, volume and temperature.",
        input: "none",
        fields: [
          {
            key: "category",
            label: "Category",
            type: "select",
            defaultValue: "length",
            choices: [
              { value: "length", label: "Length" },
              { value: "mass", label: "Mass" },
              { value: "speed", label: "Speed" },
              { value: "volume", label: "Volume" },
              { value: "temperature", label: "Temperature" },
            ],
          },
          { key: "value", label: "Value", type: "number", defaultValue: "1" },
          { key: "from", label: "From", type: "text", defaultValue: "km" },
          { key: "to", label: "To", type: "text", defaultValue: "m" },
        ],
        run: math.convertUnit,
      },
      {
        id: "savings",
        label: "Savings simulator",
        description: "A monthly deposit, compounded at a monthly rate.",
        input: "none",
        fields: [
          { key: "monthly", label: "Monthly deposit (R$)", type: "number", defaultValue: "100" },
          { key: "months", label: "Months", type: "number", defaultValue: "12", min: 0, max: 1200 },
          { key: "rate", label: "Monthly rate (%)", type: "number", defaultValue: "0.5" },
        ],
        run: () => "",
        facts: math.savingsFacts,
      },
      {
        id: "financing",
        label: "Financing simulator",
        description: "An equal monthly payment (Price table).",
        input: "none",
        fields: [
          { key: "principal", label: "Amount financed (R$)", type: "number", defaultValue: "10000" },
          { key: "months", label: "Months", type: "number", defaultValue: "24", min: 1, max: 600 },
          { key: "rate", label: "Monthly rate (%)", type: "number", defaultValue: "1.5" },
        ],
        run: () => "",
        facts: math.financingFacts,
      },
      {
        id: "bmi",
        label: "BMI calculator",
        description: "Body mass index, and its category.",
        input: "none",
        fields: [
          { key: "weight", label: "Weight (kg)", type: "number", defaultValue: "70" },
          { key: "height", label: "Height (cm)", type: "number", defaultValue: "170" },
        ],
        run: () => "",
        facts: math.bmiFacts,
      },
      {
        id: "gestational-age",
        label: "Gestational calculator",
        description: "Weeks along, and the estimated due date.",
        input: "none",
        fields: [dateField("lastPeriod", "First day of the last period"), dateField("today", "As of")],
        run: () => "",
        facts: math.gestationalFacts,
      },
      {
        id: "fertile-window",
        label: "Fertile window",
        description: "An estimate, from the last period and the cycle length.",
        input: "none",
        fields: [
          dateField("lastPeriod", "First day of the last period"),
          { key: "cycleLength", label: "Cycle length (days)", type: "number", defaultValue: "28", min: 20, max: 45 },
        ],
        run: () => "",
        facts: math.fertileWindowFacts,
      },
    ],
  },
  {
    id: "test-data",
    icon: FlaskConical,
    preview: { src: "/previews/test-data.webm", poster: "/previews/test-data.jpg" },
    title: "Test data",
    description: "CPF, CNPJ, CEP, card numbers and UUIDs — sandbox-only, never real.",
    keywords: [
      "cpf", "cnpj", "cep", "generator", "validate", "test data", "fake", "brazilian",
      "document", "postal code", "credit card", "card number", "sandbox", "payment",
      "gateway", "luhn",
    ],
    utilities: [
      {
        id: "cpf",
        label: "CPF",
        description: "Generate one, or check whether a number is valid.",
        input: "text",
        inputLabel: "A CPF, when checking one",
        fields: [
          {
            key: "mode",
            label: "Mode",
            type: "select",
            defaultValue: "generate",
            choices: [
              { value: "generate", label: "Generate" },
              { value: "validate", label: "Validate" },
            ],
          },
        ],
        run: generators.cpfTool,
      },
      {
        id: "cnpj",
        label: "CNPJ",
        description: "Generate one, or check whether a number is valid.",
        input: "text",
        inputLabel: "A CNPJ, when checking one",
        fields: [
          {
            key: "mode",
            label: "Mode",
            type: "select",
            defaultValue: "generate",
            choices: [
              { value: "generate", label: "Generate" },
              { value: "validate", label: "Validate" },
            ],
          },
        ],
        run: generators.cnpjTool,
      },
      {
        id: "cep",
        label: "CEP",
        description: "A correctly formatted, made-up postal code.",
        input: "none",
        run: () => generators.generateCep(),
      },
      {
        id: "test-card",
        label: "Test card number",
        description: "For a payment gateway's sandbox — it charges nothing.",
        input: "none",
        fields: [
          {
            key: "network",
            label: "Network",
            type: "select",
            defaultValue: "visa",
            choices: [
              { value: "visa", label: "Visa" },
              { value: "mastercard", label: "Mastercard" },
              { value: "amex", label: "American Express" },
              { value: "discover", label: "Discover" },
            ],
          },
        ],
        run: () => "",
        facts: generators.testCardFacts,
      },
    ],
  },
  {
    id: "colors",
    icon: Palette,
    preview: { src: "/previews/colors.webm", poster: "/previews/colors.jpg" },
    title: "Colour tools",
    description: "HEX, RGBA, shades and mixing two colours together.",
    keywords: ["color", "colour", "hex", "rgba", "rgb", "hsl", "shades", "mix", "palette"],
    utilities: [
      {
        id: "hex-to-rgba",
        label: "HEX to RGBA",
        description: "See a colour's RGB, RGBA and HSL at once.",
        input: "text",
        inputLabel: "A HEX colour, like #ff8800",
        run: () => "",
        facts: (input) => colors.hexToRgbaFacts(input),
      },
      {
        id: "rgba-to-hex",
        label: "RGBA to HEX",
        description: "rgb(...) or rgba(...) to a HEX colour.",
        input: "text",
        inputLabel: "rgb(255, 136, 0) or rgba(255, 136, 0, 0.5)",
        fields: [{ key: "includeAlpha", label: "Include alpha in the HEX", type: "select", defaultValue: "no", choices: yesNo }],
        run: colors.rgbaToHex,
      },
      {
        id: "color-shades",
        label: "Colour shades",
        description: "Darker and lighter steps from one colour.",
        input: "text",
        inputLabel: "A HEX colour",
        fields: [{ key: "steps", label: "Steps each way", type: "number", defaultValue: "5", min: 1, max: 20 }],
        run: colors.colorShades,
      },
      {
        id: "color-mixer",
        label: "Colour mixer",
        description: "Blend two colours over a number of steps.",
        input: "none",
        fields: [
          { key: "first", label: "First colour", type: "color", defaultValue: "#000000" },
          { key: "second", label: "Second colour", type: "color", defaultValue: "#ffffff" },
          { key: "steps", label: "Steps", type: "number", defaultValue: "5", min: 2, max: 10 },
        ],
        run: colors.colorMix,
      },
    ],
  },
  {
    id: "css-tools",
    icon: Paintbrush,
    preview: { src: "/previews/css-tools.webm", poster: "/previews/css-tools.jpg" },
    title: "CSS generators",
    description: "Copy the CSS, or just watch the preview change.",
    keywords: [
      "css", "loader", "spinner", "checkbox", "switch", "toggle", "clip path", "shape",
      "pattern", "background", "cubic bezier", "easing", "timing function", "glassmorphism",
      "blur", "glitch", "gradient", "triangle", "box shadow", "border radius", "generator",
    ],
    utilities: [
      {
        id: "border-radius",
        label: "Border radius",
        description: "Shape a box's corners individually.",
        input: "none",
        fields: [
          { key: "tl", label: "Top left", type: "number", defaultValue: "16", min: 0, max: 200 },
          { key: "tr", label: "Top right", type: "number", defaultValue: "16", min: 0, max: 200 },
          { key: "br", label: "Bottom right", type: "number", defaultValue: "16", min: 0, max: 200 },
          { key: "bl", label: "Bottom left", type: "number", defaultValue: "16", min: 0, max: 200 },
        ],
        run: css.borderRadiusCss,
        preview: css.borderRadiusPreview,
      },
      {
        id: "box-shadow",
        label: "Box shadow",
        description: "Offset, blur, spread and colour.",
        input: "none",
        fields: [
          { key: "x", label: "Offset X", type: "number", defaultValue: "0", min: -100, max: 100 },
          { key: "y", label: "Offset Y", type: "number", defaultValue: "8", min: -100, max: 100 },
          { key: "blur", label: "Blur", type: "number", defaultValue: "24", min: 0, max: 200 },
          { key: "spread", label: "Spread", type: "number", defaultValue: "0", min: -100, max: 100 },
          { key: "color", label: "Colour", type: "color", defaultValue: "#000000" },
          { key: "opacity", label: "Opacity (%)", type: "number", defaultValue: "25", min: 0, max: 100 },
          { key: "inset", label: "Inset", type: "select", defaultValue: "no", choices: yesNo },
        ],
        run: css.boxShadowCss,
        preview: css.boxShadowPreview,
      },
      {
        id: "gradient",
        label: "Gradient",
        description: "Linear or radial, between two colours.",
        input: "none",
        fields: [
          {
            key: "shape",
            label: "Shape",
            type: "select",
            defaultValue: "linear",
            choices: [
              { value: "linear", label: "Linear" },
              { value: "radial", label: "Radial" },
            ],
          },
          {
            key: "angle",
            label: "Angle",
            type: "number",
            defaultValue: "135",
            min: 0,
            max: 360,
            showWhen: (v) => v.shape !== "radial",
          },
          { key: "from", label: "From", type: "color", defaultValue: "#6366f1" },
          { key: "to", label: "To", type: "color", defaultValue: "#ec4899" },
        ],
        run: css.gradientCss,
        preview: css.gradientPreview,
      },
      {
        id: "glassmorphism",
        label: "Glassmorphism",
        description: "A frosted-glass panel: blur behind a translucent fill.",
        input: "none",
        fields: [
          { key: "blur", label: "Blur", type: "number", defaultValue: "12", min: 0, max: 60 },
          { key: "opacity", label: "Fill opacity (%)", type: "number", defaultValue: "18", min: 0, max: 100 },
        ],
        run: css.glassmorphismCss,
        preview: css.glassmorphismPreview,
      },
      {
        id: "clip-path",
        label: "Clip path",
        description: "Cut a box into a shape.",
        input: "none",
        fields: [
          {
            key: "shape",
            label: "Shape",
            type: "select",
            defaultValue: "circle",
            choices: [
              { value: "circle", label: "Circle" },
              { value: "triangle", label: "Triangle" },
              { value: "trapezoid", label: "Trapezoid" },
              { value: "pentagon", label: "Pentagon" },
              { value: "hexagon", label: "Hexagon" },
              { value: "star", label: "Star" },
              { value: "arrow", label: "Arrow" },
            ],
          },
        ],
        run: css.clipPathCss,
        preview: css.clipPathPreview,
      },
      {
        id: "background-pattern",
        label: "Background pattern",
        description: "Dots, stripes or a grid, CSS-only.",
        input: "none",
        fields: [
          {
            key: "pattern",
            label: "Pattern",
            type: "select",
            defaultValue: "dots",
            choices: [
              { value: "dots", label: "Dots" },
              { value: "stripes", label: "Stripes" },
              { value: "grid", label: "Grid" },
            ],
          },
          { key: "color", label: "Colour", type: "color", defaultValue: "#6366f1" },
          { key: "size", label: "Size", type: "number", defaultValue: "20", min: 4, max: 100 },
        ],
        run: css.backgroundPatternCss,
        preview: css.backgroundPatternPreview,
      },
      {
        id: "triangle",
        label: "Triangle",
        description: "The border trick, in whichever direction.",
        input: "none",
        fields: [
          { key: "size", label: "Size", type: "number", defaultValue: "60", min: 10, max: 200 },
          { key: "color", label: "Colour", type: "color", defaultValue: "#6366f1" },
          {
            key: "direction",
            label: "Points",
            type: "select",
            defaultValue: "up",
            choices: [
              { value: "up", label: "Up" },
              { value: "down", label: "Down" },
              { value: "left", label: "Left" },
              { value: "right", label: "Right" },
            ],
          },
        ],
        run: css.triangleCss,
        preview: css.trianglePreview,
      },
      {
        id: "loader",
        label: "Loader",
        description: "A spinner or a row of pulsing dots.",
        input: "none",
        fields: [
          {
            key: "style",
            label: "Style",
            type: "select",
            defaultValue: "spin",
            choices: [
              { value: "spin", label: "Spinning ring" },
              { value: "dots", label: "Pulsing dots" },
            ],
          },
          { key: "color", label: "Colour", type: "color", defaultValue: "#6366f1" },
          { key: "size", label: "Size", type: "number", defaultValue: "40", min: 10, max: 120 },
        ],
        run: css.loaderCss,
        preview: css.loaderPreview,
      },
      {
        id: "cubic-bezier",
        label: "Cubic bezier",
        description: "An easing curve, previewed as motion.",
        input: "none",
        fields: [
          {
            key: "preset",
            label: "Preset",
            type: "select",
            defaultValue: "ease",
            choices: [
              { value: "ease", label: "Ease" },
              { value: "ease-in", label: "Ease in" },
              { value: "ease-out", label: "Ease out" },
              { value: "ease-in-out", label: "Ease in-out" },
              { value: "bounce", label: "Bounce" },
              { value: "anticipate", label: "Anticipate" },
              { value: "custom", label: "Custom" },
            ],
          },
          { key: "x1", label: "X1", type: "number", defaultValue: "0.25", showWhen: (v) => v.preset === "custom" },
          { key: "y1", label: "Y1", type: "number", defaultValue: "0.1", showWhen: (v) => v.preset === "custom" },
          { key: "x2", label: "X2", type: "number", defaultValue: "0.25", showWhen: (v) => v.preset === "custom" },
          { key: "y2", label: "Y2", type: "number", defaultValue: "1", showWhen: (v) => v.preset === "custom" },
        ],
        run: css.cubicBezierCss,
        preview: css.cubicBezierPreview,
      },
      {
        id: "text-glitch",
        label: "Text glitch effect",
        description: "A flickering RGB-split, for a heading.",
        input: "none",
        fields: [
          { key: "text", label: "Text", type: "text", defaultValue: "GLITCH" },
          { key: "color1", label: "Colour 1", type: "color", defaultValue: "#ff00c1" },
          { key: "color2", label: "Colour 2", type: "color", defaultValue: "#00fff9" },
        ],
        run: css.textGlitchCss,
        preview: css.textGlitchPreview,
      },
      {
        id: "switch",
        label: "Switch",
        description: "A toggle track and thumb.",
        input: "none",
        fields: [
          { key: "color", label: "Colour", type: "color", defaultValue: "#6366f1" },
          { key: "size", label: "Size", type: "number", defaultValue: "24", min: 14, max: 60 },
        ],
        run: css.switchCss,
        preview: css.switchPreview,
      },
      {
        id: "checkbox",
        label: "Checkbox",
        description: "A styled box, square, rounded or circular.",
        input: "none",
        fields: [
          { key: "color", label: "Colour", type: "color", defaultValue: "#6366f1" },
          { key: "size", label: "Size", type: "number", defaultValue: "22", min: 12, max: 60 },
          {
            key: "shape",
            label: "Shape",
            type: "select",
            defaultValue: "rounded",
            choices: [
              { value: "square", label: "Square" },
              { value: "rounded", label: "Rounded" },
              { value: "circle", label: "Circle" },
            ],
          },
        ],
        run: css.checkboxCss,
        preview: css.checkboxPreview,
      },
    ],
  },
  {
    id: "network",
    icon: Globe,
    preview: { src: "/previews/network.webm", poster: "/previews/network.jpg" },
    title: "Network lookups",
    description: "Your IP, a domain's DNS records, and where an address is.",
    keywords: [
      "ip", "address", "dns", "lookup", "domain", "network", "my ip", "geolocation",
      "location", "whois", "records", "a record", "mx record", "cname",
    ],
    utilities: [
      {
        id: "my-ip",
        label: "My IP",
        description: "Your public IP address, as the internet sees it.",
        input: "none",
        outbound: "Asks a public service (ipify) for the address it sees your connection coming from.",
        run: () => "",
        facts: () => network.myIpFacts(),
      },
      {
        id: "ip-lookup",
        label: "Locate an IP",
        description: "The rough location and network an address belongs to.",
        input: "text",
        inputLabel: "An IP address, or leave empty for your own",
        outbound: "Sends the address to a public geolocation service (ipapi.co) to look it up.",
        run: () => "",
        facts: (input) => network.ipLookupFacts(input),
      },
      {
        id: "dns-lookup",
        label: "DNS lookup",
        description: "The records a domain publishes.",
        input: "text",
        inputLabel: "A domain, like example.com",
        outbound: "Asks a public DNS resolver (Cloudflare) for the domain's published records.",
        fields: [
          {
            key: "type",
            label: "Record type",
            type: "select",
            defaultValue: "A",
            choices: network.dnsRecordTypes.map((type) => ({ value: type, label: type })),
          },
        ],
        run: (input, options) => network.dnsLookup(input, options),
      },
    ],
  },
  {
    id: "code-formatting",
    icon: Code,
    preview: { src: "/previews/code-formatting.webm", poster: "/previews/code-formatting.jpg" },
    title: "Minify and format",
    description: "CSS and HTML, compacted for shipping or spread out to read.",
    keywords: [
      "minify", "minifier", "format", "formatter", "beautify", "pretty print", "css",
      "html", "compact", "indent",
    ],
    utilities: [
      {
        id: "css-minify",
        label: "Minify CSS",
        description: "Strip comments and whitespace.",
        input: "text",
        acceptFiles: [".css"],
        run: (input) => formatting.minifyCss(input),
      },
      {
        id: "css-format",
        label: "Format CSS",
        description: "One declaration per line, indented by nesting.",
        input: "text",
        acceptFiles: [".css"],
        run: (input) => formatting.formatCss(input),
      },
      {
        id: "html-minify",
        label: "Minify HTML",
        description: "Strip comments and whitespace between tags.",
        input: "text",
        acceptFiles: [".html", ".htm"],
        run: (input) => formatting.minifyHtml(input),
      },
      {
        id: "html-format",
        label: "Format HTML",
        description: "Indented by nesting, a child one level deeper than its parent.",
        input: "text",
        acceptFiles: [".html", ".htm"],
        fields: [
          {
            key: "indent",
            label: "Indent with",
            type: "select",
            defaultValue: "2",
            choices: [
              { value: "2", label: "2 spaces" },
              { value: "4", label: "4 spaces" },
              { value: "tabs", label: "Tabs" },
            ],
          },
        ],
        run: formatting.formatHtml,
      },
    ],
  },
  {
    id: "qr-barcode",
    icon: QrCode,
    preview: { src: "/previews/qr-barcode.webm", poster: "/previews/qr-barcode.jpg" },
    title: "QR codes and barcodes",
    description: "A link, text or Wi-Fi details as a code, or a barcode from a value.",
    keywords: [
      "qr", "qr code", "barcode", "wifi", "wi-fi", "scan", "code128", "ean", "upc",
      "generator",
    ],
    utilities: [
      {
        id: "qr-text",
        label: "QR code",
        description: "A link or any text, as a scannable code.",
        input: "text",
        inputLabel: "A link or some text",
        outputKind: "image",
        fields: [
          {
            key: "errorCorrection",
            label: "Error correction",
            type: "select",
            defaultValue: "M",
            choices: [
              { value: "L", label: "Low" },
              { value: "M", label: "Medium" },
              { value: "Q", label: "Quartile" },
              { value: "H", label: "High" },
            ],
            hint: "Higher survives more damage to the printed code, at a denser pattern.",
          },
          { key: "color", label: "Colour", type: "color", defaultValue: "#000000" },
          { key: "background", label: "Background", type: "color", defaultValue: "#ffffff" },
        ],
        run: (input, options) => qr.generateQrImage(input, options),
      },
      {
        id: "qr-wifi",
        label: "Wi-Fi QR code",
        description: "Scan to join, without typing the password.",
        input: "none",
        outputKind: "image",
        fields: [
          { key: "ssid", label: "Network name", type: "text" },
          { key: "password", label: "Password", type: "text", showWhen: (v) => v.security !== "nopass" },
          {
            key: "security",
            label: "Security",
            type: "select",
            defaultValue: "WPA",
            choices: [
              { value: "WPA", label: "WPA/WPA2" },
              { value: "WEP", label: "WEP" },
              { value: "nopass", label: "Open (no password)" },
            ],
          },
          { key: "hidden", label: "Hidden network", type: "select", defaultValue: "no", choices: yesNo },
        ],
        run: qr.generateWifiQrImage,
      },
      {
        id: "barcode",
        label: "Barcode",
        description: "CODE128, EAN, UPC and more, from a value.",
        input: "text",
        inputLabel: "The value to encode",
        outputKind: "image",
        fields: [
          {
            key: "format",
            label: "Format",
            type: "select",
            defaultValue: "CODE128",
            choices: qr.barcodeFormats.map((format) => ({ value: format, label: format })),
          },
          { key: "color", label: "Colour", type: "color", defaultValue: "#000000" },
          { key: "background", label: "Background", type: "color", defaultValue: "#ffffff" },
          {
            key: "displayValue",
            label: "Show the value under the bars",
            type: "select",
            defaultValue: "yes",
            choices: yesNo,
          },
        ],
        run: (input, options) => qr.generateBarcodeImage(input, options),
      },
    ],
  },
  {
    id: "everyday",
    icon: Sparkles,
    preview: { src: "/previews/everyday.webm", poster: "/previews/everyday.jpg" },
    title: "Everyday calculators",
    description: "Fuel, a barbecue, and symbols worth copying.",
    keywords: [
      "gasoline", "ethanol", "fuel", "barbecue", "churrasco", "symbol", "emoji", "copy",
    ],
    utilities: [
      {
        id: "fuel-choice",
        label: "Gasoline or ethanol",
        description: "Which is the better buy, at today's prices.",
        input: "none",
        fields: [
          { key: "gasoline", label: "Gasoline price", type: "number", defaultValue: "6.00" },
          { key: "ethanol", label: "Ethanol price", type: "number", defaultValue: "4.00" },
        ],
        run: () => "",
        facts: misc.fuelChoiceFacts,
      },
      {
        id: "fuel-cost",
        label: "Fuel cost",
        description: "The estimated cost of a trip.",
        input: "none",
        fields: [
          { key: "distance", label: "Distance (km)", type: "number", defaultValue: "100" },
          { key: "consumption", label: "Consumption (km/L)", type: "number", defaultValue: "12" },
          { key: "price", label: "Price per litre", type: "number", defaultValue: "6.00" },
        ],
        run: () => "",
        facts: misc.fuelCostFacts,
      },
      {
        id: "barbecue",
        label: "Barbecue calculator",
        description: "Meat, charcoal, ice and drinks for the guests you have.",
        input: "none",
        fields: [
          { key: "guests", label: "Guests", type: "number", defaultValue: "10", min: 1 },
          { key: "gramsPerGuest", label: "Grams of meat per guest", type: "number", defaultValue: "400" },
        ],
        run: () => "",
        facts: misc.barbecueFacts,
      },
      {
        id: "symbols",
        label: "Symbols to copy",
        description: "Arrows, math, currency, hearts, stars, faces and punctuation.",
        input: "none",
        fields: [
          {
            key: "category",
            label: "Category",
            type: "select",
            defaultValue: "arrows",
            choices: [
              { value: "arrows", label: "Arrows" },
              { value: "math", label: "Math" },
              { value: "currency", label: "Currency" },
              { value: "hearts", label: "Hearts" },
              { value: "stars", label: "Stars" },
              { value: "faces", label: "Faces" },
              { value: "punctuation", label: "Punctuation" },
            ],
          },
        ],
        run: misc.symbolList,
      },
      {
        id: "whatsapp-link",
        label: "WhatsApp link",
        description: "A wa.me link that opens a chat with a message ready to send.",
        input: "none",
        fields: [
          { key: "phone", label: "Phone (with country code)", type: "text", placeholder: "5511999999999" },
          { key: "message", label: "Message (optional)", type: "text" },
        ],
        run: misc.whatsappLink,
      },
      {
        id: "minimum-wage",
        label: "Minimum wages",
        description: "How many minimum wages an amount represents.",
        input: "none",
        fields: [
          { key: "wage", label: "Amount", type: "number", defaultValue: "5000" },
          { key: "reference", label: "Minimum wage", type: "number", defaultValue: "1412" },
        ],
        run: () => "",
        facts: misc.minimumWageFacts,
      },
      {
        id: "first-million",
        label: "First million",
        description: "Months to reach a target, saving the same amount every month.",
        input: "none",
        fields: [
          { key: "monthly", label: "Monthly contribution", type: "number", defaultValue: "1000" },
          { key: "rate", label: "Monthly return (%)", type: "number", defaultValue: "0.8" },
          { key: "target", label: "Target", type: "number", defaultValue: "1000000" },
        ],
        run: () => "",
        facts: misc.firstMillionFacts,
      },
    ],
  },
  {
    id: "random-picks",
    icon: Dices,
    preview: { src: "/previews/random-picks.webm", poster: "/previews/random-picks.jpg" },
    title: "Random picks",
    description: "Dice, roulette, the lottery, a raffle, and plain random picks.",
    keywords: ["random", "dice", "roulette", "lottery", "raffle", "sorteio", "dado", "loteria"],
    utilities: [
      {
        id: "dice",
        label: "Roll dice",
        description: "One or more dice, any number of sides.",
        input: "none",
        fields: [
          { key: "sides", label: "Sides", type: "number", defaultValue: "6", min: 2 },
          { key: "count", label: "How many dice", type: "number", defaultValue: "1", min: 1, max: 20 },
        ],
        run: random.rollDice,
      },
      {
        id: "roulette",
        label: "Roulette",
        description: "A European wheel: 0 to 36, with its colour.",
        input: "none",
        fields: [],
        run: () => "",
        facts: random.spinRouletteFacts,
      },
      {
        id: "mega-sena",
        label: "Mega-Sena numbers",
        description: "Six unique numbers between 1 and 60.",
        input: "none",
        fields: [],
        run: () => random.megaSenaNumbers(),
      },
      {
        id: "raffle",
        label: "Raffle",
        description: "One name per line — pick the winners without repeats.",
        input: "text",
        inputLabel: "Names, one per line",
        fields: [{ key: "winners", label: "Winners", type: "number", defaultValue: "1", min: 1 }],
        run: random.raffleWinners,
      },
      {
        id: "random-numbers",
        label: "Random numbers",
        description: "A range, a count, unique or not.",
        input: "none",
        fields: [
          { key: "min", label: "Minimum", type: "number", defaultValue: "1" },
          { key: "max", label: "Maximum", type: "number", defaultValue: "100" },
          { key: "count", label: "How many", type: "number", defaultValue: "5", min: 1, max: 50 },
          {
            key: "unique",
            label: "No repeats",
            type: "select",
            defaultValue: "yes",
            choices: yesNo,
          },
        ],
        run: random.randomNumbers,
      },
      {
        id: "random-words",
        label: "Random words",
        description: "A handful of words from a category, in Portuguese.",
        input: "none",
        fields: [
          {
            key: "bank",
            label: "Category",
            type: "select",
            defaultValue: "animals",
            choices: [
              { value: "animals", label: "Animals" },
              { value: "names", label: "Names" },
              { value: "objects", label: "Objects" },
              { value: "colors", label: "Colors" },
            ],
          },
          { key: "count", label: "How many", type: "number", defaultValue: "5", min: 1, max: 20 },
        ],
        run: random.randomWords,
      },
    ],
  },
];

export function utilityGroup(id: string): UtilityGroup | undefined {
  return utilityGroups.find((group) => group.id === id);
}

export function utilityById(groupId: string, utilityId: string): Utility | undefined {
  return utilityGroup(groupId)?.utilities.find((utility) => utility.id === utilityId);
}

/** The ids of every group, which the catalog turns into cards. */
export const utilityGroupIds = utilityGroups.map((group) => group.id);
