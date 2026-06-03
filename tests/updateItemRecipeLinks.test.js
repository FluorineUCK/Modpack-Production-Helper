const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildRecipeIndex,
  renderGeneratedSection,
  updateGeneratedSection,
} = require("../00_System/Scripts/updateItemRecipeLinks");

test("renderGeneratedSection creates static recipe links for item relationships", () => {
  const itemLink = "[[01_Items/item.minecraft.cobblestone]]";
  const index = {
    producedBy: new Map(),
    usedIn: new Map([
      [
        itemLink,
        [
          {
            link: "[[02_Recipes/recipe.create.milling.cobblestone]]",
            method: "milling",
            machine: "[[03_Machines/machine.create.millstone]]",
            mod: "[[04_Mods/mod.create]]",
            inputs: [itemLink],
            outputs: ["[[01_Items/item.minecraft.gravel]]"],
          },
        ],
      ],
    ]),
  };

  const section = renderGeneratedSection(itemLink, index);

  assert.match(section, /\[\[02_Recipes\/recipe\.create\.milling\.cobblestone\]\]/);
  assert.match(section, /\[\[01_Items\/item\.minecraft\.gravel\]\]/);
  assert.match(section, /\[\[04_Mods\/mod\.create\]\]/);
  assert.match(section, /### Can Become/);
  assert.match(section, /\[\[01_Items\/item\.minecraft\.gravel\]\] via \[\[02_Recipes\/recipe\.create\.milling\.cobblestone\]\]/);
});

test("updateGeneratedSection inserts before Dataview sections", () => {
  const original = `# Cobblestone

## Basic Information

- Item ID:: minecraft:cobblestone

## Produced By

\`\`\`dataview
\`\`\`
`;

  const section = "## Static Recipe Links\n\n<!-- BEGIN GENERATED RECIPE LINKS -->\n\n<!-- END GENERATED RECIPE LINKS -->";
  const next = updateGeneratedSection(original, section);

  assert.equal(next.indexOf("## Static Recipe Links") < next.indexOf("## Produced By"), true);
});
