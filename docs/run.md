# Run Skill Manager

Skill Manager runs as a local Node server in your browser. It scans local skill folders and keeps its tracking data separate from those folders.

Install Node.js 22 or newer. From the repository root, install dependencies and start the server:

```sh
npm ci
npm start
```

Open `http://127.0.0.1:4317/`. The server listens only on `127.0.0.1`. Stop it with Control-C.

The app stores metadata, manual usage events, and app-created skills under `data/` by default. The repository ignores this directory. Set `SKILL_MANAGER_DATA_DIR` before `npm start` to use another directory.

## Choose scan roots

By default, the catalog scans user skill folders for Agents, Claude, Codex, and Cursor, project skill folders in this repository, and the app-managed skill folder.

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
