---
type: machine
schema: 1
id: ""
display_name: ""
mod: ""
methods:
  - unknown
tags:
  - machine
  - process/unknown
---

# <% tp.file.title %>

## Supported Processes

- unknown

## Recipes Using This Machine

```dataview
TABLE input_links AS Inputs, output_links AS Outputs, time AS Time, energy AS Energy
FROM "02_Recipes"
WHERE contains(machine_links, this.file.link)
SORT file.name ASC
```
