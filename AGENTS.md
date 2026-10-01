# Agent instructions

## Testing

- Never write unit tests after you write code.
- Highly prefer E2E tests as the sole testing mechanism. Use them to verify complex features work. At the end of E2E tests, produce a verifiable and repeatable artifact.
- If you must test a system in isolation, first write down all the ways it could fail, then write the code.

### How the E2E tests work here

`npm run test:e2e` runs `e2e/*.spec.ts` with Playwright: the real interface in Chromium, over a simulated Tauri host (`e2e/host.ts`) that answers the same commands, events and plugin calls the Rust side does and records every call. Each run leaves its artifact in `e2e-report/`:

- `e2e-report/html/index.html`: the report, with a trace and a final screenshot for every test
- `e2e-report/results.json`: the same results, for a machine to compare between runs
- `e2e-report/artifacts/`: the traces and screenshots themselves

On Windows, run `npx playwright install chromium` once. Elsewhere, set `CHROMIUM_PATH` to an existing Chromium.

A unit test earns its place only when it catches a real bug these E2E tests would miss: logic too wide for a browser run to sweep (manifest and release rules, calculators, parsers, migrations), or code the browser never reaches (the release scripts, the Rust host).
