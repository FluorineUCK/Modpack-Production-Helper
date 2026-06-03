const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildItemGraph,
  findItemPaths,
  normalizeItemReference,
  renderMarkdown,
} = require("../00_System/Scripts/findItemPaths");

test("normalizeItemReference accepts IDs, note names, paths, and wiki links", () => {
  assert.equal(
    normalizeItemReference("minecraft:cobblestone"),
    "[[01_Items/item.minecraft.cobblestone]]",
  );
  assert.equal(
    normalizeItemReference("item.minecraft.cobblestone"),
    "[[01_Items/item.minecraft.cobblestone]]",
  );
  assert.equal(
    normalizeItemReference("01_Items/item.minecraft.cobblestone.md"),
    "[[01_Items/item.minecraft.cobblestone]]",
  );
  assert.equal(
    normalizeItemReference("[[01_Items/item.minecraft.cobblestone]]"),
    "[[01_Items/item.minecraft.cobblestone]]",
  );
});

test("findItemPaths finds direct and multi-step item conversion paths", () => {
  const recipes = [
    {
      link: "[[02_Recipes/recipe.create.milling.cobblestone]]",
      method: "milling",
      machine: "[[03_Machines/machine.create.millstone]]",
      mod: "[[04_Mods/mod.create]]",
      inputs: ["[[01_Items/item.minecraft.cobblestone]]"],
      outputs: ["[[01_Items/item.minecraft.gravel]]"],
    },
    {
      link: "[[02_Recipes/recipe.create.crushing.gravel]]",
      method: "crushing",
      machine: "[[03_Machines/machine.create.crushing_wheel]]",
      mod: "[[04_Mods/mod.create]]",
      inputs: ["[[01_Items/item.minecraft.gravel]]"],
      outputs: ["[[01_Items/item.minecraft.sand]]"],
    },
    {
      link: "[[02_Recipes/recipe.other.cobble_to_sand]]",
      method: "magic",
      machine: "[[03_Machines/machine.other.machine]]",
      mod: "[[04_Mods/mod.other]]",
      inputs: ["[[01_Items/item.minecraft.cobblestone]]"],
      outputs: ["[[01_Items/item.minecraft.sand]]"],
    },
  ];

  const graph = buildItemGraph(recipes);
  const paths = findItemPaths(
    "[[01_Items/item.minecraft.cobblestone]]",
    "[[01_Items/item.minecraft.sand]]",
    { graph, maxDepth: 2, limit: 10 },
  );

  assert.equal(paths.length, 2);
  assert.equal(paths.some((path) => path.length === 1), true);
  assert.equal(paths.some((path) => path.length === 2), true);
});

test("findItemPaths can route item membership through tags into recipes", () => {
  const recipes = [
    {
      link: "[[02_Recipes/recipe.create.mixing.brass_ingot]]",
      method: "mixing",
      machine: "[[03_Machines/machine.create.mechanical_mixer]]",
      mod: "[[04_Mods/mod.create]]",
      inputs: ["[[05_tags/tag.c.ingots.zinc]]"],
      outputs: ["[[01_Items/item.create.brass_ingot]]"],
    },
  ];
  const tags = [
    {
      link: "[[05_tags/tag.c.ingots.zinc]]",
      members: ["[[01_Items/item.create.zinc_ingot]]"],
      childTags: [],
    },
  ];

  const graph = buildItemGraph(recipes, tags);
  const paths = findItemPaths(
    "[[01_Items/item.create.zinc_ingot]]",
    "[[01_Items/item.create.brass_ingot]]",
    { graph, maxDepth: 3, limit: 10 },
  );

  assert.equal(paths.length, 1);
  assert.equal(paths[0][0].kind, "tag");
  assert.equal(paths[0][1].recipe.link, "[[02_Recipes/recipe.create.mixing.brass_ingot]]");
});

test("renderMarkdown shows recipe nodes between item nodes", () => {
  const markdown = renderMarkdown(
    "[[01_Items/item.minecraft.cobblestone]]",
    "[[01_Items/item.minecraft.gravel]]",
    [
      [
        {
          from: "[[01_Items/item.minecraft.cobblestone]]",
          recipe: {
            link: "[[02_Recipes/recipe.create.milling.cobblestone]]",
            method: "milling",
            machine: "[[03_Machines/machine.create.millstone]]",
            mod: "[[04_Mods/mod.create]]",
          },
          to: "[[01_Items/item.minecraft.gravel]]",
        },
      ],
    ],
  );

  assert.match(markdown, /\[\[01_Items\/item\.minecraft\.cobblestone\]\] -> \[\[02_Recipes\/recipe\.create\.milling\.cobblestone\]\] -> \[\[01_Items\/item\.minecraft\.gravel\]\]/);
});
