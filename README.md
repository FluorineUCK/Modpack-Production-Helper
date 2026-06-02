# Modpack Production Graph

This is an Obsidian vault generator for Minecraft modpack production chains.

Give it mod `.jar` files or exported recipe `.json` files, and it creates:

- item notes in `01_Items`
- recipe notes in `02_Recipes`
- machine notes in `03_Machines`
- mod notes in `04_Mods`
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

- Node.js
- Obsidian
- Recommended Obsidian plugins:
  - Dataview
  - Templater
  - Obsidian Git, optional
  - Linter, optional

Mermaid, Graph View, Local Graph, and Canvas are built into Obsidian.

## Quick Start From Mod JARs

1. Put your enabled mod JAR files in:

```text
05_Materials/mods/
```

2. Open a terminal in this folder:

```text
Modpack-Production
```

3. Run the importer:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-generated --prune-uninstalled 05_Materials
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
node 00_System/Scripts/importRecipes.js --overwrite-generated --prune-uninstalled 05_Materials
```

does this:

- recursively scans `05_Materials`
- imports `.jar`, `.zip`, and `.json` files
- skips dot-directories such as `.connector`
- ignores disabled files such as `.jar.disabled`
- reads recipe JSON from JAR paths like:

```text
data/<namespace>/recipe/*.json
data/<namespace>/recipes/*.json
```

- creates or refreshes generated item, recipe, machine, and mod notes
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

## Recipe Notes

Recipe notes contain static links to inputs, machines, mods, and outputs:

```md
[[01_Items/item.minecraft.raw_iron]]
[[03_Machines/machine.minecraft.furnace]]
[[01_Items/item.minecraft.iron_ingot]]
```

They also include:

- YAML frontmatter for Dataview
- input and output tables
- a Mermaid flowchart
- preserved raw JSON

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
-path:05_Materials
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
node 00_System/Scripts/importRecipes.js --overwrite-generated --prune-uninstalled 05_Materials
```

Use recipe-only refresh if you do not want item, machine, or mod notes regenerated:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-recipes 05_Materials
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
- Tag ingredients such as `#c:ingots/iron` are preserved as tag inputs, but tag notes are not generated yet.
- Some generated machine notes may be named `unknown_machine` when the recipe format does not identify a machine.
- Create sequenced assembly chances are preserved as source values, not normalized probabilities.
