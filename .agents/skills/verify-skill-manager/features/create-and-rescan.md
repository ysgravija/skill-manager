# Create and rescan

The user can create an app-managed skill and refresh the library after source files change.

## Sub-features

- `create-open` opens and cancels the New skill dialog.
- `create-save` writes a new skill and opens it in the reader.
- `create-duplicate` reports a slug collision without overwriting the file.
- `rescan-files` refreshes the file tree after an external file change.

## How to get to it (user POV)

- Choose **New skill** in the top bar, fill the form, then choose **Create skill** or **Cancel**.
- Choose **Rescan library** above the table after changing a skill file outside the app.

## Driving it with CUA browser

Preconditions: launch a fresh fixture, pass doctor, and open `READY_URL` in a new CUA tab.

- **Open and cancel:** click `getByRole('button', { name: 'New skill' })`, then **Cancel**. The dialog closes and no new `skills/` folder appears under `$RUN_DIR/data/`.
- **Create:** reopen the dialog. Fill **Name** with `Verification Draft`, **Folder slug** with `verification-draft`, **Description** with `Created through the browser`, and **Instructions** with `# Verification Draft`. Click **Create skill**. Expect the reader heading, a new Library row, and `$RUN_DIR/data/skills/verification-draft/SKILL.md` with the entered text.
- **Duplicate:** close the reader, reopen **New skill**, and submit the same slug. Expect an error. Compare the saved file with the previous copy; it must be unchanged.
- **Rescan:** add `references/new.md` under `$RUN_DIR/roots/verification-seed/` from the terminal, then click **Rescan library**. Open **Verification Seed** and expect `new.md` in its file tree.

## Gotchas

- The creation form permits an empty description but always submits a string.
- Creating a skill changes the catalog count, so the baseline doctor check deliberately fails afterward.
- Rescan observes files under the disposable fixture only. Never change a user's real skill files for verification.
