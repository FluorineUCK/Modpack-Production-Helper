<%*
const normalize = require(app.vault.adapter.basePath + "/00_System/Scripts/normalizeRecipe.js");
const importer = require(app.vault.adapter.basePath + "/00_System/Scripts/importRecipes.js");

const pasted = await tp.system.prompt("Paste one recipe JSON object or an array of recipe objects");
if (!pasted) {
  tR += "Import cancelled.";
  return;
}

let parsed;
try {
  parsed = JSON.parse(pasted);
} catch (error) {
  tR += `JSON parse failed: ${error.message}`;
  return;
}

const objects = Array.isArray(parsed) ? parsed : [parsed];
const overwrite = await tp.system.suggester(["No", "Recipes only", "Generated notes"], ["none", "recipes", "generated"], false, "Overwrite existing generated notes?");
const changed = [];

for (const object of objects) {
  const recipe = normalize.normalizeRecipe(object);
  changed.push(...importer.importRecipe(recipe, {
    overwriteRecipes: overwrite === "recipes" || overwrite === "generated",
    overwriteGenerated: overwrite === "generated",
  }));
}

tR += `Imported ${objects.length} recipe(s). Created or updated ${changed.length} note(s).`;
%>
