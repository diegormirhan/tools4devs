import { describe, expect, it } from "vitest";
import {
  generateCnpj,
  generateCpf,
  generateTestCard,
  generateUuidBatch,
  isValidCardNumber,
  isValidCnpj,
  isValidCpf,
  testCardFacts,
} from "./generators";

function fact(facts: Array<[string, string]>, name: string): string | undefined {
  return facts.find(([entry]) => entry === name)?.[1];
}

describe("CPF", () => {
  it("recognises a well-known valid test number", () => {
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("rejects a number with the last digit tampered", () => {
    expect(isValidCpf("111.444.777-36")).toBe(false);
  });

  it("rejects eleven repeated digits, which pass the checksum but are not issued", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("generates numbers that validate against its own rule, every time", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(isValidCpf(generateCpf())).toBe(true);
    }
  });

  it("is formatted with the punctuation a Brazilian form expects", () => {
    expect(generateCpf()).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  });
});

describe("CNPJ", () => {
  it("recognises a well-known valid test number", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });

  it("rejects a tampered check digit", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("generates numbers that validate against its own rule, every time", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(isValidCnpj(generateCnpj())).toBe(true);
    }
  });

  it("always generates the /0001 branch", () => {
    expect(generateCnpj()).toMatch(/^\d{2}\.\d{3}\.\d{3}\/0001-\d{2}$/);
  });
});

describe("UUID batches", () => {
  it("generates as many as asked for, each one unique", () => {
    const lines = generateUuidBatch("", { count: "5" }).split("\n");
    expect(lines).toHaveLength(5);
    expect(new Set(lines).size).toBe(5);
  });

  it("stays inside a sane maximum", () => {
    expect(generateUuidBatch("", { count: "10000" }).split("\n")).toHaveLength(100);
  });
});

describe("test card numbers", () => {
  it("generates numbers that pass the Luhn check every card form runs", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const number = generateTestCard("", { network: "visa" });
      expect(isValidCardNumber(number.replace(/\s/g, ""))).toBe(true);
    }
  });

  it("uses each network's own published prefix and length", () => {
    const visa = generateTestCard("", { network: "visa" }).replace(/\s/g, "");
    expect(visa).toMatch(/^4\d{15}$/);

    const amex = generateTestCard("", { network: "amex" }).replace(/\s/g, "");
    expect(amex).toMatch(/^3[47]\d{13}$/);

    const mastercard = generateTestCard("", { network: "mastercard" }).replace(/\s/g, "");
    expect(mastercard).toMatch(/^5[1-5]\d{14}$/);
  });

  it("rejects a tampered number", () => {
    const number = generateTestCard("", { network: "visa" }).replace(/\s/g, "");
    const tampered = number.slice(0, -1) + String((Number(number.at(-1)) + 1) % 10);
    expect(isValidCardNumber(tampered)).toBe(false);
  });

  it("uses CID instead of CVV for American Express, at four digits", () => {
    const facts = testCardFacts("", { network: "amex" });
    expect(fact(facts, "CID")).toMatch(/^\d{4}$/);
  });
});
