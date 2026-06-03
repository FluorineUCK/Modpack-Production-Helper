const {
  escapeYamlString,
  itemLink,
  itemNoteName,
  machineLink,
  machineNoteName,
  modLink,
  modNoteName,
  recipeNoteName,
  tagLink,
} = require("./nameUtils");

function noteForEntry(entry) {
  if (entry.kind === "tag") {
    return tagLink(entry.id);
  }
  return itemLink(entry.id);
}

function lineForEntry(prefix, entry) {
  const label = noteForEntry(entry) || entry.id;
  return `- ${prefix}: ${label} x ${entry.count}`;
}

function mermaidLabel(value) {
  return String(value).replace(/"/g, '\\"');
}

function generateRecipeMarkdown(recipe) {
  const recipeMachineLink = machineLink(recipe.machine);
  const recipeModLink = modLink(recipe.mod);
  const inputLinks = recipe.inputs.map(noteForEntry);
  const outputLinks = recipe.outputs.filter((output) => output.kind !== "tag").map(noteForEntry);
  const machineLinks = [recipeMachineLink];
  const titleOutput = recipe.outputs[0] ? recipe.outputs[0].id : "Unknown Output";

  const yamlInputs = recipe.inputs
    .map((input) => `  - id: "${escapeYamlString(input.id)}"
    note: "${escapeYamlString(noteForEntry(input))}"
    count: ${input.count}
    role: "${escapeYamlString(input.role)}"
    kind: "${escapeYamlString(input.kind)}"`)
    .join("\n");

  const yamlOutputs = recipe.outputs
    .map((output) => `  - id: "${escapeYamlString(output.id)}"
    note: "${escapeYamlString(noteForEntry(output))}"
    count: ${output.count}
    chance: ${output.chance}
    role: "${escapeYamlString(output.role)}"
    kind: "${escapeYamlString(output.kind)}"`)
    .join("\n");

  const mermaidInputs = recipe.inputs
    .map((input, index) => `    I${index}["${mermaidLabel(input.id)}"] --> R["${mermaidLabel(recipe.method)}"]`)
    .join("\n");
  const mermaidOutputs = recipe.outputs
    .map((output, index) => `    R --> O${index}["${mermaidLabel(output.id)}"]`)
    .join("\n");
  const yamlLinkList = (links) => (links.length ? `\n${links.map((link) => `  - "${link}"`).join("\n")}` : " []");
  const yamlRecordList = (records) => (records ? `\n${records}` : " []");

  return `---
type: recipe
schema: 1
id: "${escapeYamlString(recipe.id)}"
method: "${escapeYamlString(recipe.method)}"
machine: "${recipeMachineLink}"
mod: "${recipeModLink}"
stage: "${escapeYamlString(recipe.stage)}"
status: "${escapeYamlString(recipe.status)}"

input_links:${yamlLinkList(inputLinks)}

output_links:${yamlLinkList(outputLinks)}

machine_links:${yamlLinkList(machineLinks)}

inputs:${yamlRecordList(yamlInputs)}

outputs:${yamlRecordList(yamlOutputs)}

time: ${recipe.time}
energy: ${recipe.energy}

tags:
  - recipe
  - process/${recipe.method}
  - mod/${recipe.mod}
  - stage/${recipe.stage}
  - status/${recipe.status}
---

# Recipe: ${titleOutput} / ${recipe.method}

## Relation

${recipe.inputs.map((input) => lineForEntry("Input", input)).join("\n") || "- Input: unknown"}
- Process: ${recipe.method}
- Machine: ${recipeMachineLink}
${recipe.outputs.map((output) => lineForEntry("Output", output)).join("\n") || "- Output: unknown"}

## Flowchart

\`\`\`mermaid
flowchart LR
${mermaidInputs || '    I0["unknown input"] --> R["unknown"]'}
${mermaidOutputs || '    R --> O0["unknown output"]'}
\`\`\`

## Inputs

| Item | Count | Kind | Role |
|---|---:|---|---|
${recipe.inputs.map((input) => `| ${noteForEntry(input) || input.id} | ${input.count} | ${input.kind} | ${input.role} |`).join("\n") || "| unknown | 0 | unknown | input |"}

## Outputs

| Item | Count | Chance | Kind | Role |
|---|---:|---:|---|---|
${recipe.outputs.map((output) => `| ${noteForEntry(output) || output.id} | ${output.count} | ${output.chance} | ${output.kind} | ${output.role} |`).join("\n") || "| unknown | 0 | 0 | unknown | main_output |"}

## Raw JSON

\`\`\`json
${JSON.stringify(recipe.raw || {}, null, 2)}
\`\`\`
`;
}

module.exports = { generateRecipeMarkdown, recipeNoteName };
