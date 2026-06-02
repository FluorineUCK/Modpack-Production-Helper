# Items By Stage

```dataview
TABLE rows.file.link AS Items
FROM "01_Items"
WHERE type = "item"
GROUP BY stage
SORT stage ASC
```
