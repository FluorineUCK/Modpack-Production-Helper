<%*
const pathFinder = require(app.vault.adapter.basePath + "/00_System/Scripts/findItemPaths.js");

const from = await tp.system.prompt("From item ID or note link, e.g. minecraft:cobblestone");
if (!from) {
  tR += "Path search cancelled.";
  return;
}

const to = await tp.system.prompt("To item ID or note link, e.g. minecraft:sand");
if (!to) {
  tR += "Path search cancelled.";
  return;
}

const maxDepthInput = await tp.system.prompt("Maximum recipe steps", "4");
const limitInput = await tp.system.prompt("Maximum paths to show", "20");
const safeTitlePart = (value) => value
  .replace(/^\[\[/, "")
  .replace(/\]\]$/, "")
  .replace(/^01_Items\//, "")
  .replace(/\.md$/i, "")
  .replace(/[^a-zA-Z0-9._-]+/g, "_");
const defaultOutput = `99_Views/Item Paths/${safeTitlePart(from)} to ${safeTitlePart(to)} Paths.md`;
const writeTarget = await tp.system.prompt("Output note path. Leave blank to insert into current note.", defaultOutput);

const fromLink = pathFinder.normalizeItemReference(from);
const toLink = pathFinder.normalizeItemReference(to);
const maxDepth = Number(maxDepthInput || 4);
const limit = Number(limitInput || 20);
const paths = pathFinder.findItemPaths(fromLink, toLink, { maxDepth, limit });
const output = pathFinder.renderMarkdown(fromLink, toLink, paths, { maxDepth, limit });

if (writeTarget) {
  const targetPath = writeTarget.endsWith(".md") ? writeTarget : `${writeTarget}.md`;
  await app.vault.adapter.write(targetPath, output + "\n");
  tR += `Wrote ${paths.length} path(s) to [[${targetPath.replace(/\.md$/i, "")}]].`;
} else {
  tR += output;
}
%>
