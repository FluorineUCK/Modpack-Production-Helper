# Modpack Production Helper

This is a desktop Obsidian plugin version of the Modpack Production Helper scripts.
It lets you import Minecraft mod JAR recipe/tag data and search item production paths from inside Obsidian, without running Node.js commands manually.

The existing script-based vault/helper files can stay where they are. This folder is the plugin package.

It is desktop-only because it reads local `.jar`, `.zip`, and `.json` files from your vault.

## Install

Copy this folder into your vault's plugin folder:

```text
<your vault>/.obsidian/plugins/modpack-production-helper/
```

The folder must contain:

```text
manifest.json
main.js
styles.css
```

Restart Obsidian or reload plugins, then enable **Modpack Production Helper** in Community Plugins.

## Commands

Open Obsidian's command palette and run:

```text
Modpack Production Helper: Import from material folder
```

Default material folder inside the vault:

```text
06_Materials
```

Put enabled mod JARs under:

```text
06_Materials/mods/
```

The importer reads recipes and tags from the JAR files, then creates or updates:

```text
01_Items/
02_Recipes/
03_Machines/
04_Mods/
05_tags/
99_Views/Item Paths/
```

Path search:

```text
Modpack Production Helper: Find item paths
```

Example:

```text
from: create:zinc_ingot
to: create:brass_ingot
```

The result can be written into:

```text
99_Views/Item Paths/
```

Production tracking:

```text
Modpack Production Helper: Track production from item A to B
```

This creates a richer note for the same kind of item-to-item search. Each track includes:

- tag matches used by the path
- recipe notes used by the path
- machine, method, and mod metadata
- full recipe inputs and outputs
- a Mermaid graph for the followed production route

## Notes

- Recipe tag inputs link to `05_tags`.
- `#c`, `#forge`, `#neoforge`, and similar values are treated as tag namespaces, not items.
- The plugin preserves notes marked `status: manual` when overwriting generated notes.
- It does not delete your mod JARs.
- No `npm install` or build step is required for this packaged `main.js` plugin.
