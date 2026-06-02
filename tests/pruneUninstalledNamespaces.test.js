const assert = require("node:assert/strict");
const test = require("node:test");
const { collectTomlModIds } = require("../00_System/Scripts/installedNamespaces");
const {
  compatNamespacesFromRecipeId,
  shouldDeleteNote,
} = require("../00_System/Scripts/pruneUninstalledNamespaces");

test("installed namespace detection ignores dependency modId entries", () => {
  const toml = `[[mods]]
modId = "constructionwand"

[[dependencies.constructionwand]]
modId = "ae2"
`;

  assert.deepEqual(collectTomlModIds(toml), ["constructionwand"]);
});

test("prune removes generated item notes for uninstalled namespaces", () => {
  const markdown = `---
type: item
id: "mekanism:enriched_iron"
status: "auto"
---`;

  assert.equal(shouldDeleteNote("01_Items", markdown, new Set(["minecraft", "create"])), true);
});

test("prune preserves generated item notes for installed namespaces", () => {
  const markdown = `---
type: item
id: "create:brass_ingot"
status: "auto"
---`;

  assert.equal(shouldDeleteNote("01_Items", markdown, new Set(["minecraft", "create"])), false);
});

test("prune removes recipes that link to uninstalled item namespaces", () => {
  const markdown = `---
type: recipe
id: "create:compat/ae2/example"
mod: "[[04_Mods/mod.create]]"
status: "auto"
---

- [[01_Items/item.ae2.certus_quartz_crystal]]
`;

  assert.equal(shouldDeleteNote("02_Recipes", markdown, new Set(["minecraft", "create"])), true);
});

test("prune removes recipes that require uninstalled machine namespaces", () => {
  const markdown = `---
type: recipe
id: "createaddition:compat/mekanism/rose_quartz_enriching"
mod: "[[04_Mods/mod.createaddition]]"
status: "auto"
machine: "[[03_Machines/machine.mekanism.enrichment_chamber]]"
---`;

  assert.equal(shouldDeleteNote("02_Recipes", markdown, new Set(["minecraft", "createaddition"])), true);
});

test("prune removes compat recipe IDs for uninstalled namespaces", () => {
  assert.deepEqual(
    compatNamespacesFromRecipeId("createaddition:compat/mekanism/rose_quartz"),
    ["mekanism"],
  );
});

test("prune preserves manual notes", () => {
  const markdown = `---
type: item
id: "ae2:manual_keep"
status: "manual"
---`;

  assert.equal(shouldDeleteNote("01_Items", markdown, new Set(["minecraft", "create"])), false);
});
