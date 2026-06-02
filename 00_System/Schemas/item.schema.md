# Item Schema

Required frontmatter fields:

| Field | Meaning |
|---|---|
| type | Always `item` |
| schema | Schema version number |
| id | Original Minecraft item or fluid ID |
| namespace | ID namespace, such as `minecraft` |
| path | ID path, such as `iron_ingot` |
| display_name | Human-readable name |
| mod | Wiki-link to the mod note |
| category | One of `raw`, `material`, `component`, `machine`, `fluid`, `final`, `unknown` |
| stage | One of `early`, `mid`, `late`, `endgame`, `unknown` |
| status | One of `auto`, `manual`, `check`, `conflict`, `deprecated` |
| tags | Classification tags |
| aliases | Original ID and display name |

Example:

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
```
