# Local skill inventory

Skill Manager reads skill folders on this Mac and stores tracking data separately. The separation matters because the app can show the same skill through several agent folders without changing the skill itself.

## Discovery and identity

`SkillCatalog` in `src/catalog.mjs` scans the configured roots for `SKILL.md`. The default roots cover user skill folders for Agents, Claude, Codex, and Cursor, plus the app-managed skill folder. When you run from this repository, the defaults also include its project skill folders. A root can contain nested directories or symlinks.

The catalog resolves each `SKILL.md` to its canonical path. It hashes that path to produce a skill ID, then keeps every observed agent location on the same skill. Two agent locations that point to one canonical file appear as one library entry. The catalog parses `name` and `description` from the file's frontmatter and keeps the original content for the reader.

For each skill, the scanner also builds a folder tree. The tree indexes regular files but skips hidden entries and symbolic links. `getFile()` reads only a path that the scanner indexed and checks that its canonical path remains under the skill folder. This boundary lets the reader open references without accepting arbitrary filesystem paths from a URL.

## Tracking data

The app stores favorite flags, notes, and active or archived status in `metadata.json`. It stores explicit **Log use** actions in `usage-events.json`. App-created skills live under `skills/<slug>/SKILL.md` in the same data directory. Existing skill folders stay read-only.

`SkillCatalog` serializes writes through `writeQueue`. Each write creates a temporary JSON file, syncs it, and renames it over the previous file. A restart loads the saved metadata and events, then rescans the skill roots.

The browser version stores tracking data in the repository's `data/` directory by default. The macOS app uses its Application Support directory. See [Run Skill Manager](run.md) for both locations.

## HTTP and reader

`src/server.mjs` owns the local HTTP API and serves the browser assets. It validates write bodies and restricts requests to the local origin. The browser version uses port `4317` by default; the macOS app chooses an available port. See the [Local HTTP API](api.md) for routes and limits.

`public/app.js` renders the library and opens the skill reader. The reader loads a skill's file tree from its detail response, then requests supporting files through the indexed-file endpoint. `public/markdown.js` uses Marked for Markdown and DOMPurify to sanitize the resulting HTML. The reader offers formatted preview and raw source. It does not run code from skill files or display embedded images.

The app does not collect agent telemetry. `usageCount` and `lastUsedAt` describe only actions the user recorded with **Log use**.
