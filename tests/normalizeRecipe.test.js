const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizeIngredient,
  normalizeOutput,
  normalizeRecipe,
} = require("../00_System/Scripts/normalizeRecipe");

test("tag ingredient parsing", () => {
  assert.deepEqual(normalizeIngredient({ tag: "forge:ingots/iron" }), [
    {
      id: "#forge:ingots/iron",
      kind: "tag",
      count: 1,
      role: "input",
    },
  ]);
});

test("smelting normalization", () => {
  const recipe = normalizeRecipe({
    type: "minecraft:smelting",
    id: "minecraft:smelting/iron_ingot_from_raw_iron",
    ingredient: { item: "minecraft:raw_iron" },
    result: { item: "minecraft:iron_ingot", count: 1 },
    cookingtime: 200,
  });

  assert.equal(recipe.method, "smelting");
  assert.equal(recipe.machine, "minecraft:furnace");
  assert.equal(recipe.inputs[0].id, "minecraft:raw_iron");
  assert.equal(recipe.outputs[0].id, "minecraft:iron_ingot");
  assert.equal(recipe.time, 200);
});

test("shaped crafting normalization aggregates pattern counts", () => {
  const recipe = normalizeRecipe({
    type: "minecraft:crafting_shaped",
    pattern: ["PP", "PP"],
    key: {
      P: { tag: "minecraft:planks" },
    },
    result: { item: "minecraft:crafting_table", count: 1 },
  });

  assert.equal(recipe.method, "shaped_crafting");
  assert.equal(recipe.inputs[0].id, "#minecraft:planks");
  assert.equal(recipe.inputs[0].count, 4);
});

test("shapeless crafting normalization", () => {
  const recipe = normalizeRecipe({
    type: "minecraft:crafting_shapeless",
    ingredients: [{ item: "minecraft:iron_ingot" }, { item: "minecraft:flint" }],
    result: { item: "minecraft:flint_and_steel" },
  });

  assert.equal(recipe.method, "shapeless_crafting");
  assert.equal(recipe.inputs.length, 2);
  assert.equal(recipe.outputs[0].id, "minecraft:flint_and_steel");
});

test("multi-output recipe normalization with chances", () => {
  const outputs = normalizeOutput([
    { item: "thermal:iron_dust", count: 2 },
    { item: "thermal:nickel_dust", count: 1, chance: 0.1 },
  ]);

  assert.equal(outputs.length, 2);
  assert.equal(outputs[0].role, "main_output");
  assert.equal(outputs[1].role, "byproduct");
  assert.equal(outputs[1].chance, 0.1);
});

test("recipe ID is derived from data pack source path when JSON lacks id", () => {
  const raw = {
    type: "create:mixing",
    ingredients: [{ tag: "c:ingots/copper" }, { tag: "c:ingots/zinc" }],
    results: [{ id: "create:brass_ingot", count: 2 }],
  };
  Object.defineProperty(raw, "__sourcePath", {
    value: "data/create/recipe/mixing/brass_ingot.json",
    enumerable: false,
  });

  const recipe = normalizeRecipe(raw);

  assert.equal(recipe.id, "create:mixing/brass_ingot");
  assert.equal(recipe.mod, "create");
  assert.equal(recipe.machine, "create:mechanical_mixer");
});
