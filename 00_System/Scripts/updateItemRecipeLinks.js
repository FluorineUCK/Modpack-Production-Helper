const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const ITEM_DIR = path.join(ROOT, "01_Items");
const RECIPE_DIR = path.join(ROOT, "02_Recipes");
const TAG_DIR = path.join(ROOT, "05_tags");

const SECTION_START = "<!-- BEGIN GENERATED RECIPE LINKS -->";
const SECTION_END = "<!-- END GENERATED RECIPE LINKS -->";

function noteLinkForFile(folder, fileName) {
  return `[[${folder}/${fileName.replace(/\.md$/i, "")}]]`;
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
    const inline = lines.find((line) => line.trim().startsWith(`${field}: [`));
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

function extractRecipe(fileName) {
  const fullPath = path.join(RECIPE_DIR, fileName);
  const markdown = fs.readFileSync(fullPath, "utf8");
  return {
    link: noteLinkForFile("02_Recipes", fileName),
    method: extractYamlValue(markdown, "method") || "unknown",
    machine: extractYamlValue(markdown, "machine"),
    mod: extractYamlValue(markdown, "mod"),
    inputs: extractYamlList(markdown, "input_links"),
    outputs: extractYamlList(markdown, "output_links"),
  };
}

function extractTagMembers(fileName) {
  const fullPath = path.join(TAG_DIR, fileName);
  const markdown = fs.readFileSync(fullPath, "utf8");
  return {
    link: noteLinkForFile("05_tags", fileName),
    members: extractYamlList(markdown, "members"),
    childTags: extractYamlList(markdown, "child_tags"),
  };
}

function buildTagMemberIndex() {
  const index = new Map();
  if (!fs.existsSync(TAG_DIR)) {
    return index;
  }

  for (const fileName of fs.readdirSync(TAG_DIR).filter((name) => name.endsWith(".md"))) {
    const tag = extractTagMembers(fileName);
    index.set(tag.link, [...tag.members, ...tag.childTags]);
  }

  return index;
}

function buildRecipeIndex() {
  const producedBy = new Map();
  const usedIn = new Map();
  const tagMembers = buildTagMemberIndex();

  for (const fileName of fs.readdirSync(RECIPE_DIR).filter((name) => name.endsWith(".md"))) {
    const recipe = extractRecipe(fileName);

    for (const output of recipe.outputs) {
      if (!producedBy.has(output)) {
        producedBy.set(output, []);
      }
      producedBy.get(output).push(recipe);
    }

    for (const input of recipe.inputs) {
      if (!usedIn.has(input)) {
        usedIn.set(input, []);
      }
      usedIn.get(input).push(recipe);

      for (const member of tagMembers.get(input) || []) {
        if (!usedIn.has(member)) {
          usedIn.set(member, []);
        }
        usedIn.get(member).push(recipe);
      }
    }
  }

  return { producedBy, usedIn };
}

function relationSuffix(recipe, direction) {
  const parts = [recipe.method];
  if (recipe.mod) {
    parts.push(recipe.mod);
  }
  if (recipe.machine) {
    parts.push(recipe.machine);
  }
  const related = direction === "used"
    ? recipe.outputs.map((link) => `-> ${link}`).join(", ")
    : recipe.inputs.map((link) => `from ${link}`).join(", ");
  if (related) {
    parts.push(related);
  }
  return parts.join("; ");
}

function renderDirectItemList(recipes) {
  const entries = new Map();

  for (const recipe of recipes || []) {
    for (const output of recipe.outputs) {
      if (!entries.has(output)) {
        entries.set(output, []);
      }
      entries.get(output).push(recipe);
    }
  }

  if (!entries.size) {
    return "- None";
  }

  return [...entries.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([output, outputRecipes]) => {
      const recipeLinks = outputRecipes
        .slice()
        .sort((a, b) => a.link.localeCompare(b.link))
        .map((recipe) => `${recipe.link} (${recipe.method}; ${recipe.mod}; ${recipe.machine})`)
        .join(", ");
      return `- ${output} via ${recipeLinks}`;
    })
    .join("\n");
}

function renderRecipeList(recipes, direction) {
  if (!recipes || !recipes.length) {
    return "- None";
  }

  return recipes
    .slice()
    .sort((a, b) => a.link.localeCompare(b.link))
    .map((recipe) => `- ${recipe.link} (${relationSuffix(recipe, direction)})`)
    .join("\n");
}

function renderGeneratedSection(itemLink, index) {
  return `## Static Recipe Links

${SECTION_START}

### Produced By

${renderRecipeList(index.producedBy.get(itemLink), "produced")}

### Used In

${renderRecipeList(index.usedIn.get(itemLink), "used")}

### Can Become

${renderDirectItemList(index.usedIn.get(itemLink))}

${SECTION_END}`;
}

function updateGeneratedSection(markdown, section) {
  const blockPattern = new RegExp(
    `## Static Recipe Links\\s+${SECTION_START}[\\s\\S]*?${SECTION_END}`,
    "m",
  );

  if (blockPattern.test(markdown)) {
    return markdown.replace(blockPattern, section);
  }

  const producedByIndex = markdown.indexOf("\n## Produced By");
  if (producedByIndex !== -1) {
    return `${markdown.slice(0, producedByIndex).trimEnd()}\n\n${section}\n${markdown.slice(producedByIndex)}`;
  }

  const manualNotesIndex = markdown.indexOf("\n## Manual Notes");
  if (manualNotesIndex !== -1) {
    return `${markdown.slice(0, manualNotesIndex).trimEnd()}\n\n${section}\n${markdown.slice(manualNotesIndex)}`;
  }

  return `${markdown.trimEnd()}\n\n${section}\n`;
}

function updateItemRecipeLinks() {
  const index = buildRecipeIndex();
  let changed = 0;

  for (const fileName of fs.readdirSync(ITEM_DIR).filter((name) => name.endsWith(".md"))) {
    const fullPath = path.join(ITEM_DIR, fileName);
    const itemLink = noteLinkForFile("01_Items", fileName);
    const markdown = fs.readFileSync(fullPath, "utf8");
    const section = renderGeneratedSection(itemLink, index);
    const next = updateGeneratedSection(markdown, section);
    if (next !== markdown) {
      fs.writeFileSync(fullPath, next, "utf8");
      changed += 1;
    }
  }

  return changed;
}

if (require.main === module) {
  const changed = updateItemRecipeLinks();
  console.log(`Updated ${changed} item note(s) with static recipe links.`);
}

module.exports = {
  buildRecipeIndex,
  extractRecipe,
  extractTagMembers,
  renderGeneratedSection,
  renderDirectItemList,
  updateGeneratedSection,
  updateItemRecipeLinks,
};
