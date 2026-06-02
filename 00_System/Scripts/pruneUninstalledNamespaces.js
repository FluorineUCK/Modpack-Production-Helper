const fs = require("fs");
const path = require("path");
const { detectInstalledNamespaces } = require("./installedNamespaces");

const ROOT = path.resolve(__dirname, "..", "..");
const NOTE_DIRS = ["01_Items", "02_Recipes", "03_Machines", "04_Mods"];

function isManual(markdown) {
  return /status:\s*"?manual"?/i.test(markdown);
}

function frontmatterValue(markdown, field) {
  const match = markdown.match(new RegExp(`^${field}:\\s*"?([^"\\r\\n]+)"?\\s*$`, "m"));
  return match ? match[1].trim() : "";
}

function namespaceFromId(id) {
  const clean = String(id || "").replace(/^#/, "");
  const index = clean.indexOf(":");
  if (index === -1) {
    return "minecraft";
  }
  return clean.slice(0, index);
}

function namespacesFromItemLinks(markdown) {
  return [...markdown.matchAll(/\[\[01_Items\/item\.([a-z0-9_.-]+?)\.[^\]]+\]\]/gi)]
    .map((match) => match[1]);
}

function namespacesFromMachineLinks(markdown) {
  return [...markdown.matchAll(/\[\[03_Machines\/machine\.([a-z0-9_.-]+?)\.[^\]]+\]\]/gi)]
    .map((match) => match[1]);
}

function compatNamespacesFromRecipeId(id) {
  const pathPart = String(id || "").split(":").slice(1).join(":");
  const match = pathPart.match(/(?:^|\/)compat\/([^/]+)/i);
  return match ? [match[1]] : [];
}

function shouldKeepNamespace(namespace, installed) {
  return installed.has(namespace);
}

function shouldDeleteNote(relativeDir, markdown, installed) {
  if (isManual(markdown)) {
    return false;
  }

  if (relativeDir === "01_Items") {
    return !shouldKeepNamespace(namespaceFromId(frontmatterValue(markdown, "id")), installed);
  }

  if (relativeDir === "03_Machines") {
    return !shouldKeepNamespace(namespaceFromId(frontmatterValue(markdown, "id")), installed);
  }

  if (relativeDir === "04_Mods") {
    return !shouldKeepNamespace(frontmatterValue(markdown, "id"), installed);
  }

  if (relativeDir === "02_Recipes") {
    const recipeId = frontmatterValue(markdown, "id");
    const recipeModLink = frontmatterValue(markdown, "mod");
    const recipeModMatch = recipeModLink.match(/\[\[04_Mods\/mod\.([^\]]+)\]\]/);
    const recipeMod = recipeModMatch ? recipeModMatch[1] : namespaceFromId(recipeId);
    if (!shouldKeepNamespace(recipeMod, installed)) {
      return true;
    }

    return namespacesFromItemLinks(markdown).some((namespace) => !shouldKeepNamespace(namespace, installed))
      || namespacesFromMachineLinks(markdown).some((namespace) => !shouldKeepNamespace(namespace, installed))
      || compatNamespacesFromRecipeId(recipeId).some((namespace) => !shouldKeepNamespace(namespace, installed));
  }

  return false;
}

function assertInsideRoot(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ROOT + path.sep)) {
    throw new Error(`Refusing to delete outside project root: ${resolved}`);
  }
}

function pruneUninstalledNamespaces(targets) {
  const detection = detectInstalledNamespaces(targets);
  const deleted = [];

  for (const relativeDir of NOTE_DIRS) {
    const dir = path.join(ROOT, relativeDir);
    if (!fs.existsSync(dir)) {
      continue;
    }

    for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".md"))) {
      const filePath = path.join(dir, fileName);
      const markdown = fs.readFileSync(filePath, "utf8");
      if (shouldDeleteNote(relativeDir, markdown, detection.namespaces)) {
        assertInsideRoot(filePath);
        fs.unlinkSync(filePath);
        deleted.push(filePath);
      }
    }
  }

  return {
    deleted,
    installedNamespaces: detection.namespaces,
    errors: detection.errors,
  };
}

if (require.main === module) {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error("Usage: node 00_System/Scripts/pruneUninstalledNamespaces.js path/to/mods-or-materials");
    process.exit(1);
  }
  const result = pruneUninstalledNamespaces(targets);
  console.log(`Detected ${result.installedNamespaces.size} installed namespace(s).`);
  console.log(`Deleted ${result.deleted.length} generated note(s) for uninstalled namespaces.`);
  if (result.errors.length) {
    console.log(`Skipped ${result.errors.length} archive(s) while detecting namespaces.`);
  }
}

module.exports = {
  compatNamespacesFromRecipeId,
  pruneUninstalledNamespaces,
  shouldDeleteNote,
};
