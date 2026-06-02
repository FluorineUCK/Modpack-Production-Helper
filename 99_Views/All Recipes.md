# All Recipes

```dataview
TABLE method AS Method, machine AS Machine, input_links AS Inputs, output_links AS Outputs, status AS Status
FROM "02_Recipes"
WHERE type = "recipe"
SORT method ASC, file.name ASC
```
