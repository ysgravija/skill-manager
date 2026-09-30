# Local HTTP API

The Node server binds to `127.0.0.1`. The browser version uses port `4317` unless `PORT` sets another port; the macOS app chooses an available port when it starts.

All API responses use JSON. Write requests require `Content-Type: application/json` and accept bodies up to 64 KiB. The server rejects requests with a non-local `Host`, a foreign `Origin`, or a cross-site API request.

## Skill resources

| Method | Path | Result |
| --- | --- | --- |
| `GET` | `/api/skills` | Skill summaries, library statistics, and recent manual usage events. |
| `GET` | `/api/skills/:id` | One skill, including its `SKILL.md` content and file tree. |
| `GET` | `/api/skills/:id/files?path=:relativePath` | Text preview for an indexed file in the skill folder. |
| `POST` | `/api/skills` | Create a skill under the app-managed `skills/` directory. |
| `PATCH` | `/api/skills/:id` | Change the skill's favorite flag, private notes, or library status. |
| `POST` | `/api/skills/:id/usage` | Record one manual use. |
| `POST` | `/api/rescan` | Scan the configured roots again and return the skill count. |

Each `:id` is the SHA-256 hash of the canonical `SKILL.md` path. Symlinked locations that resolve to the same file share an ID.

### `GET /api/skills`

The response contains `skills`, `stats`, and `activity`. Each skill summary has its parsed name and description, canonical path, agent locations, modification time, file count, favorite flag, notes, status, usage count, and last recorded use. Summaries omit `content` and `files`.

`stats.recordedUses` counts explicit **Log use** actions. It does not measure agent sessions or automatic skill use.

### `GET /api/skills/:id`

The detail response adds `content`, the original `SKILL.md` text, and `files`, a nested array of file and directory nodes. Each node has `name`, `path`, and `type`. Directory nodes also have `children`.

### `GET /api/skills/:id/files`

Pass one `path` query parameter with a path from the skill's `files` tree. The response has `path`, `previewable`, and `content`. For an unsupported or oversized file, `previewable` is `false` and `content` is `null`.

The scanner indexes regular files within the skill folder. It skips hidden entries, symbolic links, and common build directories. It scans at most eight directory levels and 500 files per skill. Text previews are limited to supported extensions and 512 KiB. The endpoint rejects paths outside the index.

### `POST /api/skills`

The JSON body requires `name`, `slug`, `description`, and `instructions`. `slug` uses lowercase letters, digits, and internal hyphens. The server creates `skills/<slug>/SKILL.md` under the app data directory and returns the new skill. A duplicate slug returns `409`.

### `PATCH /api/skills/:id`

The JSON body can contain `favorite` as a Boolean, `notes` as a string, and `status` as `active` or `archived`. Include at least one field. Archiving changes only the library view; it does not disable the skill in an agent.

### `POST /api/skills/:id/usage` and `POST /api/rescan`

Send `{}` as the JSON body. A usage request returns the new event with `source: "manual"`. A rescan returns `{ "scanned": number }`.

## Errors

Errors use `{ "error": "message" }`. Invalid input or JSON returns `400`; an unknown skill or file returns `404`; a duplicate slug returns `409`. An unsupported content type returns `415`, and an oversized body returns `413`. A request from outside the local origin returns `403`.
