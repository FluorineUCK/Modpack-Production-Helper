# Machine Schema

Required frontmatter fields:

| Field | Meaning |
|---|---|
| type | Always `machine` |
| schema | Schema version number |
| id | Original machine ID |
| display_name | Human-readable machine name |
| mod | Wiki-link to the mod note |
| methods | Supported process methods |
| tags | Classification tags |

Example:

```yaml
type: machine
schema: 1
id: "minecraft:furnace"
display_name: "Furnace"
mod: "[[04_Mods/mod.minecraft]]"
methods:
  - smelting
```
