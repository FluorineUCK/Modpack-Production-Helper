# All Tags

```dataview
TABLE id AS ID, registry AS Registry, tag_namespace AS Namespace, status AS Status
FROM "05_tags"
WHERE type = "tag"
SORT id ASC
```
