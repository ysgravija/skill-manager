# Run Skill Manager

Skill Manager runs as a macOS app or as a local Node server in your browser. Both use the same skill catalog and reader.

## Build the macOS app

Install Node.js 22 or newer. From the repository root:

```sh
npm ci
npm run package:mac
```

On an Apple silicon Mac, open `out/Skill Manager-darwin-arm64/Skill Manager.app`. This command builds for Apple silicon and also creates `out/Skill-Manager-macOS-arm64.zip` for transfer. The app starts its own loopback server on an available port; `npm start` is not required.

The macOS app stores favorites, notes, manual usage, and app-created skills in `~/Library/Application Support/Skill Manager/`. It scans your user skill folders and this app-managed folder. The package excludes the repository's `data/` directory.

The local build has an ad hoc signature, but Apple has not notarized it. For AirDrop, send the ZIP and extract it on the receiving Mac. The recipient may see "Apple could not verify Skill Manager is free of malware." If the recipient trusts the copy, they can try to open it, then use **System Settings → Privacy & Security → Open Anyway**. See [Apple's instructions](https://support.apple.com/en-au/102445). To distribute the app without this warning, use a Developer ID Application certificate and notarization. See [Electron Forge's signing guide](https://www.electronforge.io/guides/code-signing/code-signing-macos).

To run the desktop app without packaging it, use `npm run desktop`. If your shell sets `ELECTRON_RUN_AS_NODE`, unset it for this command:

```sh
env -u ELECTRON_RUN_AS_NODE npm run desktop
```

## Run in a browser

Install Node.js 22 or newer. From the repository root, install dependencies and start the server:

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4317/`. The server listens only on `127.0.0.1`. Stop it with Control-C.

The browser version stores metadata, manual usage events, and app-created skills under `data/` by default. The repository ignores this directory. Set `SKILL_MANAGER_DATA_DIR` before `npm start` to use another directory. The macOS app does not import this data automatically.

## Choose scan roots

By default, the catalog scans user skill folders for Agents, Claude, Codex, and Cursor, plus the app-managed skill folder. When run from this repository, it also scans project skill folders here.

To replace the scan roots, set `SKILL_MANAGER_ROOTS` to a JSON array of objects with `agent` and `path` fields:

```sh
SKILL_MANAGER_ROOTS='[{"agent":"Agents","path":"/Users/you/.agents/skills"}]' npm start
```

The catalog adds the app-managed skill folder even when `SKILL_MANAGER_ROOTS` omits it. Set `PORT` to change the browser build's port. These environment variables affect the process you start; they do not change stored skill files.

## Check a change

Run the HTTP integration tests from the repository root:

```sh
npm test
```

The tests create temporary skill folders. They check symlink deduplication, file-tree access, request validation, skill creation, and tracking data after a server restart.
