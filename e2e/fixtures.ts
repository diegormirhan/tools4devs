import { test as base, expect } from "@playwright/test";
import { installHost, type HostOptions } from "./host";

/**
 * Every test starts on a fresh profile with the simulated host in place. A test
 * that needs the host to answer differently sets `host` with test.use().
 */
export const test = base.extend<{ host: HostOptions }>({
  host: [{ available: ["jq", "yq", "ripgrep", "fd", "oxipng", "miller", "hexyl", "tokei", "dust", "qpdf"] }, { option: true }],
  page: async ({ page, host }, use) => {
    await installHost(page, host);
    await use(page);
  },
});

export { expect };

/** Opens the command palette and runs the first match for `query`. */
export async function search(page: import("@playwright/test").Page, query: string) {
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill(query);
  await page.keyboard.press("Enter");
}
