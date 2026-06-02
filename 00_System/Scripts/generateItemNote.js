const {
  displayNameFromId,
  escapeYamlString,
  itemNoteName,
  modLink,
  parseNamespace,
} = require("./nameUtils");

function generateItemMarkdown(item) {
  const id = item.id;
  const { namespace, path } = parseNamespace(id);
  const displayName = item.display_name || displayNameFromId(id);
  const category = item.category || (item.kind === "fluid" ? "fluid" : "unknown");
  const stage = item.stage || "unknown";
  const status = item.status || "auto";
  const itemModLink = modLink(namespace);

  return `---
type: item
schema: 1
id: "${escapeYamlString(id)}"
namespace: "${escapeYamlString(namespace)}"
path: "${escapeYamlString(path)}"
display_name: "${escapeYamlString(displayName)}"
mod: "${itemModLink}"
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
  - ${escapeYamlString(id)}
  - ${escapeYamlString(displayName)}
---

# ${displayName}

\`${id}\`

## Basic Information

- Item ID:: ${id}
- Mod:: ${itemModLink}
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

module.exports = { generateItemMarkdown, itemNoteName };
