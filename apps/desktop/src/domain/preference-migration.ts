const preferenceNames = ["language", "theme-preference", "jobs", "sidebar", "destination", "concurrency", "conflict"];

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function migratePreferences(storage: PreferenceStorage): void {
  const saved = preferenceNames.map((name) => ({
    oldKey: `toolhaven.${name}`,
    newKey: `tools4devs.${name}`,
    value: storage.getItem(`toolhaven.${name}`),
    current: storage.getItem(`tools4devs.${name}`),
  }));
  for (const preference of saved) {
    if (preference.value !== null && preference.current === null) {
      storage.setItem(preference.newKey, preference.value);
    }
  }
  // Remove old keys only after every new value has been persisted successfully.
  for (const preference of saved) {
    if (preference.value !== null) storage.removeItem(preference.oldKey);
  }
}
