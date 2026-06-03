#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { itemLink } = require("./nameUtils");

const ROOT = path.resolve(__dirname, "..", "..");
const RECIPE_DIR = path.join(ROOT, "02_Recipes");
const TAG_DIR = path.join(ROOT, "05_tags");

function noteLinkForFile(folder, fileName) {
  return `[[${folder}/${fileName.replace(/\.md$/i, "")}]]`;
}

function normalizeItemReference(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("Item reference cannot be empty");
  }

  const wikiMatch = raw.match(/^\[\[([^\]]+)\]\]$/);
  if (wikiMatch) {
    return `[[${wikiMatch[1]}]]`;
  }

  if (raw.startsWith("01_Items/")) {
    return `[[${raw.replace(/\.md$/i, "")}]]`;
  }

  if (raw.startsWith("item.")) {
    return `[[01_Items/${raw.replace(/\.md$/i, "")}]]`;
  }

  return itemLink(raw);
}

function extractYamlValue(markdown, field) {
  const match = markdown.match(new RegExp(`^${field}:\\s*"?([^"\\r\\n]+)"?\\s*$`, "m"));
  return match ? match[1].trim() : "";
}

function extractYamlList(markdown, field) {
  const lines = markdown.split(/\r?\n/);
  const values = [];
  const start = lines.findIndex((line) => line.trim() === `${field}:`);

  if (start === -1) {
    const inline = lines.find((line) => line.trim() === `${field}: []`);
    return inline ? [] : values;
  }

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[A-Za-z_]+:/.test(line)) {
      break;
    }
    const match = line.match(/^\s*-\s+"?([^"\r\n]+)"?\s*$/);
    if (match) {
      values.push(match[1]);
    }
  }

  return values;
}

function readRecipes(recipeDir = RECIPE_DIR) {
  if (!fs.existsSync(recipeDir)) {
    return [];
  }

  return fs.readdirSync(recipeDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const markdown = fs.readFileSync(path.join(recipeDir, fileName), "utf8");
      return {
        link: noteLinkForFile("02_Recipes", fileName),
        method: extractYamlValue(markdown, "method") || "unknown",
        machine: extractYamlValue(markdown, "machine"),
        mod: extractYamlValue(markdown, "mod"),
        inputs: extractYamlList(markdown, "input_links"),
        outputs: extractYamlList(markdown, "output_links"),
      };
    })
    .filter((recipe) => recipe.inputs.length && recipe.outputs.length);
}

function readTags(tagDir = TAG_DIR) {
  if (!fs.existsSync(tagDir)) {
    return [];
  }

  return fs.readdirSync(tagDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const markdown = fs.readFileSync(path.join(tagDir, fileName), "utf8");
      return {
        link: noteLinkForFile("05_tags", fileName),
        members: extractYamlList(markdown, "members"),
        childTags: extractYamlList(markdown, "child_tags"),
      };
    });
}

function buildItemGraph(recipes, tags = []) {
  const graph = new Map();

  for (const tag of tags) {
    for (const member of tag.members) {
      if (!graph.has(member)) {
        graph.set(member, []);
      }
      graph.get(member).push({
        kind: "tag",
        tag: tag.link,
        output: tag.link,
      });
    }

    for (const childTag of tag.childTags) {
      if (!graph.has(childTag)) {
        graph.set(childTag, []);
      }
      graph.get(childTag).push({
        kind: "tag",
        tag: tag.link,
        output: tag.link,
      });
    }
  }

  for (const recipe of recipes) {
    for (const input of recipe.inputs) {
      if (!graph.has(input)) {
        graph.set(input, []);
      }
      for (const output of recipe.outputs) {
        graph.get(input).push({
          kind: "recipe",
          recipe,
          output,
        });
      }
    }
  }

  for (const edges of graph.values()) {
    edges.sort((a, b) =>
      a.output.localeCompare(b.output) || (a.recipe ? a.recipe.link : a.tag).localeCompare(b.recipe ? b.recipe.link : b.tag));
  }

  return graph;
}

function findItemPaths(fromItem, toItem, options = {}) {
  const maxDepth = Number(options.maxDepth || 4);
  const limit = Number(options.limit || 20);
  const graph = options.graph || buildItemGraph(
    options.recipes || readRecipes(options.recipeDir),
    options.tags || readTags(options.tagDir),
  );
  const queue = [
    {
      item: fromItem,
      steps: [],
      visitedItems: new Set([fromItem]),
    },
  ];
  const paths = [];

  while (queue.length && paths.length < limit) {
    const current = queue.shift();

    if (current.steps.length >= maxDepth) {
      continue;
    }

    for (const edge of graph.get(current.item) || []) {
      const nextSteps = current.steps.concat([{
        from: current.item,
        kind: edge.kind,
        tag: edge.tag,
        recipe: edge.recipe,
        to: edge.output,
      }]);

      if (edge.output === toItem) {
        paths.push(nextSteps);
        if (paths.length >= limit) {
          break;
        }
        continue;
      }

      if (!current.visitedItems.has(edge.output)) {
        queue.push({
          item: edge.output,
          steps: nextSteps,
          visitedItems: new Set([...current.visitedItems, edge.output]),
        });
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
      continue;
    }

    lines.push(`- ${step.from} -> ${step.recipe.link} -> ${step.to}`);
    lines.push(`  - Method: ${step.recipe.method}`);
    if (step.recipe.machine) {
      lines.push(`  - Machine: ${step.recipe.machine}`);
    }
    if (step.recipe.mod) {
      lines.push(`  - Mod: ${step.recipe.mod}`);
    }
  }

  return lines.join("\n");
}

function renderMarkdown(fromItem, toItem, paths, options = {}) {
  const header = [
    `# Paths: ${fromItem} to ${toItem}`,
    "",
    `Max recipe steps: ${options.maxDepth || 4}`,
    `Path limit: ${options.limit || 20}`,
  ].join("\n");

  if (!paths.length) {
    return `${header}\n\nNo path found.`;
  }

  return [
    header,
    `Found ${paths.length} path(s).`,
    ...paths.map(renderPath),
  ].join("\n\n");
}

function parseArgs(argv) {
  const options = {
    maxDepth: 4,
    limit: 20,
    format: "markdown",
    write: "",
  };
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--max-depth") {
      options.maxDepth = Number(argv[++index]);
    } else if (arg === "--limit") {
      options.limit = Number(argv[++index]);
    } else if (arg === "--json") {
      options.format = "json";
    } else if (arg === "--write") {
      options.write = argv[++index];
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw new Error("Usage: node 00_System/Scripts/findItemPaths.js <from item> <to item> [--max-depth 4] [--limit 20] [--json] [--write path.md]");
  }

  return {
    from: normalizeItemReference(positional[0]),
    to: normalizeItemReference(positional[1]),
    options,
  };
}

function main(argv) {
  const { from, to, options } = parseArgs(argv);
  const paths = findItemPaths(from, to, options);
  const output = options.format === "json"
    ? JSON.stringify({ from, to, paths }, null, 2)
    : renderMarkdown(from, to, paths, options);

  if (options.write) {
    const outputPath = path.resolve(ROOT, options.write);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${output}\n`, "utf8");
    console.log(`Wrote ${paths.length} path(s) to ${options.write}`);
  } else {
    console.log(output);
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  buildItemGraph,
  findItemPaths,
  normalizeItemReference,
  readRecipes,
  readTags,
  renderMarkdown,
};
