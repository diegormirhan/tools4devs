# Build scripts

- `tool-manifest/`: validates `tooling/tools.json` against its schema and the
  cross-entry rules the schema cannot express, and audits the capabilities each
  tool claims.
- `tools/`: stages the tools that ship inside the installer.
- `notices/`: writes `FRONTEND-NOTICES.txt` for the npm packages and fonts compiled
  into the interface, and stops the build if one of them is not permissive.
- `component-installation/`: resolves what a tool still needs, and reads back
  what is already installed.
- `execution/`: turns a typed operation request into an executable name and an
  argument array. It never spawns a process and never builds a shell string;
  the Rust host consumes the same contract.
- `release/`: writes the `latest.json` a release needs for the app to update
  itself.

Everything here runs on Node with no external runtime.
