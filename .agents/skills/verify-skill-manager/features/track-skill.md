# Track a skill

Tracking lets the user favorite a skill, keep private notes, archive it in this library, and record use manually.

## Sub-features

- `track-favorite` adds and removes a favorite.
- `track-notes` saves and reloads private notes.
- `track-status` archives and restores a skill in the library.
- `track-usage` records a manual use and shows it in Activity.

## How to get to it (user POV)

- Use the star button on the Library row or **Add favorite** in the reader.
- Open **Verification Seed**, expand **Details**, and edit **Private notes** or **Library status**.
- Choose **Log use** in the reader, then **Activity** in the top navigation.

## Driving it with CUA browser

Preconditions: launch a fresh fixture, pass doctor, and open `READY_URL` in a new CUA tab.

- **Favorite:** click the Library row's `getByRole('button', { name: 'Add to favorites' })`. Choose **Favorites**; the seed appears. Inspect `$RUN_DIR/data/metadata.json` for `favorite: true`.
- **Notes:** open the seed, expand **Details**, fill `getByRole('textbox', { name: 'Private notes' })` with `Review before use`, and choose **Save**. Close and reopen the reader; the text remains. Inspect `metadata.json`.
- **Status:** in **Details**, set `getByRole('combobox', { name: 'Library status' })` to `archived`. The active Library view hides the seed. Set the toolbar **Filter by status** to `archived`; the row appears. Inspect `metadata.json` for `status: archived`.
- **Use:** in the reader choose **Log use**, then close it and open **Activity**. Expect **Verification Seed** and **Use recorded manually**. Inspect `$RUN_DIR/data/usage-events.json` for one event with `source: manual`.

## Gotchas

- Archiving changes this manager's view; it does not remove the fixture file.
- Notes require the **Save** button. A filled textbox alone is not persisted.
- The baseline has zero uses; a recorded use is an explicit click, not agent telemetry.
