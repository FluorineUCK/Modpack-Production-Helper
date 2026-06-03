#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { generateItemMarkdown } = require("./generateItemNote");
const { generateMachineMarkdown } = require("./generateMachineNote");
const { generateModMarkdown } = require("./generateModNote");
const { generateRecipeMarkdown } = require("./generateRecipeNote");
const { generateTagMarkdown } = require("./generateTagNote");
const { normalizeRecipe } = require("./normalizeRecipe");
const { pruneUninstalledNamespaces } = require("./pruneUninstalledNamespaces");
const { readRecipeJsonFromArchive, readTagJsonFromArchive, stripBom } = require("./readZipRecipes");
const { updateItemRecipeLinks } = require("./updateItemRecipeLinks");
const {
  itemFileName,
  machineFileName,
  modFileName,
  parseNamespace,
  recipeFileName,
  tagFileName,
  itemLink,
  tagLink,
} = require("./nameUtils");

const ROOT = path.resolve(__dirname, "..", "..");

function writeIfMissing(filePath, content, options = {}) {
  if (fs.existsSync(filePath)) {
    if (!options.overwrite) {
      return false;
    }
    const existing = fs.readFileSync(filePath, "utf8");
    if (options.preserveManual && /status:\s*"?manual"?/i.test(existing)) {
      return false;
    }
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function isImportPath(filePath) {
  return /\.(json|jar|zip)$/i.test(filePath);
}

function isArchivePath(filePath) {
  return /\.(jar|zip)$/i.test(filePath);
}

function listImportFiles(target) {
  const resolved = path.resolve(ROOT, target);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${target}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return isImportPath(resolved) ? [resolved] : [];
  }

  const entries = fs.readdirSync(resolved, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const child = path.join(resolved, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) {
        return [];
      }
      return listImportFiles(path.relative(ROOT, child));
    }
    return isImportPath(child) ? [child] : [];
  });
}

function readRecipesFromFile(filePath) {
  const parsed = JSON.parse(stripBom(fs.readFileSync(filePath, "utf8")));
  return Array.isArray(parsed) ? parsed : [parsed];
}

function readRecipeObjectsFromFile(filePath) {
  if (isArchivePath(filePath)) {
    return readRecipeJsonFromArchive(filePath);
  }
  return readRecipesFromFile(filePath);
}

function readTagObjectsFromFile(filePath) {
  if (isArchivePath(filePath)) {
    return readTagJsonFromArchive(filePath);
  }
  return [];
}

function normalizeTagDefinition(tag) {
  const values = Array.isArray(tag.raw && tag.raw.values) ? tag.raw.values : [];
  const members = [];
  const childTags = [];

  for (const value of values) {
    const id = typeof value === "string" ? value : value && value.id;
    if (!id || typeof id !== "string") {
      continue;
    }
    if (id.startsWith("#")) {
      childTags.push(tagLink(id));
    } else {
      members.push(itemLink(id));
    }
  }

  return {
    id: tag.id,
    registry: tag.registry,
    declared_by: [tag.sourceArchive ? tag.sourceArchive.replace(/\.jar$/i, "") : tag.namespace],
    members,
    child_tags: childTags,
    status: members.length || childTags.length ? "auto" : "check",
  };
}

function mergeTagDefinitions(tags) {
  const merged = new Map();

  for (const tag of tags) {
    const current = merged.get(tag.id) || {
      id: tag.id,
      registry: tag.registry || "item",
      declared_by: [],
      members: [],
      child_tags: [],
      status: "check",
    };
    current.declared_by.push(...(tag.declared_by || []));
    current.members.push(...(tag.members || []));
    current.child_tags.push(...(tag.child_tags || []));
    if (tag.status === "auto") {
      current.status = "auto";
    }
    merged.set(tag.id, current);
  }

  return [...merged.values()].map((tag) => ({
    ...tag,
    declared_by: [...new Set(tag.declared_by)],
    members: [...new Set(tag.members)],
    child_tags: [...new Set(tag.child_tags)],
  }));
}

function referencedTagsFromRecipes(recipes) {
  return recipes
    .flatMap((recipe) => recipe.inputs.filter((input) => input.kind === "tag").map((input) => input.id))
    .map((id) => ({
      id,
      registry: "item",
      declared_by: [],
      members: [],
      child_tags: [],
      status: "check",
    }));
}

function itemCategory(entry) {
  if (entry.kind === "fluid") {
    return "fluid";
  }
  return "unknown";
}

function importRecipe(recipe, options = {}) {
  const changed = [];
  const itemIds = [
    ...recipe.inputs.filter((input) => input.kind !== "tag").map((input) => input.id),
    ...recipe.outputs.filter((output) => output.kind !== "tag").map((output) => output.id),
  ];
  const mods = new Set([recipe.mod, parseNamespace(recipe.machine).namespace]);

  for (const id of itemIds) {
    const ns = parseNamespace(id).namespace;
    mods.add(ns);
    const sourceEntry =
      recipe.inputs.find((input) => input.id === id) || recipe.outputs.find((output) => output.id === id);
    const filePath = path.join(ROOT, "01_Items", itemFileName(id));
    if (
      writeIfMissing(
        filePath,
        generateItemMarkdown({
          id,
          kind: sourceEntry.kind,
          category: itemCategory(sourceEntry),
          stage: recipe.stage,
          status: recipe.status,
        }),
        { overwrite: options.overwriteGenerated, preserveManual: true },
      )
    ) {
      changed.push(filePath);
    }
  }

  const machinePath = path.join(ROOT, "03_Machines", machineFileName(recipe.machine));
  if (
    writeIfMissing(
      machinePath,
      generateMachineMarkdown({
        id: recipe.machine,
        methods: [recipe.method],
      }),
      { overwrite: options.overwriteGenerated, preserveManual: true },
    )
  ) {
    changed.push(machinePath);
  }

  for (const mod of mods) {
    const modPath = path.join(ROOT, "04_Mods", modFileName(mod));
    if (
      writeIfMissing(modPath, generateModMarkdown({ id: mod }), {
        overwrite: options.overwriteGenerated,
        preserveManual: true,
      })
    ) {
      changed.push(modPath);
    }
  }

  const recipePath = path.join(ROOT, "02_Recipes", recipeFileName(recipe));
  if (
    writeIfMissing(recipePath, generateRecipeMarkdown(recipe), {
      overwrite: options.overwriteRecipes || options.overwriteGenerated,
      preserveManual: options.overwriteGenerated,
    })
  ) {
    changed.push(recipePath);
  }

  return changed;
}

function importTag(tag, options = {}) {
  const filePath = path.join(ROOT, "05_tags", tagFileName(tag.id));
  if (
    writeIfMissing(filePath, generateTagMarkdown(tag), {
      overwrite: options.overwriteGenerated,
      preserveManual: true,
    })
  ) {
    return [filePath];
  }
  return [];
}

function importTargets(targets, options = {}) {
  const files = targets.flatMap(listImportFiles);
  const errors = [];
  const rawRecipes = [];
  const rawTags = [];

  for (const file of files) {
    try {
      rawRecipes.push(...readRecipeObjectsFromFile(file));
      rawTags.push(...readTagObjectsFromFile(file));
    } catch (error) {
      errors.push({ file, message: error.message });
    }
  }

  const normalized = [];
  for (const raw of rawRecipes) {
    try {
      normalized.push(normalizeRecipe(raw));
    } catch (error) {
      errors.push({
        file: raw && raw.__sourcePath ? raw.__sourcePath : "unknown recipe",
        message: error.message,
      });
    }
  }

  const tags = mergeTagDefinitions([
    ...rawTags.map(normalizeTagDefinition),
    ...referencedTagsFromRecipes(normalized),
  ]);
  const changed = normalized.flatMap((recipe) => importRecipe(recipe, options));
  changed.push(...tags.flatMap((tag) => importTag(tag, options)));
  const pruneResult = options.pruneUninstalled
    ? pruneUninstalledNamespaces(options.pruneTargets && options.pruneTargets.length ? options.pruneTargets : targets)
    : { deleted: [], installedNamespaces: new Set(), errors: [] };
  const itemRecipeLinksChanged = options.updateItemRecipeLinks === false ? 0 : updateItemRecipeLinks();
  return {
    files,
    recipes: normalized,
    changed,
    errors: errors.concat(pruneResult.errors),
    itemRecipeLinksChanged,
    pruned: pruneResult.deleted,
    installedNamespaces: pruneResult.installedNamespaces,
  };
}

function main(argv) {
  const overwriteRecipes = argv.includes("--overwrite-recipes");
  const overwriteGenerated = argv.includes("--overwrite-generated");
  const pruneUninstalled = argv.includes("--prune-uninstalled");
  const targets = argv.filter((arg) =>
    arg !== "--overwrite-recipes" && arg !== "--overwrite-generated" && arg !== "--prune-uninstalled");
  if (!targets.length) {
    console.error("Usage: node 00_System/Scripts/importRecipes.js [--overwrite-recipes] [--overwrite-generated] [--prune-uninstalled] path/to/recipes.json|examples/|mod.jar|mods/");
    process.exit(1);
  }

  const result = importTargets(targets, { overwriteRecipes, overwriteGenerated, pruneUninstalled });
  console.log(`Imported ${result.recipes.length} recipe(s) from ${result.files.length} file(s).`);
  console.log(`Created or updated ${result.changed.length} note(s).`);
  if (pruneUninstalled) {
    console.log(`Detected ${result.installedNamespaces.size} installed namespace(s).`);
    console.log(`Deleted ${result.pruned.length} generated note(s) for uninstalled namespaces.`);
  }
  console.log(`Updated ${result.itemRecipeLinksChanged} item note(s) with static recipe links.`);
  if (result.errors.length) {
    console.log(`Skipped ${result.errors.length} file(s) or recipe(s) with errors.`);
    for (const error of result.errors.slice(0, 20)) {
      console.log(`- ${error.file}: ${error.message}`);
    }
    if (result.errors.length > 20) {
      console.log(`... ${result.errors.length - 20} more error(s) omitted.`);
    }
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  ROOT,
  importRecipe,
  importTargets,
  listImportFiles,
  readRecipeObjectsFromFile,
  readRecipesFromFile,
  readTagObjectsFromFile,
  writeIfMissing,
};
