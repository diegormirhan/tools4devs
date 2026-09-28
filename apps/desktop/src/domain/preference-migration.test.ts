import { describe, expect, it } from "vitest";
import { migratePreferences } from "./preference-migration";

describe("tools4devs preference migration", () => {
  it("preserves all saved values and history under the new names", () => {
    const values = { language: "pt", "theme-preference": "light", jobs: '[{"id":"saved-job"}]', sidebar: "collapsed", destination: "C:\\Exports", concurrency: "3", conflict: "overwrite" };
    for (const [key, value] of Object.entries(values)) localStorage.setItem(`toolhaven.${key}`, value);
    migratePreferences(localStorage);
    for (const [key, value] of Object.entries(values)) {
      expect(localStorage.getItem(`tools4devs.${key}`)).toBe(value);
      expect(localStorage.getItem(`toolhaven.${key}`)).toBeNull();
    }
    migratePreferences(localStorage);
    expect(localStorage.getItem("tools4devs.jobs")).toBe(values.jobs);
  });

  it("keeps newer settings when both namespaces exist", () => {
    localStorage.setItem("toolhaven.language", "pt");
    localStorage.setItem("tools4devs.language", "en");
    localStorage.setItem("other-app.setting", "untouched");
    migratePreferences(localStorage);
    expect(localStorage.getItem("tools4devs.language")).toBe("en");
    expect(localStorage.getItem("other-app.setting")).toBe("untouched");
  });

  it("keeps every old value if a storage write fails", () => {
    localStorage.setItem("toolhaven.language", "pt");
    localStorage.setItem("toolhaven.jobs", "saved-history");
    const failingStorage = {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        if (key === "tools4devs.jobs") throw new Error("Storage full");
        localStorage.setItem(key, value);
      },
      removeItem: (key: string) => localStorage.removeItem(key),
    };
    expect(() => migratePreferences(failingStorage)).toThrow("Storage full");
    expect(localStorage.getItem("toolhaven.language")).toBe("pt");
    expect(localStorage.getItem("toolhaven.jobs")).toBe("saved-history");
    migratePreferences(localStorage);
    expect(localStorage.getItem("tools4devs.jobs")).toBe("saved-history");
  });
});
