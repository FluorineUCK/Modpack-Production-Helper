const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { listImportFiles } = require("../00_System/Scripts/importRecipes");
const { isRecipeEntry, stripBom } = require("../00_System/Scripts/readZipRecipes");

test("recipe entry filter accepts real recipe folders only", () => {
  assert.equal(isRecipeEntry("data/create/recipe/mixing/brass_ingot.json"), true);
  assert.equal(isRecipeEntry("data/create/recipes/mixing/brass_ingot.json"), true);
  assert.equal(isRecipeEntry("data/create/advancement/recipes/misc/smelting/bread.json"), false);
  assert.equal(isRecipeEntry("assets/create/lang/en_us.json"), false);
});

test("directory import discovery includes archives and skips dot directories", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "modpack-import-"));
  const relative = path.relative(path.resolve(__dirname, ".."), tempRoot);

  fs.mkdirSync(path.join(tempRoot, "mods", ".connector"), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, "mods", "a.jar"), "");
  fs.writeFileSync(path.join(tempRoot, "mods", "b.zip"), "");
  fs.writeFileSync(path.join(tempRoot, "mods", "c.json"), "{}");
  fs.writeFileSync(path.join(tempRoot, "mods", "disabled.jar.disabled"), "");
  fs.writeFileSync(path.join(tempRoot, "mods", ".connector", "ignored.jar"), "");

  const names = listImportFiles(relative).map((file) => path.basename(file)).sort();

  assert.deepEqual(names, ["a.jar", "b.zip", "c.json"]);
});

test("stripBom removes UTF-8 BOM before JSON parsing", () => {
  assert.deepEqual(JSON.parse(stripBom("\ufeff{\"ok\":true}")), { ok: true });
});
