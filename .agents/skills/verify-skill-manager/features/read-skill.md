# Read a skill

The reader presents `SKILL.md`, its file hierarchy, a formatted Markdown preview, and the original source.

## Sub-features

- `read-open` opens the skill from its library row.
- `read-preview` renders Markdown instructions.
- `read-source` shows the original Markdown text.
- `read-reference` opens an indexed reference through the tree or an in-document link.

## How to get to it (user POV)

- Choose **Verification Seed** in the Library table.
- In the reader, choose **SKILL.md**, **Preview**, or **Source**.
- Choose `references/guide.md` in the file tree, or **reference guide** in the document.

## Driving it with CUA browser

Preconditions: launch a fresh fixture, pass doctor, and open `READY_URL` in a new CUA tab.

- **Open:** `await tab.playwright.getByRole('button', { name: 'Verification Seed' }).click()`; the **Skill details** dialog shows the heading and `SKILL.md`.
- **Preview:** inspect `await tab.getAXState()` for **Verification Seed** and the **reference guide** link in the document.
- **Source:** `await tab.playwright.getByRole('button', { name: 'Source', exact: true }).click()`; the visible document contains `# Verification Seed` and the Markdown link syntax.
- **Reference through tree:** choose **Preview**, then click `tab.playwright.locator('[data-file-path="references/guide.md"]')`; expect `references/guide.md` in the reading toolbar and **Reference guide** in the document.
- **Reference through link:** choose `SKILL.md` in the tree, then the **reference guide** link in the preview; expect the same reference content.

## Gotchas

- The file tree labels contain basenames, so use the stable `data-file-path` for `references/guide.md`.
- The reference link is meaningful in Preview. Source shows Markdown text instead of a clickable link.
- Opening a file is a read-only flow. Preserve browser state evidence and the fixture reference text; do not infer success from the HTTP endpoint alone.
