const { Plugin, Modal, Notice, Setting } = require("obsidian");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

const DEFAULT_MACHINE_BY_METHOD = {
  smelting: "minecraft:furnace",
  blasting: "minecraft:blast_furnace",
  smoking: "minecraft:smoker",
  campfire_cooking: "minecraft:campfire",
  stonecutting: "minecraft:stonecutter",
  shaped_crafting: "minecraft:crafting_table",
  shapeless_crafting: "minecraft:crafting_table",
  item_copying: "minecraft:crafting_table",
  smithing_transform: "minecraft:smithing_table",
  crushing: "create:crushing_wheel",
  item_application: "create:deployer",
  milling: "create:millstone",
  mixing: "create:mechanical_mixer",
  pressing: "create:mechanical_press",
  sandpaper_polishing: "create:sandpaper",
  cutting: "create:mechanical_saw",
  compacting: "create:mechanical_press",
  deploying: "create:deployer",
  emptying: "create:item_drain",
  filling: "create:spout",
  haunting: "create:encased_fan",
  mechanical_crafting: "create:mechanical_crafter",
  sequenced_assembly: "create:deployer",
  splashing: "create:encased_fan",
  toolbox_dyeing: "create:toolbox",
  enriching: "mekanism:enrichment_chamber",
  pulverizing: "thermal:pulverizer",
};

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseNamespace(id) {
  const value = String(id || "").trim();
  if (!value) return { namespace: "unknown", path: "unknown" };
  const clean = value.startsWith("#") ? value.slice(1) : value;
  const index = clean.indexOf(":");
  if (index === -1) return { namespace: "minecraft", path: clean };
  return { namespace: clean.slice(0, index) || "unknown", path: clean.slice(index + 1) || "unknown" };
}

function safeFileName(value) {
  return String(value || "unknown")
    .trim()
    .replace(/^#/, "tag.")
    .replace(/[:/\\]+/g, ".")
    .replace(/\s+/g, "_")
    .replace(/[<>:"|?*\x00-\x1f]/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .toLowerCase();
}

function noteName(prefix, id) {
  const safe = safeFileName(id);
  return safe.startsWith(`${prefix}.`) ? safe : `${prefix}.${safe}`;
}

function itemNoteName(id) { return noteName("item", id); }
function machineNoteName(id) { return noteName("machine", id); }
function modNoteName(id) { return noteName("mod", id); }
function tagNoteName(id) { return noteName("tag", id); }
function recipeNoteName(recipe) { return noteName("recipe", recipe.id || `${recipe.type || "unknown"}.${Date.now()}`); }
function itemFileName(id) { return `${itemNoteName(id)}.md`; }
function machineFileName(id) { return `${machineNoteName(id)}.md`; }
function modFileName(id) { return `${modNoteName(id)}.md`; }
function tagFileName(id) { return `${tagNoteName(id)}.md`; }
function recipeFileName(recipe) { return `${recipeNoteName(recipe)}.md`; }
function wikiLink(note) { return `[[${note}]]`; }
function itemLink(id) { return wikiLink(`01_Items/${itemNoteName(id)}`); }
function machineLink(id) { return wikiLink(`03_Machines/${machineNoteName(id)}`); }
function modLink(id) { return wikiLink(`04_Mods/${modNoteName(id)}`); }
function tagLink(id) { return wikiLink(`05_tags/${tagNoteName(id)}`); }

function displayNameFromId(id) {
  const { path: idPath } = parseNamespace(id);
  return idPath.split(/[._/-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || "Unknown";
}

function escapeYamlString(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function methodFromType(type) {
  const raw = String(type || "unknown");
  const idPath = parseNamespace(raw).path;
  return idPath.replace(/^crafting_/, "").replace(/[^a-z0-9_]+/gi, "_") || "unknown";
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function findEndOfCentralDirectory(buffer) {
  const start = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= start; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new Error("ZIP end of central directory not found");
}

function readEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid central directory record at offset ${offset}`);
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);
    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return { buffer, entries };
}

function readEntryContent(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) throw new Error(`Invalid local file record for ${entry.name}`);
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}`);
}

function isRecipeEntry(name) {
  return /^data\/[^/]+\/recipes?\/.+\.json$/i.test(name);
}

function isTagEntry(name) {
  return /^data\/[^/]+\/tags\/(item|items|fluid|fluids)\/.+\.json$/i.test(name);
}

function tagInfoFromEntry(name) {
  const match = String(name).match(/^data\/([^/]+)\/tags\/(item|items|fluid|fluids)\/(.+)\.json$/i);
  if (!match) return null;
  return {
    id: `#${match[1]}:${match[3]}`,
    namespace: match[1],
    registry: match[2].startsWith("fluid") ? "fluid" : "item",
    path: match[3],
  };
}

function readArchiveJson(zipPath, filter, mapper) {
  const { buffer, entries } = readEntries(zipPath);
  return entries.filter((entry) => filter(entry.name)).flatMap((entry) => {
    try {
      const parsed = JSON.parse(stripBom(readEntryContent(buffer, entry).toString("utf8")));
      return mapper(entry, parsed);
    } catch {
      return [];
    }
  });
}

function readRecipesFromArchive(zipPath) {
  return readArchiveJson(zipPath, isRecipeEntry, (entry, parsed) => {
    const recipes = Array.isArray(parsed) ? parsed : [parsed];
    return recipes.map((recipe) => {
      if (recipe && typeof recipe === "object") {
        Object.defineProperty(recipe, "__sourcePath", { value: entry.name, enumerable: false });
      }
      return recipe;
    });
  });
}

function readTagsFromArchive(zipPath) {
  return readArchiveJson(zipPath, isTagEntry, (entry, parsed) => {
    const info = tagInfoFromEntry(entry.name);
    return info ? [{ ...info, raw: parsed, sourcePath: entry.name, sourceArchive: path.basename(zipPath) }] : [];
  });
}

function normalizeMethod(type, json) {
  const typeMethod = methodFromType(type);
  const explicit = firstValue(json.method, json.process, json.processingType);
  if (explicit) return String(explicit);
  if (typeMethod === "shaped" || typeMethod === "crafting_shaped") return "shaped_crafting";
  if (typeMethod === "shapeless" || typeMethod === "crafting_shapeless") return "shapeless_crafting";
  if (typeMethod.includes("pulverizer")) return "pulverizing";
  if (typeMethod.includes("enriching")) return "enriching";
  return typeMethod;
}

function normalizeIngredient(value, options = {}) {
  const role = options.role || "input";
  const inheritedCount = Number(options.count || 1);
  if (typeof value === "string") return [{ id: value, kind: "item", count: inheritedCount, role }];
  if (Array.isArray(value)) return value.flatMap((entry) => normalizeIngredient(entry, { role, count: inheritedCount }));
  if (!value || typeof value !== "object") return [];
  const count = Number(firstValue(value.count, value.amount, value.quantity, inheritedCount) || 1);
  if (value.item || value.id) return [{ id: String(value.item || value.id), kind: value.fluid ? "fluid" : "item", count, role }];
  if (value.tag) return [{ id: `#${String(value.tag).replace(/^#/, "")}`, kind: "tag", count, role }];
  if (value.fluid) return [{ id: String(value.fluid), kind: "fluid", count, role }];
  if (value.ingredient) return normalizeIngredient(value.ingredient, { role, count });
  if (value.ingredients) return asArray(value.ingredients).flatMap((entry) => normalizeIngredient(entry, { role, count }));
  return [];
}

function normalizeOutput(value, options = {}) {
  const role = options.role || "main_output";
  if (typeof value === "string") return [{ id: value, kind: "item", count: 1, chance: 1, role }];
  if (Array.isArray(value)) return value.flatMap((entry, index) => normalizeOutput(entry, { role: index === 0 ? role : "byproduct" }));
  if (!value || typeof value !== "object") return [];
  const id = firstValue(value.item, value.id, value.result, value.fluid);
  if (typeof id === "object") return normalizeOutput(id, { role });
  if (!id) return [];
  return [{ id: String(id), kind: value.fluid ? "fluid" : "item", count: Number(firstValue(value.count, value.amount, value.quantity, 1) || 1), chance: Number(firstValue(value.chance, value.probability, 1) || 1), role }];
}

function aggregateInputs(inputs) {
  const byKey = new Map();
  for (const input of inputs) {
    const key = `${input.kind}:${input.id}:${input.role}`;
    const current = byKey.get(key);
    if (current) current.count += Number(input.count || 1);
    else byKey.set(key, { ...input, count: Number(input.count || 1) });
  }
  return [...byKey.values()];
}

function normalizeShapedInputs(json) {
  const pattern = asArray(json.pattern);
  const key = json.key || {};
  const counts = {};
  for (const row of pattern) {
    for (const char of String(row)) if (char !== " ") counts[char] = (counts[char] || 0) + 1;
  }
  return Object.entries(counts).flatMap(([char, count]) => normalizeIngredient(key[char], { count }));
}

function idFromSourcePath(sourcePath) {
  const match = String(sourcePath || "").match(/^data\/([^/]+)\/recipes?\/(.+)\.json$/i);
  return match ? `${match[1]}:${match[2]}` : "";
}

function slugFromOutputs(outputs) {
  const first = outputs.find((output) => output.id) || outputs[0];
  return first ? parseNamespace(first.id).path.replace(/[/.]+/g, "_") : "unknown_output";
}

function normalizeRecipe(json) {
  const type = String(firstValue(json.type, json.recipe_type, "unknown:unknown"));
  const method = normalizeMethod(type, json);
  const sourceId = idFromSourcePath(json.__sourcePath);
  const namespace = parseNamespace(firstValue(json.id, sourceId, type)).namespace;
  const mod = firstValue(json.mod, namespace);
  const inputs = method === "shaped_crafting"
    ? normalizeShapedInputs(json)
    : asArray(firstValue(json.ingredients, json.inputs, json.input, json.ingredient, json.itemInput)).flatMap((entry) => normalizeIngredient(entry));
  const outputs = asArray(firstValue(json.results, json.outputs, json.output, json.result, json.itemOutput)).flatMap((entry, index) => normalizeOutput(entry, { role: index === 0 ? "main_output" : "byproduct" }));
  const status = inputs.length && outputs.length ? "auto" : "check";
  return {
    id: String(firstValue(json.id, sourceId, `${namespace}:${method}/${slugFromOutputs(outputs)}`)),
    type,
    method,
    namespace,
    mod,
    machine: String(firstValue(json.machine, json.processingMachine, DEFAULT_MACHINE_BY_METHOD[method], `${mod}:unknown_machine`)),
    stage: firstValue(json.stage, "unknown"),
    status,
    time: Number(firstValue(json.cookingtime, json.processingTime, json.processing_time, json.time, json.duration, 0) || 0),
    energy: Number(firstValue(json.energy, json.fe, json.power, 0) || 0),
    inputs: aggregateInputs(inputs),
    outputs,
    raw: json,
  };
}

function noteForEntry(entry) {
  return entry.kind === "tag" ? tagLink(entry.id) : itemLink(entry.id);
}

function generateItemMarkdown(item) {
  const { namespace, path: itemPath } = parseNamespace(item.id);
  const displayName = item.display_name || displayNameFromId(item.id);
  const category = item.category || (item.kind === "fluid" ? "fluid" : "unknown");
  const stage = item.stage || "unknown";
  const status = item.status || "auto";
  return `---
type: item
schema: 1
id: "${escapeYamlString(item.id)}"
namespace: "${escapeYamlString(namespace)}"
path: "${escapeYamlString(itemPath)}"
display_name: "${escapeYamlString(displayName)}"
mod: "${modLink(namespace)}"
category: "${escapeYamlString(category)}"
stage: "${escapeYamlString(stage)}"
status: "${escapeYamlString(status)}"
tags:
  - item
  - item/${category}
  - mod/${namespace}
  - stage/${stage}
  - status/${status}
aliases:
  - ${escapeYamlString(item.id)}
  - ${escapeYamlString(displayName)}
---

# ${displayName}

\`${item.id}\`

## Basic Information

- Item ID:: ${item.id}
- Mod:: ${modLink(namespace)}
- Category:: ${category}
- Stage:: ${stage}
- Status:: ${status}

## Produced By

\`\`\`dataview
TABLE method AS Process, machine AS Machine, input_links AS Inputs, time AS Time, energy AS Energy
FROM "02_Recipes"
WHERE contains(output_links, this.file.link)
SORT method ASC
\`\`\`

## Used In

\`\`\`dataview
TABLE method AS Process, machine AS Machine, output_links AS Outputs
FROM "02_Recipes"
WHERE contains(input_links, this.file.link)
SORT method ASC
\`\`\`

## Manual Notes

-
`;
}

function generateMachineMarkdown(machine) {
  const { namespace } = parseNamespace(machine.id);
  const displayName = machine.display_name || displayNameFromId(machine.id);
  const methods = machine.methods && machine.methods.length ? machine.methods : ["unknown"];
  return `---
type: machine
schema: 1
id: "${escapeYamlString(machine.id)}"
display_name: "${escapeYamlString(displayName)}"
mod: "${modLink(namespace)}"
methods:
${methods.map((method) => `  - ${method}`).join("\n")}
tags:
  - machine
${methods.map((method) => `  - process/${method}`).join("\n")}
  - mod/${namespace}
---

# ${displayName}

\`${machine.id}\`

## Supported Processes

${methods.map((method) => `- ${method}`).join("\n")}

## Recipes Using This Machine

\`\`\`dataview
TABLE input_links AS Inputs, output_links AS Outputs, time AS Time, energy AS Energy
FROM "02_Recipes"
WHERE contains(machine_links, this.file.link)
SORT file.name ASC
\`\`\`
`;
}

function generateModMarkdown(mod) {
  const displayName = mod.display_name || displayNameFromId(`${mod.id}:${mod.id}`);
  return `---
type: mod
schema: 1
id: "${escapeYamlString(mod.id)}"
display_name: "${escapeYamlString(displayName)}"
tags:
  - mod
  - mod/${mod.id}
---

# ${displayName}

## Items

\`\`\`dataview
TABLE id AS ID, category AS Category, stage AS Stage
FROM "01_Items"
WHERE mod = this.file.link
SORT id ASC
\`\`\`

## Recipes

\`\`\`dataview
TABLE method AS Process, input_links AS Inputs, output_links AS Outputs
FROM "02_Recipes"
WHERE mod = this.file.link
SORT method ASC
\`\`\`
`;
}

function generateTagMarkdown(tag) {
  const id = tag.id.startsWith("#") ? tag.id : `#${tag.id}`;
  const { namespace, path: tagPath } = parseNamespace(id);
  const registry = tag.registry || "item";
  const status = tag.status || (tag.members && tag.members.length ? "auto" : "check");
  const declaredBy = [...new Set(tag.declared_by || [])].sort();
  const members = [...new Set(tag.members || [])].sort();
  const childTags = [...new Set(tag.child_tags || [])].sort();
  return `---
type: tag
schema: 1
id: "${escapeYamlString(id)}"
tag_namespace: "${escapeYamlString(namespace)}"
tag_path: "${escapeYamlString(tagPath)}"
registry: "${escapeYamlString(registry)}"
kind: "${registry === "fluid" ? "fluid_tag" : "item_tag"}"
status: "${escapeYamlString(status)}"
declared_by:
${declaredBy.length ? declaredBy.map((provider) => `  - "${escapeYamlString(provider)}"`).join("\n") : "  []"}
members:
${members.length ? members.map((member) => `  - "${member}"`).join("\n") : "  []"}
child_tags:
${childTags.length ? childTags.map((child) => `  - "${child}"`).join("\n") : "  []"}
tags:
  - tag
  - tag/${registry}
  - tag_namespace/${namespace}
  - status/${status}
aliases:
  - ${escapeYamlString(id)}
---

# ${id}

## Members

${members.length ? members.map((member) => `- ${member}`).join("\n") : "- None"}

## Child Tags

${childTags.length ? childTags.map((child) => `- ${child}`).join("\n") : "- None"}
`;
}

function generateRecipeMarkdown(recipe) {
  const inputLinks = recipe.inputs.map(noteForEntry);
  const outputLinks = recipe.outputs.map(noteForEntry);
  const machine = machineLink(recipe.machine);
  const yamlInputs = recipe.inputs.map((input) => `  - id: "${escapeYamlString(input.id)}"
    note: "${escapeYamlString(noteForEntry(input))}"
    count: ${input.count}
    role: "${escapeYamlString(input.role)}"
    kind: "${escapeYamlString(input.kind)}"`).join("\n");
  const yamlOutputs = recipe.outputs.map((output) => `  - id: "${escapeYamlString(output.id)}"
    note: "${escapeYamlString(noteForEntry(output))}"
    count: ${output.count}
    chance: ${output.chance}
    role: "${escapeYamlString(output.role)}"
    kind: "${escapeYamlString(output.kind)}"`).join("\n");
  return `---
type: recipe
schema: 1
id: "${escapeYamlString(recipe.id)}"
method: "${escapeYamlString(recipe.method)}"
machine: "${machine}"
mod: "${modLink(recipe.mod)}"
stage: "${escapeYamlString(recipe.stage)}"
status: "${escapeYamlString(recipe.status)}"

input_links:${inputLinks.length ? `\n${inputLinks.map((link) => `  - "${link}"`).join("\n")}` : " []"}

output_links:${outputLinks.length ? `\n${outputLinks.map((link) => `  - "${link}"`).join("\n")}` : " []"}

machine_links:
  - "${machine}"

inputs:${yamlInputs ? `\n${yamlInputs}` : " []"}

outputs:${yamlOutputs ? `\n${yamlOutputs}` : " []"}

time: ${recipe.time}
energy: ${recipe.energy}

tags:
  - recipe
  - process/${recipe.method}
  - mod/${recipe.mod}
  - stage/${recipe.stage}
  - status/${recipe.status}
---

# Recipe: ${recipe.outputs[0] ? recipe.outputs[0].id : "Unknown Output"} / ${recipe.method}

## Relation

${recipe.inputs.map((input) => `- Input: ${noteForEntry(input)} x ${input.count}`).join("\n") || "- Input: unknown"}
- Process: ${recipe.method}
- Machine: ${machine}
${recipe.outputs.map((output) => `- Output: ${noteForEntry(output)} x ${output.count}`).join("\n") || "- Output: unknown"}

## Flowchart

\`\`\`mermaid
flowchart LR
${recipe.inputs.map((input, index) => `    I${index}["${input.id.replace(/"/g, '\\"')}"] --> R["${recipe.method.replace(/"/g, '\\"')}"]`).join("\n") || '    I0["unknown input"] --> R["unknown"]'}
${recipe.outputs.map((output, index) => `    R --> O${index}["${output.id.replace(/"/g, '\\"')}"]`).join("\n") || '    R --> O0["unknown output"]'}
\`\`\`

## Inputs

| Item | Count | Kind | Role |
|---|---:|---|---|
${recipe.inputs.map((input) => `| ${noteForEntry(input)} | ${input.count} | ${input.kind} | ${input.role} |`).join("\n") || "| unknown | 0 | unknown | input |"}

## Outputs

| Item | Count | Chance | Kind | Role |
|---|---:|---:|---|---|
${recipe.outputs.map((output) => `| ${noteForEntry(output)} | ${output.count} | ${output.chance} | ${output.kind} | ${output.role} |`).join("\n") || "| unknown | 0 | 0 | unknown | main_output |"}

## Raw JSON

\`\`\`json
${JSON.stringify(recipe.raw || {}, null, 2)}
\`\`\`
`;
}

function isArchivePath(filePath) {
  return /\.(jar|zip)$/i.test(filePath);
}

function isImportPath(filePath) {
  return /\.(json|jar|zip)$/i.test(filePath);
}

function listImportFiles(target) {
  if (!fs.existsSync(target)) throw new Error(`Path does not exist: ${target}`);
  const stat = fs.statSync(target);
  if (stat.isFile()) return isImportPath(target) ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith(".") ? [] : listImportFiles(child);
    return isImportPath(child) ? [child] : [];
  });
}

function normalizeTagDefinition(tag) {
  const values = Array.isArray(tag.raw && tag.raw.values) ? tag.raw.values : [];
  const members = [];
  const childTags = [];
  for (const value of values) {
    const id = typeof value === "string" ? value : value && value.id;
    if (!id) continue;
    if (String(id).startsWith("#")) childTags.push(tagLink(id));
    else members.push(itemLink(id));
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
    const current = merged.get(tag.id) || { id: tag.id, registry: tag.registry || "item", declared_by: [], members: [], child_tags: [], status: "check" };
    current.declared_by.push(...(tag.declared_by || []));
    current.members.push(...(tag.members || []));
    current.child_tags.push(...(tag.child_tags || []));
    if (tag.status === "auto") current.status = "auto";
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
  return recipes.flatMap((recipe) => recipe.inputs.filter((input) => input.kind === "tag").map((input) => ({
    id: input.id,
    registry: "item",
    declared_by: [],
    members: [],
    child_tags: [],
    status: "check",
  })));
}

function collectTomlModIds(text) {
  const ids = [];
  const blockPattern = /\[\[mods\]\]([\s\S]*?)(?=\n\[\[|$)/g;
  for (const block of text.matchAll(blockPattern)) {
    const match = block[1].match(/\bmodId\s*=\s*"([^"]+)"/);
    if (match) ids.push(match[1]);
  }
  return ids;
}

function namespacesFromArchive(filePath) {
  const archive = readEntries(filePath);
  const namespaces = new Set();
  for (const entryName of ["META-INF/neoforge.mods.toml", "META-INF/mods.toml"]) {
    const entry = archive.entries.find((candidate) => candidate.name === entryName);
    if (entry) for (const modId of collectTomlModIds(stripBom(readEntryContent(archive.buffer, entry).toString("utf8")))) namespaces.add(modId);
  }
  for (const entryName of ["fabric.mod.json", "quilt.mod.json"]) {
    const entry = archive.entries.find((candidate) => candidate.name === entryName);
    if (entry) {
      try {
        const parsed = JSON.parse(stripBom(readEntryContent(archive.buffer, entry).toString("utf8")));
        if (parsed && typeof parsed.id === "string") namespaces.add(parsed.id);
      } catch {}
    }
  }
  return namespaces;
}

function detectInstalledNamespaces(files) {
  const namespaces = new Set(["minecraft"]);
  for (const file of files.filter(isArchivePath)) {
    try {
      for (const namespace of namespacesFromArchive(file)) namespaces.add(namespace);
    } catch {}
  }
  return namespaces;
}

function frontmatterValue(markdown, field) {
  const match = markdown.match(new RegExp(`^${field}:\\s*"?([^"\\r\\n]+)"?\\s*$`, "m"));
  return match ? match[1].trim() : "";
}

function namespacesFromLinks(markdown, prefix) {
  return [...markdown.matchAll(new RegExp(`\\[\\[[^\\]]+\\/${prefix}\\.([a-z0-9_.-]+?)\\.`, "gi"))].map((match) => match[1]);
}

function shouldDeleteGeneratedNote(relativeDir, markdown, installed) {
  if (/status:\s*"?manual"?/i.test(markdown)) return false;
  if (relativeDir === "01_Items" || relativeDir === "03_Machines") return !installed.has(parseNamespace(frontmatterValue(markdown, "id")).namespace);
  if (relativeDir === "04_Mods") return !installed.has(frontmatterValue(markdown, "id"));
  if (relativeDir === "02_Recipes") {
    const recipeId = frontmatterValue(markdown, "id");
    const modMatch = frontmatterValue(markdown, "mod").match(/\[\[04_Mods\/mod\.([^\]]+)\]\]/);
    const recipeMod = modMatch ? modMatch[1] : parseNamespace(recipeId).namespace;
    const compatMatch = recipeId.split(":").slice(1).join(":").match(/(?:^|\/)compat\/([^/]+)/i);
    return !installed.has(recipeMod)
      || namespacesFromLinks(markdown, "item").some((namespace) => !installed.has(namespace))
      || namespacesFromLinks(markdown, "machine").some((namespace) => !installed.has(namespace))
      || (compatMatch && !installed.has(compatMatch[1]));
  }
  return false;
}

function writeIfMissing(root, relPath, content, options = {}) {
  const fullPath = path.join(root, relPath);
  if (fs.existsSync(fullPath)) {
    if (!options.overwrite) return false;
    const existing = fs.readFileSync(fullPath, "utf8");
    if (options.preserveManual && /status:\s*"?manual"?/i.test(existing)) return false;
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  return true;
}

function extractYamlValue(markdown, field) {
  return frontmatterValue(markdown, field);
}

function extractYamlList(markdown, field) {
  const lines = markdown.split(/\r?\n/);
  const values = [];
  const start = lines.findIndex((line) => line.trim() === `${field}:`);
  if (start === -1) return [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z_]+:/.test(line)) break;
    const match = line.match(/^\s*-\s+"?([^"\r\n]+)"?\s*$/);
    if (match) values.push(match[1]);
  }
  return values;
}

function noteLinkForFile(folder, fileName) {
  return `[[${folder}/${fileName.replace(/\.md$/i, "")}]]`;
}

function readRecipes(root) {
  const dir = path.join(root, "02_Recipes");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((fileName) => fileName.endsWith(".md")).map((fileName) => {
    const markdown = fs.readFileSync(path.join(dir, fileName), "utf8");
    return {
      link: noteLinkForFile("02_Recipes", fileName),
      method: extractYamlValue(markdown, "method") || "unknown",
      machine: extractYamlValue(markdown, "machine"),
      mod: extractYamlValue(markdown, "mod"),
      inputs: extractYamlList(markdown, "input_links"),
      outputs: extractYamlList(markdown, "output_links"),
    };
  }).filter((recipe) => recipe.inputs.length && recipe.outputs.length);
}

function readTags(root) {
  const dir = path.join(root, "05_tags");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((fileName) => fileName.endsWith(".md")).map((fileName) => {
    const markdown = fs.readFileSync(path.join(dir, fileName), "utf8");
    return { link: noteLinkForFile("05_tags", fileName), members: extractYamlList(markdown, "members"), childTags: extractYamlList(markdown, "child_tags") };
  });
}

function buildItemGraph(recipes, tags) {
  const graph = new Map();
  const addEdge = (from, edge) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from).push(edge);
  };
  for (const tag of tags) {
    for (const member of tag.members) addEdge(member, { kind: "tag", tag: tag.link, output: tag.link });
    for (const childTag of tag.childTags) addEdge(childTag, { kind: "tag", tag: tag.link, output: tag.link });
  }
  for (const recipe of recipes) {
    for (const input of recipe.inputs) for (const output of recipe.outputs) addEdge(input, { kind: "recipe", recipe, output });
  }
  return graph;
}

function findItemPaths(root, fromItem, toItem, options = {}) {
  const graph = buildItemGraph(readRecipes(root), readTags(root));
  const maxDepth = Number(options.maxDepth || 4);
  const limit = Number(options.limit || 20);
  const queue = [{ item: fromItem, steps: [], visitedItems: new Set([fromItem]) }];
  const paths = [];
  while (queue.length && paths.length < limit) {
    const current = queue.shift();
    if (current.steps.length >= maxDepth) continue;
    for (const edge of graph.get(current.item) || []) {
      const nextSteps = current.steps.concat([{ from: current.item, kind: edge.kind, tag: edge.tag, recipe: edge.recipe, to: edge.output }]);
      if (edge.output === toItem) {
        paths.push(nextSteps);
        if (paths.length >= limit) break;
      } else if (!current.visitedItems.has(edge.output)) {
        queue.push({ item: edge.output, steps: nextSteps, visitedItems: new Set([...current.visitedItems, edge.output]) });
      }
    }
  }
  return paths;
}

function renderPath(pathSteps, index) {
  const lines = [`## Path ${index + 1}`, ""];
  for (const step of pathSteps) {
    if (step.kind === "tag") {
      lines.push(`- ${step.from} -> ${step.tag}`);
    } else {
      lines.push(`- ${step.from} -> ${step.recipe.link} -> ${step.to}`);
      lines.push(`  - Method: ${step.recipe.method}`);
      if (step.recipe.machine) lines.push(`  - Machine: ${step.recipe.machine}`);
      if (step.recipe.mod) lines.push(`  - Mod: ${step.recipe.mod}`);
    }
  }
  return lines.join("\n");
}

function renderPaths(from, to, paths, options = {}) {
  const header = [`# Paths: ${from} to ${to}`, "", `Max recipe steps: ${options.maxDepth || 4}`, `Path limit: ${options.limit || 20}`].join("\n");
  if (!paths.length) return `${header}\n\nNo path found.`;
  return [header, `Found ${paths.length} path(s).`, ...paths.map(renderPath)].join("\n\n");
}

function mermaidLabel(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ");
}

function stepTitle(step, index) {
  if (step.kind === "tag") return `${index + 1}. Tag match: ${step.from} -> ${step.tag}`;
  return `${index + 1}. ${step.from} -> ${step.to}`;
}

function renderEntryList(entries, chosen) {
  if (!entries || !entries.length) return "- None";
  return entries.map((entry) => {
    const link = noteForEntry(entry);
    const parts = [`${link} x ${entry.count}`];
    if (entry.kind) parts.push(entry.kind);
    if (entry.role) parts.push(entry.role);
    if (entry.chance !== undefined && entry.chance !== 1) parts.push(`chance ${entry.chance}`);
    if (chosen && link === chosen) parts.push("tracked");
    return `- ${parts.join("; ")}`;
  }).join("\n");
}

function renderTrackMermaid(pathSteps) {
  const lines = ["```mermaid", "flowchart LR"];
  const nodeIds = new Map();
  const nodeFor = (label) => {
    if (!nodeIds.has(label)) nodeIds.set(label, `N${nodeIds.size}`);
    return nodeIds.get(label);
  };
  for (const step of pathSteps) {
    const fromId = nodeFor(step.from);
    const toId = nodeFor(step.to);
    lines.push(`  ${fromId}["${mermaidLabel(step.from)}"]`);
    lines.push(`  ${toId}["${mermaidLabel(step.to)}"]`);
    if (step.kind === "tag") {
      lines.push(`  ${fromId} -->|matches tag| ${toId}`);
    } else {
      const recipeId = nodeFor(step.recipe.link);
      lines.push(`  ${recipeId}["${mermaidLabel(`${step.recipe.method}: ${step.recipe.link}`)}"]`);
      lines.push(`  ${fromId} --> ${recipeId}`);
      lines.push(`  ${recipeId} --> ${toId}`);
    }
  }
  lines.push("```");
  return lines.join("\n");
}

function renderProductionTrackPath(pathSteps, index) {
  const lines = [`## Track ${index + 1}`, "", "### Graph", "", renderTrackMermaid(pathSteps), "", "### Steps", ""];
  for (const [stepIndex, step] of pathSteps.entries()) {
    lines.push(`#### ${stepTitle(step, stepIndex)}`);
    if (step.kind === "tag") {
      lines.push(`- Source item/tag: ${step.from}`);
      lines.push(`- Satisfies tag: ${step.tag}`);
      lines.push("");
      continue;
    }
    const recipe = step.recipe;
    lines.push(`- Recipe: ${recipe.link}`);
    lines.push(`- Method: ${recipe.method}`);
    if (recipe.machine) lines.push(`- Machine: ${recipe.machine}`);
    if (recipe.mod) lines.push(`- Mod: ${recipe.mod}`);
    lines.push("");
    lines.push("Inputs:");
    lines.push(renderEntryList(recipe.inputEntries || [], step.from));
    lines.push("");
    lines.push("Outputs:");
    lines.push(renderEntryList(recipe.outputEntries || [], step.to));
    lines.push("");
  }
  return lines.join("\n");
}

function renderProductionTrack(from, to, paths, options = {}) {
  const header = [
    `# Production Track: ${from} to ${to}`,
    "",
    `Max recipe/tag steps: ${options.maxDepth || 4}`,
    `Track limit: ${options.limit || 10}`,
    "",
    "This note tracks how the source item can move through tags and recipes toward the target item. Recipe sections show the full input/output context, not only the followed edge.",
  ].join("\n");
  if (!paths.length) return `${header}\n\nNo production track found.`;
  return [header, `Found ${paths.length} track(s).`, ...paths.map(renderProductionTrackPath)].join("\n\n");
}

function normalizeItemReference(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Item reference cannot be empty");
  const wikiMatch = raw.match(/^\[\[([^\]]+)\]\]$/);
  if (wikiMatch) return `[[${wikiMatch[1]}]]`;
  if (raw.startsWith("01_Items/")) return `[[${raw.replace(/\.md$/i, "")}]]`;
  if (raw.startsWith("item.")) return `[[01_Items/${raw.replace(/\.md$/i, "")}]]`;
  return itemLink(raw);
}

function buildRecipeIndex(root) {
  const producedBy = new Map();
  const usedIn = new Map();
  const tagMembers = new Map();
  for (const tag of readTags(root)) tagMembers.set(tag.link, [...tag.members, ...tag.childTags]);
  for (const recipe of readRecipes(root)) {
    for (const output of recipe.outputs) {
      if (!producedBy.has(output)) producedBy.set(output, []);
      producedBy.get(output).push(recipe);
    }
    for (const input of recipe.inputs) {
      if (!usedIn.has(input)) usedIn.set(input, []);
      usedIn.get(input).push(recipe);
      for (const member of tagMembers.get(input) || []) {
        if (!usedIn.has(member)) usedIn.set(member, []);
        usedIn.get(member).push(recipe);
      }
    }
  }
  return { producedBy, usedIn };
}

function renderRecipeList(recipes, direction) {
  if (!recipes || !recipes.length) return "- None";
  return recipes.slice().sort((a, b) => a.link.localeCompare(b.link)).map((recipe) => {
    const related = direction === "used"
      ? recipe.outputs.map((link) => `-> ${link}`).join(", ")
      : recipe.inputs.map((link) => `from ${link}`).join(", ");
    return `- ${recipe.link} (${[recipe.method, recipe.mod, recipe.machine, related].filter(Boolean).join("; ")})`;
  }).join("\n");
}

function renderDirectItemList(recipes) {
  const entries = new Map();
  for (const recipe of recipes || []) {
    for (const output of recipe.outputs) {
      if (!entries.has(output)) entries.set(output, []);
      entries.get(output).push(recipe);
    }
  }
  if (!entries.size) return "- None";
  return [...entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([output, outputRecipes]) => {
    const via = outputRecipes.map((recipe) => `${recipe.link} (${recipe.method}; ${recipe.mod}; ${recipe.machine})`).join(", ");
    return `- ${output} via ${via}`;
  }).join("\n");
}

function updateItemRecipeLinks(root) {
  const itemDir = path.join(root, "01_Items");
  if (!fs.existsSync(itemDir)) return 0;
  const index = buildRecipeIndex(root);
  let changed = 0;
  for (const fileName of fs.readdirSync(itemDir).filter((name) => name.endsWith(".md"))) {
    const filePath = path.join(itemDir, fileName);
    const item = noteLinkForFile("01_Items", fileName);
    const markdown = fs.readFileSync(filePath, "utf8");
    const section = `## Static Recipe Links

<!-- BEGIN GENERATED RECIPE LINKS -->

### Produced By

${renderRecipeList(index.producedBy.get(item), "produced")}

### Used In

${renderRecipeList(index.usedIn.get(item), "used")}

### Can Become

${renderDirectItemList(index.usedIn.get(item))}

<!-- END GENERATED RECIPE LINKS -->`;
    const pattern = /## Static Recipe Links\s+<!-- BEGIN GENERATED RECIPE LINKS -->[\s\S]*?<!-- END GENERATED RECIPE LINKS -->/m;
    const next = pattern.test(markdown)
      ? markdown.replace(pattern, section)
      : markdown.replace(/\n## Produced By/, `\n\n${section}\n\n## Produced By`);
    if (next !== markdown) {
      fs.writeFileSync(filePath, next, "utf8");
      changed += 1;
    }
  }
  return changed;
}

function ensureBasePath(plugin) {
  const basePath = plugin.app.vault.adapter && plugin.app.vault.adapter.basePath;
  if (!basePath) throw new Error("This plugin requires Obsidian desktop with a local file-system vault.");
  return basePath;
}

function importVault(root, materialRelPath, options) {
  const target = path.join(root, materialRelPath);
  const files = listImportFiles(target);
  const rawRecipes = [];
  const rawTags = [];
  const errors = [];
  for (const file of files) {
    try {
      if (isArchivePath(file)) {
        rawRecipes.push(...readRecipesFromArchive(file));
        rawTags.push(...readTagsFromArchive(file));
      } else {
        const parsed = JSON.parse(stripBom(fs.readFileSync(file, "utf8")));
        rawRecipes.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      }
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  const recipes = rawRecipes.map(normalizeRecipe);
  const tags = mergeTagDefinitions([...rawTags.map(normalizeTagDefinition), ...referencedTagsFromRecipes(recipes)]);
  let changed = 0;
  for (const recipe of recipes) {
    const itemIds = [...recipe.inputs.filter((input) => input.kind !== "tag").map((input) => input.id), ...recipe.outputs.filter((output) => output.kind !== "tag").map((output) => output.id)];
    const mods = new Set([recipe.mod, parseNamespace(recipe.machine).namespace]);
    for (const id of itemIds) {
      const ns = parseNamespace(id).namespace;
      mods.add(ns);
      const entry = recipe.inputs.find((input) => input.id === id) || recipe.outputs.find((output) => output.id === id);
      changed += writeIfMissing(root, path.join("01_Items", itemFileName(id)), generateItemMarkdown({ id, kind: entry.kind, stage: recipe.stage, status: recipe.status }), { overwrite: options.overwriteGenerated, preserveManual: true }) ? 1 : 0;
    }
    changed += writeIfMissing(root, path.join("03_Machines", machineFileName(recipe.machine)), generateMachineMarkdown({ id: recipe.machine, methods: [recipe.method] }), { overwrite: options.overwriteGenerated, preserveManual: true }) ? 1 : 0;
    for (const mod of mods) changed += writeIfMissing(root, path.join("04_Mods", modFileName(mod)), generateModMarkdown({ id: mod }), { overwrite: options.overwriteGenerated, preserveManual: true }) ? 1 : 0;
    changed += writeIfMissing(root, path.join("02_Recipes", recipeFileName(recipe)), generateRecipeMarkdown(recipe), { overwrite: options.overwriteGenerated || options.overwriteRecipes, preserveManual: options.overwriteGenerated }) ? 1 : 0;
  }
  for (const tag of tags) changed += writeIfMissing(root, path.join("05_tags", tagFileName(tag.id)), generateTagMarkdown(tag), { overwrite: options.overwriteGenerated, preserveManual: true }) ? 1 : 0;
  let deleted = 0;
  if (options.pruneUninstalled) {
    const installed = detectInstalledNamespaces(files);
    for (const dir of ["01_Items", "02_Recipes", "03_Machines", "04_Mods"]) {
      const fullDir = path.join(root, dir);
      if (!fs.existsSync(fullDir)) continue;
      for (const fileName of fs.readdirSync(fullDir).filter((name) => name.endsWith(".md"))) {
        const filePath = path.join(fullDir, fileName);
        const markdown = fs.readFileSync(filePath, "utf8");
        if (shouldDeleteGeneratedNote(dir, markdown, installed)) {
          fs.unlinkSync(filePath);
          deleted += 1;
        }
      }
    }
  }
  const itemLinksChanged = updateItemRecipeLinks(root);
  return { files: files.length, recipes: recipes.length, tags: tags.length, changed, deleted, itemLinksChanged, errors };
}

class ImportModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.materialPath = "06_Materials";
    this.overwriteGenerated = true;
    this.pruneUninstalled = true;
  }

  onOpen() {
    this.contentEl.addClass("mph-modal");
    this.contentEl.createEl("h2", { text: "Import Modpack Production Data" });
    new Setting(this.contentEl).setName("Material folder").setDesc("Folder containing mod JARs, ZIPs, or recipe JSON files.").addText((text) => text.setValue(this.materialPath).onChange((value) => this.materialPath = value.trim() || "06_Materials"));
    new Setting(this.contentEl).setName("Overwrite generated notes").addToggle((toggle) => toggle.setValue(this.overwriteGenerated).onChange((value) => this.overwriteGenerated = value));
    new Setting(this.contentEl).setName("Prune uninstalled compat notes").addToggle((toggle) => toggle.setValue(this.pruneUninstalled).onChange((value) => this.pruneUninstalled = value));
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Import").setCta().onClick(async () => {
      try {
        const root = ensureBasePath(this.plugin);
        new Notice("Import started. Obsidian may pause while JARs are scanned.");
        const result = importVault(root, this.materialPath, { overwriteGenerated: this.overwriteGenerated, pruneUninstalled: this.pruneUninstalled });
        new Notice(`Imported ${result.recipes} recipes, generated ${result.tags} tags, updated ${result.changed} notes, pruned ${result.deleted}.`);
        this.close();
      } catch (error) {
        new Notice(`Import failed: ${error.message}`);
      }
    }));
  }
}

class PathModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.from = "minecraft:cobblestone";
    this.to = "minecraft:sand";
    this.maxDepth = 4;
    this.limit = 20;
    this.outputPath = "99_Views/Item Paths/Item Paths.md";
  }

  onOpen() {
    this.contentEl.addClass("mph-modal");
    this.contentEl.createEl("h2", { text: "Find Item Paths" });
    new Setting(this.contentEl).setName("From item").addText((text) => text.setValue(this.from).onChange((value) => this.from = value));
    new Setting(this.contentEl).setName("To item").addText((text) => text.setValue(this.to).onChange((value) => this.to = value));
    new Setting(this.contentEl).setName("Max recipe/tag steps").addText((text) => text.setValue(String(this.maxDepth)).onChange((value) => this.maxDepth = Number(value || 4)));
    new Setting(this.contentEl).setName("Path limit").addText((text) => text.setValue(String(this.limit)).onChange((value) => this.limit = Number(value || 20)));
    new Setting(this.contentEl).setName("Output note").setDesc("Leave blank to show a notice only.").addText((text) => text.setValue(this.outputPath).onChange((value) => this.outputPath = value));
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Find paths").setCta().onClick(async () => {
      try {
        const root = ensureBasePath(this.plugin);
        const from = normalizeItemReference(this.from);
        const to = normalizeItemReference(this.to);
        const paths = findItemPaths(root, from, to, { maxDepth: this.maxDepth, limit: this.limit });
        const markdown = renderPaths(from, to, paths, { maxDepth: this.maxDepth, limit: this.limit });
        if (this.outputPath) {
          const fullPath = path.join(root, this.outputPath.endsWith(".md") ? this.outputPath : `${this.outputPath}.md`);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, `${markdown}\n`, "utf8");
          new Notice(`Wrote ${paths.length} path(s) to ${this.outputPath}`);
        } else {
          new Notice(`Found ${paths.length} path(s). Set an output note to save them.`);
        }
        this.close();
      } catch (error) {
        new Notice(`Path search failed: ${error.message}`);
      }
    }));
  }
}

class ProductionTrackModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.from = "minecraft:cobblestone";
    this.to = "minecraft:sand";
    this.maxDepth = 5;
    this.limit = 10;
    this.outputPath = "99_Views/Item Paths/Production Track.md";
  }

  onOpen() {
    this.contentEl.addClass("mph-modal");
    this.contentEl.createEl("h2", { text: "Track Production" });
    new Setting(this.contentEl).setName("From item").setDesc("The starting item or item note.").addText((text) => text.setValue(this.from).onChange((value) => this.from = value));
    new Setting(this.contentEl).setName("To item").setDesc("The target item or item note.").addText((text) => text.setValue(this.to).onChange((value) => this.to = value));
    new Setting(this.contentEl).setName("Max recipe/tag steps").addText((text) => text.setValue(String(this.maxDepth)).onChange((value) => this.maxDepth = Number(value || 5)));
    new Setting(this.contentEl).setName("Track limit").addText((text) => text.setValue(String(this.limit)).onChange((value) => this.limit = Number(value || 10)));
    new Setting(this.contentEl).setName("Output note").setDesc("Leave blank to show a notice only.").addText((text) => text.setValue(this.outputPath).onChange((value) => this.outputPath = value));
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Track production").setCta().onClick(async () => {
      try {
        const root = ensureBasePath(this.plugin);
        const from = normalizeItemReference(this.from);
        const to = normalizeItemReference(this.to);
        const paths = findItemPaths(root, from, to, { maxDepth: this.maxDepth, limit: this.limit });
        const markdown = renderProductionTrack(from, to, paths, { maxDepth: this.maxDepth, limit: this.limit });
        if (this.outputPath) {
          const fullPath = path.join(root, this.outputPath.endsWith(".md") ? this.outputPath : `${this.outputPath}.md`);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, `${markdown}\n`, "utf8");
          new Notice(`Wrote ${paths.length} production track(s) to ${this.outputPath}`);
        } else {
          new Notice(`Found ${paths.length} production track(s). Set an output note to save them.`);
        }
        this.close();
      } catch (error) {
        new Notice(`Production tracking failed: ${error.message}`);
      }
    }));
  }
}

module.exports = class ModpackProductionHelperPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: "import-modpack-production",
      name: "Import from material folder",
      callback: () => new ImportModal(this.app, this).open(),
    });
    this.addCommand({
      id: "find-item-paths",
      name: "Find item paths",
      callback: () => new PathModal(this.app, this).open(),
    });
    this.addCommand({
      id: "track-production-between-items",
      name: "Track production from item A to B",
      callback: () => new ProductionTrackModal(this.app, this).open(),
    });
    this.addRibbonIcon("network", "Import modpack production data", () => new ImportModal(this.app, this).open());
  }
};
