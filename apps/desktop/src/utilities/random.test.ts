import { describe, expect, it } from "vitest";
import { megaSenaNumbers, raffleWinners, randomNumbers, rollDice, spinRouletteFacts } from "./random";

describe("dice", () => {
  it("rolls within range", () => {
    const rolls = rollDice("", { sides: "6", count: "5" })
      .split(", ")
      .map(Number);
    expect(rolls).toHaveLength(5);
    for (const roll of rolls) {
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
  });
});

describe("roulette", () => {
  it("returns a number from 0 to 36 with a matching colour", () => {
    const facts = spinRouletteFacts("", {});
    const number = Number(facts[0]![1]);
    expect(number).toBeGreaterThanOrEqual(0);
    expect(number).toBeLessThanOrEqual(36);
    expect(["Red", "Black", "Green"]).toContain(facts[1]![1]);
  });
});

describe("mega-sena", () => {
  it("draws six unique, sorted numbers between 1 and 60", () => {
    const numbers = megaSenaNumbers()
      .split(" - ")
      .map(Number);
    expect(numbers).toHaveLength(6);
    expect(new Set(numbers).size).toBe(6);
    for (const value of numbers) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(60);
    }
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });
});

describe("raffle", () => {
  it("picks winners without repeating a name", () => {
    const winners = raffleWinners("Ana\nBruno\nCarla\nDiego", { winners: "3" }).split("\n");
    expect(winners).toHaveLength(3);
    expect(new Set(winners).size).toBe(3);
    for (const winner of winners) expect(["Ana", "Bruno", "Carla", "Diego"]).toContain(winner);
  });

  it("rejects an empty list", () => {
    expect(() => raffleWinners("", { winners: "1" })).toThrow();
  });
});

describe("random numbers", () => {
  it("respects the range and stays unique when asked", () => {
    const values = randomNumbers("", { min: "1", max: "10", count: "5", unique: "yes" })
      .split(", ")
      .map(Number);
    expect(new Set(values).size).toBe(5);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it("rejects asking for more unique numbers than the range holds", () => {
    expect(() => randomNumbers("", { min: "1", max: "3", count: "5", unique: "yes" })).toThrow();
  });
});
