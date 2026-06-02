# Mod JAR Drop Folder

Put enabled mod `.jar` files in `05_Materials/mods/`, then run:

```bash
node 00_System/Scripts/importRecipes.js --overwrite-generated --prune-uninstalled 05_Materials
```

Do not commit mod JARs to GitHub. They are ignored by `.gitignore`.
