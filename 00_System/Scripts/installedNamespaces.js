const fs = require("fs");
const path = require("path");
const { readEntries, readEntryContent, stripBom } = require("./readZipRecipes");

function isArchivePath(filePath) {
  return /\.(jar|zip)$/i.test(filePath);
}

function listArchives(target) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${target}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return isArchivePath(resolved) ? [resolved] : [];
  }

  return fs.readdirSync(resolved, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(resolved, entry.name);
    if (entry.isDirectory()) {
      return entry.name.startsWith(".") ? [] : listArchives(child);
    }
    return isArchivePath(child) ? [child] : [];
  });
}

function readEntryText(archive, entryName) {
  const entry = archive.entries.find((candidate) => candidate.name === entryName);
  if (!entry) {
    return "";
  }
  return stripBom(readEntryContent(archive.buffer, entry).toString("utf8"));
}

function collectTomlModIds(text) {
  const ids = [];
  const blockPattern = /\[\[mods\]\]([\s\S]*?)(?=\n\[\[|$)/g;
  for (const block of text.matchAll(blockPattern)) {
    const match = block[1].match(/\bmodId\s*=\s*"([^"]+)"/);
    if (match) {
      ids.push(match[1]);
    }
  }
  return ids;
}

function collectJsonModId(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed.id === "string" ? [parsed.id] : [];
  } catch {
    return [];
  }
}

function namespacesFromArchive(filePath) {
  const archive = readEntries(filePath);
  const namespaces = new Set();

  for (const entryName of [
    "META-INF/neoforge.mods.toml",
    "META-INF/mods.toml",
  ]) {
    for (const modId of collectTomlModIds(readEntryText(archive, entryName))) {
      namespaces.add(modId);
    }
  }

  for (const entryName of ["fabric.mod.json", "quilt.mod.json"]) {
    for (const modId of collectJsonModId(readEntryText(archive, entryName))) {
      namespaces.add(modId);
    }
  }

  return namespaces;
}

function detectInstalledNamespaces(targets) {
  const namespaces = new Set(["minecraft"]);
  const errors = [];

  for (const target of targets) {
    for (const archivePath of listArchives(target)) {
      try {
        for (const namespace of namespacesFromArchive(archivePath)) {
          namespaces.add(namespace);
        }
      } catch (error) {
        errors.push({ file: archivePath, message: error.message });
      }
    }
  }

  return { namespaces, errors };
}

module.exports = {
  detectInstalledNamespaces,
  collectTomlModIds,
  listArchives,
  namespacesFromArchive,
};
