const {
  escapeYamlString,
  parseNamespace,
  tagNoteName,
} = require("./nameUtils");

function tagKind(registry) {
  if (registry === "fluid" || registry === "fluids") {
    return "fluid_tag";
  }
  return "item_tag";
}

function generateTagMarkdown(tag) {
  const id = tag.id.startsWith("#") ? tag.id : `#${tag.id}`;
  const { namespace, path } = parseNamespace(id);
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
tag_path: "${escapeYamlString(path)}"
registry: "${escapeYamlString(registry)}"
kind: "${tagKind(registry)}"
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

## Basic Information

- Tag ID:: ${id}
- Registry:: ${registry}
- Namespace:: ${namespace}
- Path:: ${path}
- Status:: ${status}

## Declared By

${declaredBy.length ? declaredBy.map((provider) => `- ${provider}`).join("\n") : "- Unknown"}

## Members

${members.length ? members.map((member) => `- ${member}`).join("\n") : "- None"}

## Child Tags

${childTags.length ? childTags.map((child) => `- ${child}`).join("\n") : "- None"}

## Used In Recipes

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

module.exports = {
  generateTagMarkdown,
  tagNoteName,
};
