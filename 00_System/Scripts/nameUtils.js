function parseNamespace(id) {
  const value = String(id || "").trim();
  if (!value) {
    return { namespace: "unknown", path: "unknown" };
  }

  const clean = value.startsWith("#") ? value.slice(1) : value;
  const index = clean.indexOf(":");
  if (index === -1) {
    return { namespace: "minecraft", path: clean };
  }

  return {
    namespace: clean.slice(0, index) || "unknown",
    path: clean.slice(index + 1) || "unknown",
  };
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

function itemNoteName(id) {
  return noteName("item", id);
}

function machineNoteName(id) {
  return noteName("machine", id);
}

function modNoteName(id) {
  return noteName("mod", id);
}

function tagNoteName(id) {
  return noteName("tag", id);
}

function recipeNoteName(recipe) {
  return noteName("recipe", recipe.id || `${recipe.type || "unknown"}.${Date.now()}`);
}

function itemFileName(id) {
  return `${itemNoteName(id)}.md`;
}

function machineFileName(id) {
  return `${machineNoteName(id)}.md`;
}

function modFileName(id) {
  return `${modNoteName(id)}.md`;
}

function tagFileName(id) {
  return `${tagNoteName(id)}.md`;
}

function recipeFileName(recipe) {
  return `${recipeNoteName(recipe)}.md`;
}

function wikiLink(note) {
  return `[[${note}]]`;
}

function itemLink(id) {
  return wikiLink(`01_Items/${itemNoteName(id)}`);
}

function machineLink(id) {
  return wikiLink(`03_Machines/${machineNoteName(id)}`);
}

function modLink(id) {
  return wikiLink(`04_Mods/${modNoteName(id)}`);
}

function tagLink(id) {
  return wikiLink(`05_tags/${tagNoteName(id)}`);
}

function displayNameFromId(id) {
  const { path } = parseNamespace(id);
  return path
    .split(/[._/-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown";
}

function methodFromType(type) {
  const raw = String(type || "unknown");
  const path = parseNamespace(raw).path;
  return path.replace(/^crafting_/, "").replace(/[^a-z0-9_]+/gi, "_") || "unknown";
}

function escapeYamlString(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function slugFromOutputs(outputs) {
  const first = outputs.find((output) => output.id) || outputs[0];
  if (!first) {
    return "unknown_output";
  }
  return parseNamespace(first.id).path.replace(/[/.]+/g, "_");
}

module.exports = {
  displayNameFromId,
  escapeYamlString,
  itemFileName,
  itemLink,
  itemNoteName,
  machineFileName,
  machineLink,
  machineNoteName,
  methodFromType,
  modFileName,
  modLink,
  modNoteName,
  parseNamespace,
  recipeFileName,
  recipeNoteName,
  safeFileName,
  slugFromOutputs,
  tagFileName,
  tagLink,
  tagNoteName,
  wikiLink,
};
