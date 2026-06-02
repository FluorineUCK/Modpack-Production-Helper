---
type: item
schema: 1
id: ""
namespace: ""
path: ""
display_name: ""
mod: ""
category: "unknown"
stage: "unknown"
status: "manual"
tags:
  - item
  - item/unknown
  - stage/unknown
  - status/manual
aliases: []
---

# <% tp.file.title %>

## Basic Information

- Item ID::
- Mod::
- Category:: unknown
- Stage:: unknown
- Status:: manual

## Produced By

```dataview
TABLE method AS Process, machine AS Machine, input_links AS Inputs, time AS Time, energy AS Energy
FROM "02_Recipes"
WHERE contains(output_links, this.file.link)
SORT method ASC
```

## Used In

```dataview
TABLE method AS Process, machine AS Machine, output_links AS Outputs
FROM "02_Recipes"
WHERE contains(input_links, this.file.link)
SORT method ASC
```

## Manual Notes

-
