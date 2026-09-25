---
name: verify-skill-manager
description: Drive Skill Manager's local browser UI against an isolated skill library when changing or checking user-facing behavior.
---

# Verify Skill Manager

Use this skill to prove the browser app works through its visible controls. Read [the feature map](features/README.md) and the feature file before driving. The HTTP API is a secondary check for saved state; it does not replace browser actions. Do not use an already-open Skill Manager tab or the repository's `data/` directory.

## Launch

From the repository root, run `npm ci` if dependencies are absent. Start an isolated instance in a terminal session that you can later interrupt:

```sh
node .agents/skills/verify-skill-manager/scripts/start.mjs
```

The executable helper prints `RUN_DIR=/...` and `READY_URL=http://127.0.0.1:<port>` only after the server is listening. Keep that terminal session open. It creates one `Verification Seed` skill with `references/guide.md`, a separate app data directory, and an OS-assigned loopback port. Each launch has its own fixture and data, so concurrent runs can coexist. Copy the printed values into `RUN_DIR` and `READY_URL` for subsequent commands; never substitute port `4317` or drive another instance.

## Doctor

Whenever the browser looks wrong, first run this read-only check with the `RUN_DIR` printed by your launch:

```sh
node .agents/skills/verify-skill-manager/scripts/doctor.mjs "$RUN_DIR"
```

Require `HEALTHY`, the expected URL and data directory, and `skills=1` before the first mutation. The helper checks the recorded process, the HTTP response, and the fixture's canonical path. After creating a skill, the one-skill check will fail by design; use it before mutating the baseline, or relaunch for a fresh baseline.

## Drive

Use the `mcp__cua_repl` browser interface. Open a **new** Chrome tab at the printed `READY_URL`:

```js
var tab = await cua.createBrowserTab('chrome', READY_URL, { sessionName: '🧪 Skill Manager verification' });
```

The initial accessibility state must show `Skill Manager`, `Verification Seed`, and one skill. Use `tab.playwright.getByRole(...)`, `getByLabel(...)`, or the app's stable IDs from the feature files. After each action, inspect `await tab.getAXState()` or `await tab.playwright.domSnapshot()` before choosing the next action. The app has no login. Other endpoints live in [the API reference](../../../docs/api.md), but browser actions are the proof path.

## Evidence

Before driving, create a proof directory outside the disposable run directory and write its path down:

```sh
EVIDENCE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/skill-manager-proof-XXXXXX")
printf '%s\n' "$EVIDENCE_DIR"
```

Capture the before state, the user action, and the resulting UI state in the CUA transcript with `tab.getAXState()`; use `tab.getScreenshot()` when visual layout matters. Name the feature ID and entry point in a short `$EVIDENCE_DIR/steps.md` note. For a mutation, also save a read-only view of its durable side effect, such as `metadata.json`, `usage-events.json`, or an app-created `SKILL.md`, under this proof directory. A toast alone is insufficient. For a reader flow, save the referenced file path and the rendered heading observed in the browser. Mocks are unnecessary: the fixture uses the real scanner, server, and browser UI. Do not use API writes or internal state setters as a substitute for a user action.

## Cleanup

Close only the tab created for this run with `await tab.close()`. Send Control-C to the terminal session that ran `start.mjs` and wait for it to exit. Then remove only that run's scratch data:

```sh
node .agents/skills/verify-skill-manager/scripts/cleanup.mjs "$RUN_DIR"
```

The helper refuses to remove the run directory while its recorded process is alive or if the path is outside the verification scratch area. Never kill by process name, use an old PID file, or remove `EVIDENCE_DIR`. Confirm that `$EVIDENCE_DIR/steps.md` and its saved side-effect files still exist after cleanup.

## Helpers

- `node .agents/skills/verify-skill-manager/scripts/start.mjs` is executable and starts the isolated server fixture.
- `node .agents/skills/verify-skill-manager/scripts/doctor.mjs "$RUN_DIR"` is executable and checks that fixture without changing it.
- `node .agents/skills/verify-skill-manager/scripts/cleanup.mjs "$RUN_DIR"` is executable and removes only stopped fixture data.
