# Missing Metadata

```dataview
TABLE type AS Type, id AS ID, category AS Category, stage AS Stage, machine AS Machine, status AS Status
FROM "01_Items" OR "02_Recipes" OR "03_Machines" OR "04_Mods"
WHERE status = "check" OR category = "unknown" OR stage = "unknown" OR machine = ""
SORT type ASC, id ASC
```
