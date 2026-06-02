# Schema

All generated notes use YAML frontmatter and `schema: 1`.

## Item

```yaml
type: item
schema: 1
id: "minecraft:iron_ingot"
namespace: "minecraft"
path: "iron_ingot"
display_name: "Iron Ingot"
mod: "[[04_Mods/mod.minecraft]]"
category: "material"
stage: "unknown"
status: "auto"
tags:
  - item
  - item/material
  - mod/minecraft
  - stage/unknown
  - status/auto
aliases:
  - minecraft:iron_ingot
  - Iron Ingot
```

## Recipe

```yaml
type: recipe
schema: 1
id: "minecraft:smelting/iron_ingot_from_raw_iron"
method: "smelting"
machine: "[[03_Machines/machine.minecraft.furnace]]"
mod: "[[04_Mods/mod.minecraft]]"
stage: "unknown"
status: "auto"
input_links:
  - "[[01_Items/item.minecraft.raw_iron]]"
output_links:
  - "[[01_Items/item.minecraft.iron_ingot]]"
machine_links:
  - "[[03_Machines/machine.minecraft.furnace]]"
time: 200
energy: 0
tags:
  - recipe
  - process/smelting
  - mod/minecraft
  - stage/unknown
  - status/auto
```

Recipe `inputs` and `outputs` arrays include `id`, `note`, `count`, `kind`, and `role`. Outputs also include `chance`.

## Machine

```yaml
type: machine
schema: 1
id: "minecraft:furnace"
display_name: "Furnace"
mod: "[[04_Mods/mod.minecraft]]"
methods:
  - smelting
tags:
  - machine
  - process/smelting
  - mod/minecraft
```

## Mod

```yaml
type: mod
schema: 1
id: "minecraft"
display_name: "Minecraft"
tags:
  - mod
  - mod/minecraft
```

## Status Values

- `auto`: generated with enough confidence for MVP use.
- `manual`: edited or created manually.
- `check`: generated but uncertain or missing important fields.
- `conflict`: manually flagged conflict.
- `deprecated`: obsolete note retained for history.
