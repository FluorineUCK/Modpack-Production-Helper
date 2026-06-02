const { displayNameFromId, escapeYamlString, modNoteName } = require("./nameUtils");

function generateModMarkdown(mod) {
  const id = mod.id;
  const displayName = mod.display_name || displayNameFromId(`${id}:${id}`);

  return `---
type: mod
schema: 1
id: "${escapeYamlString(id)}"
display_name: "${escapeYamlString(displayName)}"
tags:
  - mod
  - mod/${id}
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

module.exports = { generateModMarkdown, modNoteName };
