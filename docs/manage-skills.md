# Manage a skill

Open Skill Manager and use **Search skills** to find a skill by name, description, source, or path. Use the source and status filters to narrow the list.

## Read instructions and references

1. Select a skill in the library.
2. Select `SKILL.md` or a supporting file from the file tree.
3. For a Markdown file, use **Preview** to read the formatted document. Use **Source** to see its original text.

Links to indexed files in the same skill folder open in the reader. The reader shows scripts and configuration files as text when their file type is supported. It does not display embedded images.

## Save personal tracking data

Select **Add favorite** to place the skill in the **Favorites** view. Open **Details** to add private notes or change the library status. Select **Save** after you edit notes.

To hide a skill from the default active list, set its status to **Archived**. Archiving does not remove or disable the skill in an agent. Set the status back to **Active** to restore it to the default list.

Select **Log use** when you want to record that you used the skill. The **Activity** view shows these manual records. Skill Manager does not infer use from agent sessions.

## Add a skill managed by the app

1. Select **New skill**.
2. Enter a name, a lowercase folder slug, an optional description, and instructions.
3. Select **Create skill**.

Skill Manager writes the new `SKILL.md` under its data directory. It does not install the skill into another agent. See [Run Skill Manager](run.md) for each version's data directory.

If you change a skill file outside the app, select **Rescan library** to refresh the list and file tree.
