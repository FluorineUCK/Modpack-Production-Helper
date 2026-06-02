# Mod Schema

Required frontmatter fields:

| Field | Meaning |
|---|---|
| type | Always `mod` |
| schema | Schema version number |
| id | Mod namespace |
| display_name | Human-readable mod name |
| tags | Classification tags |

Example:

```yaml
type: mod
schema: 1
id: "minecraft"
display_name: "Minecraft"
tags:
  - mod
  - mod/minecraft
```
