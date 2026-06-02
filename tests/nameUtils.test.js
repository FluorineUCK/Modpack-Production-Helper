const assert = require("node:assert/strict");
const test = require("node:test");
const {
  itemFileName,
  parseNamespace,
  recipeFileName,
  safeFileName,
} = require("../00_System/Scripts/nameUtils");

test("safeFileName converts Minecraft IDs without raw separators", () => {
  assert.equal(safeFileName("minecraft:iron ingot"), "minecraft.iron_ingot");
  assert.equal(safeFileName("create:crushed/raw_iron"), "create.crushed.raw_iron");
});

test("itemFileName prefixes item note names", () => {
  assert.equal(itemFileName("minecraft:iron_ingot"), "item.minecraft.iron_ingot.md");
});

test("recipeFileName converts recipe IDs", () => {
  assert.equal(
    recipeFileName({ id: "minecraft:smelting/iron_ingot_from_raw_iron" }),
    "recipe.minecraft.smelting.iron_ingot_from_raw_iron.md",
  );
});

test("parseNamespace returns namespace and path", () => {
  assert.deepEqual(parseNamespace("mekanism:enriched_iron"), {
    namespace: "mekanism",
    path: "enriched_iron",
  });
});
