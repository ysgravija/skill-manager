# Skill Manager verification map

This is the maintained map of user-facing browser behavior. Start with [the verification skill](../SKILL.md), then follow the relevant feature file. The real HTTP API is used only to inspect durable results after a browser action.

## Baseline

The launch helper provides one active `Verification Seed` skill, one `references/guide.md` file, no favorites, no manual uses, and empty notes. Run the doctor before mutating it. Each feature can use a fresh isolated launch. Keep evidence outside `RUN_DIR` so cleanup cannot remove it.

## Proof contract

Capture the visible action and resulting state through CUA, plus the persisted file when the feature writes one. Use the named entry point in each feature file. Report an untested sub-feature as untested; passing another route does not cover it.

## Features

- [Find skills](find-skills.md): search, source and status filters, and views.
- [Read a skill](read-skill.md): Markdown preview, source, and supporting references.
- [Track a skill](track-skill.md): favorites, notes, archive status, and manual usage.
- [Create and rescan](create-and-rescan.md): app-managed creation and discovery after file changes.
- [Appearance](appearance.md): light and black themes.
