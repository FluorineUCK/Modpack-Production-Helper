# Plugin Setup

## Modpack Production Helper

The first-party plugin package is tracked in:

```text
obsidian-plugin/
```

Copy that folder into your vault as:

```text
<your vault>/.obsidian/plugins/modpack-production-helper/
```

The installed plugin folder should contain:

```text
manifest.json
main.js
styles.css
README.md
```

Restart Obsidian or reload plugins, then enable **Modpack Production Helper** in Community Plugins.

Available commands:

```text
Modpack Production Helper: Import from material folder
Modpack Production Helper: Find item paths
Modpack Production Helper: Track production from item A to B
```

This plugin is the preferred workflow if you want to use the vault without running Node.js commands manually. The Node scripts in `00_System/Scripts` remain available for automation and tests.

## Templater

Set the template folder to:

```text
00_System/Templates
```

Enable JavaScript execution for Templater. Use `Import Recipe JSON.md` to paste recipe JSON directly inside Obsidian.

## Dataview

Enable Dataview and JavaScript queries if you plan to extend the views. The included notes use normal Dataview table queries.

Useful dashboard notes live in:

```text
99_Views
```

## Graph View

Use filters such as:

```text
tag:item
tag:recipe
tag:machine
tag:status/check
-path:00_System
```

Recipe notes are first-class nodes, so keep recipe notes visible when inspecting production chains.

## QuickAdd

Optional workflow:

1. Create a QuickAdd macro.
2. Add a Templater action that runs `00_System/Templates/Import Recipe JSON.md`.
3. Bind the macro to a command palette action.

## Obsidian Git

Optional backup workflow:

1. Enable automatic commits on interval.
2. Review generated notes before pushing.
3. Keep manual edits in item, machine, and mod notes. The CLI skips those files by default.
