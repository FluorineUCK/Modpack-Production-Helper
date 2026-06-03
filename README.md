# Modpack Production Graph

This is an Obsidian vault generator for Minecraft modpack production chains.

Give it mod `.jar` files or exported recipe `.json` files, and it creates:

- item notes in `01_Items`
- recipe notes in `02_Recipes`
- machine notes in `03_Machines`
- mod notes in `04_Mods`
- tag notes in `05_tags`
- Dataview dashboards in `99_Views`

The production graph is modeled as:

```text
Input Items / Tags / Fluids
        ->
Recipe / Process / Machine
        ->
Output Items / Fluids / Byproducts
```

Recipes are first-class notes. Do not expect the graph to be only item-to-item links; item notes also include direct `Can Become` links for quick browsing.

## Requirements

- Obsidian Desktop
- Node.js, only for the CLI/script workflow
- Recommended Obsidian plugins:
  - Dataview
  - Templater
  - Obsidian Git, optional
  - Linter, optional

Mermaid, Graph View, Local Graph, and Canvas are built into Obsidian.

## Entry Points

This repo supports two ways to use the same production graph:

- Obsidian plugin: use `obsidian-plugin/` if you want to import JARs and search paths from inside Obsidian without running Node commands.
- Node CLI: use `00_System/Scripts/*.js` if you want terminal commands, tests, or automation.

## Quick Start Inside Obsidian

1. Copy the tracked plugin package:

```text
obsidian-plugin/
```

to:

```text
<your vault>/.obsidian/plugins/modpack-production-helper/
```

2. Restart Obsidian or reload plugins.

3. Enable **Modpack Production Helper** in Community Plugins.

4. Put enabled mod JAR files in:

```text
06_Materials/mods/
```

5. Open the command palette and run:

```text
Modpack Production Helper: Import from material folder
```

Useful plugin commands:

```text
Modpack Production Helper: Import from material folder
Modpack Production Helper: Find item paths
Modpack Production Helper: Track production from item A to B
```

Path and production-track results are written under:

```text
99_Views/Item Paths/
```

## Quick Start From Mod JARs With Node CLI

1. Put your enabled mod JAR files in:

```text
06_Materials/mods/
```

2. Open a terminal in this folder:

```text
Modpack-Production
```

3. Run the importer:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-generated --prune-uninstalled 06_Materials
```

4. Open `Modpack-Production` as an Obsidian vault.

5. Start browsing from:

```text
99_Views/Production Graph Index.md
99_Views/All Items.md
99_Views/All Recipes.md
```

## What The Import Command Does

The command:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-generated --prune-uninstalled 06_Materials
```

does this:

- recursively scans `06_Materials`
- imports `.jar`, `.zip`, and `.json` files
- skips dot-directories such as `.connector`
- ignores disabled files such as `.jar.disabled`
- reads recipe JSON from JAR paths like:

```text
data/<namespace>/recipe/*.json
data/<namespace>/recipes/*.json
```

- reads tag JSON from JAR paths like:

```text
data/<tag_namespace>/tags/item/*.json
data/<tag_namespace>/tags/items/*.json
data/<tag_namespace>/tags/fluid/*.json
data/<tag_namespace>/tags/fluids/*.json
```

- creates or refreshes generated item, recipe, machine, mod, and tag notes
- preserves notes marked `status: manual`
- removes generated compat notes for mods that are not actually installed

Example: if a Create compat recipe references `ae2` or `mekanism`, but those mods are not installed as enabled JARs, `--prune-uninstalled` removes the generated compat notes.

## Import One JAR

To test a single mod JAR:

```bash
node 00_System/Scripts/importRecipes.js path/to/mod.jar
```

To regenerate existing generated notes from that JAR:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-generated path/to/mod.jar
```

## Import JSON Recipes

You can also import exported recipe JSON:

```bash
node 00_System/Scripts/importRecipes.js examples/vanilla_smelting.json
node 00_System/Scripts/importRecipes.js examples/
```

## How To Use The Vault

Open an item note, for example:

```text
01_Items/item.minecraft.cobblestone.md
```

Each generated item note has:

- `Static Recipe Links`
- `Produced By`
- `Used In`
- `Can Become`
- Dataview `Produced By`
- Dataview `Used In`
- `Manual Notes`

`Can Become` shows direct downstream item links while still naming the recipe that performs the conversion.

Example:

```md
- [[01_Items/item.minecraft.gravel]] via [[02_Recipes/recipe.create.milling.cobblestone]] (milling; [[04_Mods/mod.create]]; [[03_Machines/machine.create.millstone]])
```

This means Cobblestone can become Gravel through the Create milling recipe.

## Find Paths Between Two Items

Obsidian and Dataview are good for immediate neighbors. For full multi-step paths from item A to item B, use:

```bash
node 00_System/Scripts/findItemPaths.js minecraft:cobblestone minecraft:gravel
```

You can pass item IDs, note names, note paths, or wiki links:

```bash
node 00_System/Scripts/findItemPaths.js minecraft:cobblestone minecraft:sand --max-depth 4 --limit 20
node 00_System/Scripts/findItemPaths.js create:zinc_ingot create:brass_ingot --max-depth 4 --limit 20
node 00_System/Scripts/findItemPaths.js item.minecraft.cobblestone item.minecraft.sand
node 00_System/Scripts/findItemPaths.js "[[01_Items/item.minecraft.cobblestone]]" "[[01_Items/item.minecraft.sand]]"
```

Write the result into the vault:

```bash
node 00_System/Scripts/findItemPaths.js minecraft:cobblestone minecraft:sand --max-depth 4 --write "99_Views/Item Paths/Cobblestone to Sand Paths.md"
```

Each path is shown as:

```md
Item -> Recipe -> Item
Item -> Tag -> Recipe -> Item
```

This keeps recipe notes visible as first-class production steps.

### Run Path Search Inside Obsidian

Use the first-party plugin command:

```text
Modpack Production Helper: Find item paths
```

For richer route notes with recipe context, use:

```text
Modpack Production Helper: Track production from item A to B
```

The older Templater workflow still works:

1. Install and enable Templater.
2. Set Templater's template folder to:

```text
00_System/Templates
```

3. Open the command palette.
4. Run:

```text
Templater: Insert template
```

5. Pick:

```text
Find Item Paths.md
```

6. Enter the source item and target item.

Examples:

```text
minecraft:cobblestone
minecraft:sand
```

The template can either insert the result into the current note or write it to a note such as:

```text
99_Views/Item Paths/Cobblestone to Sand Paths.md
```

## Recipe Notes

Recipe notes contain static links to inputs, machines, mods, and outputs:

```md
[[01_Items/item.minecraft.raw_iron]]
[[03_Machines/machine.minecraft.furnace]]
[[01_Items/item.minecraft.iron_ingot]]
```

Tag inputs link to `05_tags` notes:

```md
[[05_tags/tag.c.ingots.zinc]]
```

They also include:

- YAML frontmatter for Dataview
- input and output tables
- a Mermaid flowchart
- preserved raw JSON

## Tag Notes

Recipe inputs such as:

```json
{ "tag": "c:ingots/zinc" }
```

are linked to tag notes, not fake item notes.

Example tag note:

```text
05_tags/tag.c.ingots.zinc.md
```

The tag is built from datapack tag definitions such as:

```text
data/c/tags/item/ingots/zinc.json
```

The graph can route through tags:

```text
[[01_Items/item.create.zinc_ingot]]
-> [[05_tags/tag.c.ingots.zinc]]
-> [[02_Recipes/recipe.create.mixing.brass_ingot]]
-> [[01_Items/item.create.brass_ingot]]
```

Shared namespaces such as `c`, `forge`, `neoforge`, `fabric`, and `minecraft` are treated as tag namespaces, not content mods.

## Graph View

Useful Graph View filters:

```text
tag:item
tag:recipe
tag:machine
tag:mod/create
tag:process/crushing
tag:status/check
-path:00_System
-path:06_Materials
```

Use Local Graph from an item note to see nearby recipes and outputs.

## Safe Reruns

Generated notes use:

```yaml
status: "auto"
```

Manual notes should use:

```yaml
status: "manual"
```

The importer preserves manual notes when using `--overwrite-generated`.

Common rerun command:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-generated --prune-uninstalled 06_Materials
```

Use recipe-only refresh if you do not want item, machine, or mod notes regenerated:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-recipes 06_Materials
```

## Templater Import

Inside Obsidian:

1. Set Templater's template folder to:

```text
00_System/Templates
```

2. Run:

```text
Import Recipe JSON.md
```

3. Paste one recipe JSON object or an array of recipe objects.

The CLI is recommended for full modpack JAR imports.

## Known Limitations

- Not every mod-specific recipe format is fully normalized.
- Unknown process formats may still import with inferred machines.
- Tag ingredients such as `#c:ingots/iron` depend on tag definitions found in installed JARs; unresolved tags are still represented as generated tag notes.
- Some generated machine notes may be named `unknown_machine` when the recipe format does not identify a machine.
- Create sequenced assembly chances are preserved as source values, not normalized probabilities.
