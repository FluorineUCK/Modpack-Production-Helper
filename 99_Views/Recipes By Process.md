# Recipes By Process

```dataview
TABLE rows.file.link AS Recipes
FROM "02_Recipes"
WHERE type = "recipe"
GROUP BY method
SORT method ASC
```
