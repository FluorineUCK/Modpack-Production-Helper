const assert = require("node:assert/strict");
const test = require("node:test");
const { generateItemMarkdown } = require("../00_System/Scripts/generateItemNote");
const { generateRecipeMarkdown } = require("../00_System/Scripts/generateRecipeNote");
const { normalizeRecipe } = require("../00_System/Scripts/normalizeRecipe");

test("generated markdown contains static wiki-links and Mermaid", () => {
  const recipe = normalizeRecipe({
    type: "minecraft:smelting",
    id: "minecraft:smelting/iron_ingot_from_raw_iron",
    ingredient: { item: "minecraft:raw_iron" },
    result: { item: "minecraft:iron_ingot" },
  });
  const markdown = generateRecipeMarkdown(recipe);

  assert.match(markdown, /\[\[01_Items\/item\.minecraft\.raw_iron\]\]/);
  assert.match(markdown, /\[\[03_Machines\/machine\.minecraft\.furnace\]\]/);
  assert.match(markdown, /\[\[01_Items\/item\.minecraft\.iron_ingot\]\]/);
  assert.match(markdown, /```mermaid/);
});

test("generated frontmatter contains required tags", () => {
  const item = generateItemMarkdown({
    id: "minecraft:iron_ingot",
    category: "material",
    stage: "unknown",
    status: "auto",
  });

  assert.match(item, /  - item\/material/);
  assert.match(item, /  - mod\/minecraft/);
  assert.match(item, /  - stage\/unknown/);
  assert.match(item, /  - status\/auto/);
});
