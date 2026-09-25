# Find skills

Find skills narrows the library and lets the user move between all skills, favorites, and recorded activity.

## Sub-features

- `find-search` finds a skill by name or description and shows an empty state for a miss.
- `find-source` filters by source.
- `find-status` switches among active, archived, and any status.
- `find-views` switches Library, Favorites, and Activity.

## How to get to it (user POV)

- Enter text in **Search skills** on the Library page.
- Choose a source chip or the **Filter by status** menu.
- Choose **Library**, **Favorites**, or **Activity** in the top navigation.

## Driving it with CUA browser

Preconditions: launch a fresh fixture and pass doctor. Open its `READY_URL` in a new CUA tab.

- **Search match:** `await tab.playwright.getByRole('searchbox', { name: 'Search skills' }).fill('Verification Seed')`; inspect `await tab.getAXState()` for the row.
- **Search miss:** fill `absent-verify-term`; expect **No skills match these filters**. Clear the searchbox to restore the row.
- **Source:** click `tab.playwright.getByRole('button', { name: 'Verification', exact: true })`; expect the chip pressed and the seed still listed. Choose **All sources** to clear.
- **Status:** use `tab.playwright.getByLabel('Filter by status').selectOption('archived')`; expect no active seed. Select `active` to restore it. For a populated archived result, first archive through [Track a skill](track-skill.md).
- **Views:** choose the top **Favorites** and **Activity** buttons. The baseline shows their empty states. Return to **Library** and see the seed row again.

## Gotchas

- Search and filters affect the current view; clear both before judging an empty state.
- The baseline has no favorites or activity. Use the tracking recipe to populate those views.
