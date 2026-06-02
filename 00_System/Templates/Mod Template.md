---
type: mod
schema: 1
id: ""
display_name: ""
tags:
  - mod
---

# <% tp.file.title %>

## Items

```dataview
TABLE id AS ID, category AS Category, stage AS Stage
FROM "01_Items"
WHERE mod = this.file.link
SORT id ASC
```

## Recipes

```dataview
TABLE method AS Process, input_links AS Inputs, output_links AS Outputs
FROM "02_Recipes"
WHERE mod = this.file.link
SORT method ASC
```
