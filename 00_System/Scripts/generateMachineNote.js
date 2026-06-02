const {
  displayNameFromId,
  escapeYamlString,
  machineNoteName,
  modLink,
  parseNamespace,
} = require("./nameUtils");

function generateMachineMarkdown(machine) {
  const id = machine.id;
  const { namespace } = parseNamespace(id);
  const displayName = machine.display_name || displayNameFromId(id);
  const methods = machine.methods && machine.methods.length ? machine.methods : ["unknown"];

  return `---
type: machine
schema: 1
id: "${escapeYamlString(id)}"
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

\`${id}\`

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

module.exports = { generateMachineMarkdown, machineNoteName };
