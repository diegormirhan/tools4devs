import { describe, expect, it } from "vitest";
import {
  bmiFacts,
  convertUnit,
  fertileWindowFacts,
  financingFacts,
  fractionFacts,
  gestationalFacts,
  percentageFacts,
  ruleOfThree,
  savingsFacts,
} from "./math";

function fact(facts: Array<[string, string]>, name: string): string | undefined {
  return facts.find(([entry]) => entry === name)?.[1];
}

describe("percentage", () => {
  it("computes A% of B by default", () => {
    expect(fact(percentageFacts("", { a: "20", b: "50" }), "Result")).toBe("20% of 50 is 10");
  });

  it("computes what percent A is of B", () => {
    expect(fact(percentageFacts("", { a: "10", b: "50", mode: "whatPercent" }), "Result")).toBe(
      "10 is 20% of 50",
    );
  });

  it("computes the percentage change from A to B", () => {
    expect(fact(percentageFacts("", { a: "50", b: "75", mode: "changeFrom" }), "Result")).toBe(
      "50% change, from 50 to 75",
    );
  });

  it("refuses to divide by a zero base", () => {
    expect(() => percentageFacts("", { a: "10", b: "0", mode: "whatPercent" })).toThrow();
  });
});

describe("rule of three", () => {
  it("solves the classic simple proportion", () => {
    // 5 workers take 10 days; 10 workers... not proportional, use a scaling
    // example instead: if 2 costs 10, 5 costs 25.
    expect(ruleOfThree("", { a: "2", b: "10", c: "5" })).toBe("25");
  });

  it("refuses a zero first value", () => {
    expect(() => ruleOfThree("", { a: "0", b: "10", c: "5" })).toThrow();
  });
});

describe("fractions", () => {
  it("adds and simplifies", () => {
    const facts = fractionFacts("", { n1: "1", d1: "2", n2: "1", d2: "4", operation: "add" });
    expect(fact(facts, "Result")).toBe("3/4");
  });

  it("multiplies", () => {
    const facts = fractionFacts("", { n1: "2", d1: "3", n2: "3", d2: "4", operation: "multiply" });
    expect(fact(facts, "Result")).toBe("1/2");
  });

  it("divides", () => {
    const facts = fractionFacts("", { n1: "1", d1: "2", n2: "1", d2: "4", operation: "divide" });
    expect(fact(facts, "Result")).toBe("2/1");
  });

  it("refuses a zero denominator", () => {
    expect(() => fractionFacts("", { n1: "1", d1: "0", n2: "1", d2: "2" })).toThrow();
  });
});

describe("unit conversion", () => {
  it("converts temperature both ways", () => {
    expect(convertUnit("", { category: "temperature", value: "0", from: "c", to: "f" })).toBe("32");
    expect(convertUnit("", { category: "temperature", value: "212", from: "f", to: "c" })).toBe("100");
  });
});

describe("savings simulator", () => {
  it("returns zero interest when the rate is zero", () => {
    const facts = savingsFacts("", { monthly: "100", months: "12", rate: "0" });
    expect(fact(facts, "Interest earned")).toBe(
      (0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    );
  });

  it("earns interest when a rate is given", () => {
    const facts = savingsFacts("", { monthly: "100", months: "12", rate: "1" });
    const interest = Number(
      fact(facts, "Interest earned")?.replace(/[^\d,.-]/g, "").replace(".", "").replace(",", "."),
    );
    expect(interest).toBeGreaterThan(0);
  });
});

describe("financing (Price table)", () => {
  it("splits an interest-free loan evenly", () => {
    const facts = financingFacts("", { principal: "1200", months: "12", rate: "0" });
    expect(fact(facts, "Monthly payment")).toBe(
      (100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    );
  });

  it("refuses a term outside the sane range", () => {
    expect(() => financingFacts("", { principal: "1000", months: "0", rate: "1" })).toThrow();
  });
});

describe("BMI", () => {
  it("categorises a healthy value", () => {
    const facts = bmiFacts("", { weight: "70", height: "175" });
    expect(fact(facts, "Category")).toBe("Healthy range");
  });

  it("refuses a non-positive height", () => {
    expect(() => bmiFacts("", { weight: "70", height: "0" })).toThrow();
  });
});

describe("gestational age", () => {
  it("counts weeks and days since the last period", () => {
    const facts = gestationalFacts("", { lastPeriod: "2026-01-01", today: "2026-02-12" });
    expect(fact(facts, "Gestational age")).toBe("6 weeks, 0 days");
  });
});

describe("fertile window", () => {
  it("estimates ovulation 14 days before the next period", () => {
    const facts = fertileWindowFacts("", { lastPeriod: "2026-01-01", cycleLength: "28" });
    expect(fact(facts, "Estimated ovulation")).toBe("2026-01-15");
  });

  it("refuses a cycle length outside the normal range", () => {
    expect(() => fertileWindowFacts("", { lastPeriod: "2026-01-01", cycleLength: "5" })).toThrow();
  });
});
