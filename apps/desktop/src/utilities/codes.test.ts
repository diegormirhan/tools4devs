import { describe, expect, it } from "vitest";
import {
  base64Convert,
  binaryConvert,
  convertBase,
  dateToTimestamp,
  decodeJwt,
  fromRoman,
  generatePassword,
  hashText,
  htmlConvert,
  morseConvert,
  numberToWordsPt,
  romanConvert,
  timestampToDate,
  toRoman,
} from "./codes";

describe("Base64", () => {
  it("round-trips UTF-8 text, not just Latin-1", () => {
    const encoded = base64Convert("café ☕", { direction: "encode" });
    expect(encoded).toBe("Y2Fmw6kg4piV");
    expect(base64Convert(encoded, { direction: "decode" })).toBe("café ☕");
  });

  it("rejects text that is not valid Base64", () => {
    expect(() => base64Convert("not base64!!", { direction: "decode" })).toThrow();
  });
});

describe("HTML entities", () => {
  it("escapes the five reserved characters", () => {
    expect(htmlConvert(`<a href="x">it's & more</a>`, { direction: "encode" })).toBe(
      "&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; more&lt;/a&gt;",
    );
  });

  it("decodes named and numeric entities", () => {
    expect(htmlConvert("&lt;b&gt;&amp;&#65;&#x42;", { direction: "decode" })).toBe("<b>&AB");
  });
});

describe("binary", () => {
  it("round-trips through 8-bit groups", () => {
    const encoded = binaryConvert("Hi", { direction: "encode" });
    expect(encoded).toBe("01001000 01101001");
    expect(binaryConvert(encoded, { direction: "decode" })).toBe("Hi");
  });
});

describe("Morse", () => {
  it("encodes and decodes a short phrase", () => {
    const morse = morseConvert("SOS", { direction: "encode" });
    expect(morse).toBe("... --- ...");
    expect(morseConvert(morse, { direction: "decode" })).toBe("sos");
  });
});

describe("hashes", () => {
  // Known vectors for the empty string and "abc", published by the standard.
  it("matches the published MD5 test vectors", async () => {
    expect(await hashText("", { algorithm: "md5" })).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(await hashText("abc", { algorithm: "md5" })).toBe("900150983cd24fb0d6963f7d28e17f72");
  });
});

describe("JWT", () => {
  // header {"alg":"HS256","typ":"JWT"}, payload {"sub":"1234567890","name":"John Doe","iat":1516239022}
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

  it("decodes the header and payload without verifying the signature", () => {
    const decoded = decodeJwt(token);
    expect(decoded).toContain('"alg": "HS256"');
    expect(decoded).toContain('"name": "John Doe"');
  });

  it("rejects a string with no dots at all", () => {
    expect(() => decodeJwt("not-a-jwt")).toThrow();
  });
});

describe("passwords", () => {
  it("generates a password of the requested length, from the pools asked for", () => {
    const password = generatePassword("", { length: "20", lower: "yes", upper: "no", digits: "no", symbols: "no" });
    expect(password).toHaveLength(20);
    expect(password).toMatch(/^[a-z]+$/);
  });

  it("has nothing to draw from when every pool is turned off", () => {
    expect(generatePassword("", { lower: "no", upper: "no", digits: "no", symbols: "no" })).toBe("");
  });
});

describe("Roman numerals", () => {
  it("converts both ways, including the subtractive forms", () => {
    expect(toRoman(1994)).toBe("MCMXCIV");
    expect(fromRoman("MCMXCIV")).toBe(1994);
  });

  it("rejects a numeral written with an invalid grouping", () => {
    expect(() => fromRoman("IIII")).toThrow();
  });

  it("stays inside the range Roman numerals actually cover", () => {
    expect(() => romanConvert("4000", { direction: "encode" })).toThrow();
  });
});

describe("number base conversion", () => {
  it("converts decimal to the other three bases", () => {
    expect(convertBase("255", { from: "decimal", to: "hex" })).toBe("FF");
    expect(convertBase("255", { from: "decimal", to: "binary" })).toBe("11111111");
    expect(convertBase("255", { from: "decimal", to: "octal" })).toBe("377");
  });

  it("reads hex or binary back to decimal", () => {
    expect(convertBase("FF", { from: "hex", to: "decimal" })).toBe("255");
  });
});

describe("numbers in Portuguese", () => {
  it("writes small numbers the way a person would say them", () => {
    expect(numberToWordsPt(21)).toBe("vinte e um");
    expect(numberToWordsPt(100)).toBe("cem");
    expect(numberToWordsPt(101)).toBe("cento e um");
  });

  it("writes the scale words with the right plural", () => {
    expect(numberToWordsPt(1000)).toBe("mil");
    expect(numberToWordsPt(2000)).toBe("dois mil");
    expect(numberToWordsPt(1_000_000)).toBe("um milhão");
    expect(numberToWordsPt(2_000_000)).toBe("dois milhões");
  });

  it("handles zero and negative numbers", () => {
    expect(numberToWordsPt(0)).toBe("zero");
    expect(numberToWordsPt(-5)).toBe("menos cinco");
  });
});

describe("timestamps", () => {
  it("converts a Unix timestamp in seconds to an ISO date", () => {
    expect(timestampToDate("0", { unit: "seconds" })).toBe("1970-01-01T00:00:00.000Z");
  });

  it("converts a date string back to a Unix timestamp", () => {
    expect(dateToTimestamp("1970-01-01T00:00:00Z")).toBe("0");
  });

  it("rejects a date it cannot parse", () => {
    expect(() => dateToTimestamp("not a date")).toThrow();
  });
});
